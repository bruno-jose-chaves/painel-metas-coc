// Importação e sincronismo das conversas do Pigeon Post.
// Trabalha por página, guarda onde parou e volta de onde estava na próxima
// chamada. Primeiro faz a carga do histórico; depois passa a buscar só o que
// mudou. O corte é a data de início da campanha, guardada no estado.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const TAMANHO_PAGINA = 100;
const ORCAMENTO_MS = 100_000; // sobra folga no limite da função

function normTel(t: unknown) {
  let d = String(t ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && "6789".includes(d[2])) d = d.slice(0, 2) + "9" + d.slice(2);
  return d.length >= 10 ? d : null;
}

const texto = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || null;
};

async function credencial(servico: string) {
  const { data } = await db.rpc("credencial_obter", { p_servico: servico });
  return data?.[0] ?? null;
}

type Estado = {
  recurso: string; pagina: number; desde: string | null;
  ultimo_corte: string | null; total_api: number | null;
  gravados: number; concluido_em: string | null;
};

const CAMINHO: Record<string, string> = {
  contatos: "/core/v1/contact",
  conversas: "/chat/v1/session",
};

function linhaContato(c: any) {
  return {
    id: c.id,
    nome: texto(c.name ?? c.nameWhatsapp),
    telefone_norm: normTel(c.phoneNumber),
    email_norm: texto(c.email)?.toLowerCase() ?? null,
    etiquetas: Array.isArray(c.tagNames) ? c.tagNames : [],
    origem: texto(c.origin),
    criado_em: c.createdAt ?? null,
    atualizado_em: c.updatedAt ?? null,
    bruto: c,
  };
}

function linhaConversa(s: any) {
  return {
    id: s.id,
    contato_id: texto(s.contactId),
    canal_id: texto(s.channelId),
    usuario_id: texto(s.userId),
    equipe_id: texto(s.departmentId),
    numero: texto(s.number),
    status: texto(s.status),
    origem: texto(s.origin),
    criado_em: s.createdAt ?? null,
    inicio: s.startAt ?? s.createdAt ?? null,
    fim: s.endAt ?? null,
    ultima_interacao: s.lastInteractionDate ?? null,
    nao_lidas: typeof s.unreadCount === "number" ? s.unreadCount : null,
    bruto: s,
  };
}

async function sincronizar(recurso: string, base: string, token: string, inicio: number) {
  const { data: e } = await db.from("pigeon_sync_estado").select("*").eq("recurso", recurso).single();
  const est = e as Estado;
  if (!est) throw new Error("recurso desconhecido: " + recurso);

  // Carga concluída: a partir daí busca só o que mudou desde o último corte.
  const incremental = !!est.concluido_em;
  const campo = incremental ? "UpdatedAt.After" : "CreatedAt.After";
  const corte = incremental
    ? (est.ultimo_corte ?? est.desde ?? "2026-08-25T00:00:00Z")
    : (est.desde ?? "2026-08-25T00:00:00Z");

  let pagina = incremental ? 1 : (est.pagina ?? 1);
  let gravados = 0;
  let total: number | null = null;
  let paginasTotal = 1;
  const inicioDaVolta = new Date().toISOString();

  while (Date.now() - inicio < ORCAMENTO_MS) {
    const url = new URL(base + CAMINHO[recurso]);
    url.searchParams.set("PageSize", String(TAMANHO_PAGINA));
    url.searchParams.set("PageNumber", String(pagina));
    url.searchParams.set("OrderBy", "createdAt");
    url.searchParams.set("OrderDirection", "ASCENDING");
    url.searchParams.set(campo, corte);

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 3000)); continue; }
    if (!r.ok) throw new Error(`${recurso} ${r.status} na página ${pagina}`);

    const corpo = await r.json();
    const itens: any[] = Array.isArray(corpo) ? corpo : (corpo.items ?? []);
    total = Array.isArray(corpo) ? itens.length : (corpo.totalItems ?? null);
    paginasTotal = Array.isArray(corpo) ? 1 : (corpo.totalPages ?? 1);

    if (itens.length) {
      const tabela = recurso === "contatos" ? "pigeon_contatos" : "pigeon_conversas";
      const linhas = itens.map(recurso === "contatos" ? linhaContato : linhaConversa);
      const { error } = await db.from(tabela).upsert(linhas, { onConflict: "id" });
      if (error) throw new Error("gravação: " + error.message);
      gravados += linhas.length;
    }

    const acabou = itens.length === 0 || pagina >= paginasTotal;
    pagina += 1;

    if (acabou) {
      await db.from("pigeon_sync_estado").update({
        pagina: 1,
        total_api: total,
        gravados: (est.gravados ?? 0) + gravados,
        ultimo_corte: inicioDaVolta,
        concluido_em: est.concluido_em ?? new Date().toISOString(),
        erro: null,
        atualizado_em: new Date().toISOString(),
      }).eq("recurso", recurso);
      return { recurso, gravados, total, terminou: true, incremental };
    }
  }

  // Orçamento de tempo esgotado: guarda onde parou e continua na próxima volta.
  await db.from("pigeon_sync_estado").update({
    pagina,
    total_api: total,
    gravados: (est.gravados ?? 0) + gravados,
    erro: null,
    atualizado_em: new Date().toISOString(),
  }).eq("recurso", recurso);
  return { recurso, gravados, total, terminou: false, proxima_pagina: pagina, incremental };
}

Deno.serve(async (req) => {
  const inicio = Date.now();
  const url = new URL(req.url);
  const chave = url.searchParams.get("chave") ?? req.headers.get("x-chave-painel") ?? "";
  const cron = await credencial("cron");
  if (!cron?.access_token || chave !== cron.access_token) {
    return new Response("não autorizado", { status: 401 });
  }

  const pigeon = await credencial("pigeon");
  if (!pigeon?.access_token) return Response.json({ erro: "sem token do Pigeon" }, { status: 400 });
  const base = (pigeon.extra?.base_url ?? "https://api.pigeon.runus.com.br").replace(/\/$/, "");

  const pedido = url.searchParams.get("recurso");
  const recursos = pedido ? [pedido] : ["contatos", "conversas"];
  const saida: unknown[] = [];

  for (const r of recursos) {
    try {
      saida.push(await sincronizar(r, base, pigeon.access_token, inicio));
    } catch (err) {
      const msg = String((err as Error).message ?? err);
      await db.from("pigeon_sync_estado")
        .update({ erro: msg, atualizado_em: new Date().toISOString() }).eq("recurso", r);
      saida.push({ recurso: r, erro: msg });
    }
  }

  return Response.json({ ok: true, resultado: saida });
});
