// Recebe os webhooks do RD Station. O corpo bruto é guardado sempre, e o
// processamento é feito em seguida: negociação é relida da API v2 (fonte da
// verdade) e conversão de Marketing entra com as tags do lead.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const STATUS: Record<string, string> = {
  ongoing: "aberta", won: "ganha", lost: "perdida",
};

const soDigitos = (v: string) => v.replace(/\D/g, "");

async function chaveDoWebhook() {
  const { data } = await db.rpc("credencial_obter", { p_servico: "webhook" });
  return data?.[0]?.access_token ?? null;
}

async function tokenCrm() {
  const { data } = await db.rpc("credencial_obter", { p_servico: "rd_crm" });
  return data?.[0]?.access_token ?? null;
}

async function mapaCatalogo() {
  const { data } = await db.from("rd_catalogo").select("tipo,id,nome");
  const m: Record<string, Record<string, string>> = {};
  for (const l of data ?? []) {
    (m[l.tipo] ??= {})[l.id] = l.nome;
  }
  return m;
}

// Extrai o id da negociação do payload, aceitando as variações do RD.
function idDaNegociacao(corpo: any): string | null {
  const d = corpo?.document ?? corpo?.deal ?? corpo;
  const bruto = d?.id ?? d?._id ?? d?.deal_id ?? corpo?.deal_id ?? null;
  const id = typeof bruto === "string" ? bruto : bruto?.$oid ?? null;
  return typeof id === "string" && /^[0-9a-f]{24}$/.test(id) ? id : null;
}

async function processarCrm(corpo: any) {
  const id = idDaNegociacao(corpo);
  if (!id) throw new Error("payload sem id de negociação");
  const tk = await tokenCrm();
  if (!tk) throw new Error("sem token do CRM");

  const r = await fetch(`https://api.rd.services/crm/v2/deals/${id}`, {
    headers: { Authorization: `Bearer ${tk}`, Accept: "application/json" },
  });
  if (r.status === 404) return { ignorado: "negociação removida" };
  if (!r.ok) throw new Error(`CRM ${r.status} ao reler a negociação`);

  const d = (await r.json()).data;
  const cat = await mapaCatalogo();
  const p = [{
    id: d.id, nome: d.name, usuario_id: d.owner_id ?? null, usuario_nome: cat.usuario?.[d.owner_id] ?? null,
    funil_id: d.pipeline_id, funil_nome: cat.funil?.[d.pipeline_id] ?? null,
    etapa_id: d.stage_id, etapa_nome: cat.etapa?.[d.stage_id] ?? null,
    status: STATUS[d.status] ?? d.status,
    motivo_perda_id: d.lost_reason_id ?? null, motivo_perda: cat.motivo_perda?.[d.lost_reason_id] ?? null,
    fonte_id: d.source_id ?? null, fonte: cat.fonte?.[d.source_id] ?? null,
    campanha_id_rd: d.campaign_id ?? null, campanha_rd: cat.campanha?.[d.campaign_id] ?? null,
    valor: d.total_price ?? null, contato_id: d.contact_ids?.[0] ?? null,
    criado_em: d.created_at, atualizado_em: d.updated_at, fechado_em: d.closed_at ?? null,
    bruto: { custom_fields: d.custom_fields ?? {}, rating: d.rating },
  }];
  const { error } = await db.rpc("rd_upsert_negociacoes", { p });
  if (error) throw new Error("upsert: " + error.message);
  return { negociacao: d.id };
}

async function processarMarketing(corpo: any) {
  // Formato atual do RD: um contato por evento, com a conversão no topo.
  // O formato antigo (lista em "leads") continua aceito.
  const eventos: { c: any; identificador: string; quando: string; origem: string | null }[] = [];
  if (corpo?.contact) {
    eventos.push({
      c: corpo.contact,
      identificador: corpo.event_identifier ?? "sem identificador",
      quando: corpo.event_timestamp ?? corpo.timestamp ?? new Date().toISOString(),
      origem: corpo.contact?.funnel?.origin ?? null,
    });
  } else {
    for (const l of corpo?.leads ?? []) {
      const conv = l.last_conversion ?? {};
      eventos.push({
        c: l,
        identificador: conv.conversion_identifier ?? "sem identificador",
        quando: conv.created_at ?? l.updated_at ?? new Date().toISOString(),
        origem: conv.source ?? l.traffic_source ?? null,
      });
    }
  }
  if (eventos.length === 0) return { ignorado: "payload sem contato" };

  const linhas = eventos.map(({ c, identificador, quando, origem }) => {
    const email = (c.email ?? "").toString().trim().toLowerCase() || null;
    const telefone = (c.mobile_phone ?? c.personal_phone ?? "").toString();
    return {
      chave_evento: `${c.uuid ?? email ?? "anon"}|${identificador}|${quando}`,
      email_norm: email,
      telefone_norm: telefone ? soDigitos(telefone) : null,
      nome: c.name ?? null,
      identificador,
      tags: Array.isArray(c.tags) ? c.tags : [],
      origem,
      convertido_em: quando,
      payload: c,
    };
  });

  const { error } = await db.from("rd_conversoes").upsert(linhas, { onConflict: "chave_evento" });
  if (error) throw new Error("conversões: " + error.message);
  return { conversoes: linhas.length };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const origem = url.pathname.split("/").filter(Boolean).pop() ?? "";
  if (origem !== "crm" && origem !== "marketing") {
    return new Response("rota inválida", { status: 404 });
  }

  const chave = url.searchParams.get("chave") ?? req.headers.get("x-chave-painel") ?? "";
  const esperada = await chaveDoWebhook();
  if (!esperada || chave !== esperada) return new Response("não autorizado", { status: 401 });

  let corpo: unknown = null;
  try {
    corpo = await req.json();
  } catch {
    return new Response("corpo inválido", { status: 400 });
  }

  const { data: reg } = await db.from("rd_webhook_eventos")
    .insert({ origem, evento: (corpo as any)?.event_name ?? (corpo as any)?.event_type ?? null, corpo })
    .select("id").single();

  // Responder rápido importa: o RD repete o envio quando não recebe 200.
  try {
    const r = origem === "crm" ? await processarCrm(corpo) : await processarMarketing(corpo);
    await db.from("rd_webhook_eventos").update({ processado_em: new Date().toISOString() }).eq("id", reg!.id);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    await db.from("rd_webhook_eventos").update({ erro: String(e) }).eq("id", reg!.id);
    // 200 de propósito: o evento já está guardado e será reprocessado.
    return Response.json({ ok: false, guardado: true, erro: String(e) });
  }
});
