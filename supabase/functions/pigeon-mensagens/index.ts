// Lê a primeira mensagem que o cliente mandou em cada conversa do Pigeon.
// É o terceiro passo da cascata de classificação de curso: quando a campanha do
// CRM e o anúncio não dizem qual curso a pessoa quer, a frase dela diz.
// Trabalha por lote, com orçamento de tempo, e volta de onde parou.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const ORCAMENTO_MS = 100_000;
const LOTE = 40;

async function credencial(servico: string) {
  const { data } = await db.rpc("credencial_obter", { p_servico: servico });
  return data?.[0] ?? null;
}

const texto = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || null;
};

// No Pigeon, FROM_HUB é a mensagem que chegou do cliente pelo gateway do
// WhatsApp, e TO_HUB é a que a empresa mandou, pela API ou pelo atendente.
// O nome engana, então vale o que os dados mostram: "Olá! Tenho interesse no
// curso Missão UFSC" vem como FROM_HUB.
function doCliente(m: any): boolean {
  const d = String(m?.direction ?? "").toUpperCase();
  if (d === "FROM_HUB") return true;
  if (d === "TO_HUB") return false;
  if (m?.fromMe === false || m?.isFromMe === false) return true;
  if (m?.fromMe === true || m?.isFromMe === true) return false;
  return false;
}

function conteudo(m: any): string | null {
  return texto(
    m?.text ?? m?.body ?? m?.message ?? m?.content?.text ?? m?.content?.body ??
    m?.caption ?? m?.content
  );
}

async function mensagens(base: string, token: string, sessao: string) {
  const url = new URL(`${base}/chat/v1/session/${sessao}/message`);
  url.searchParams.set("PageSize", "30");
  url.searchParams.set("PageNumber", "1");
  url.searchParams.set("OrderBy", "createdAt");
  url.searchParams.set("OrderDirection", "ASCENDING");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (r.status === 429) { await new Promise((s) => setTimeout(s, 2500)); return mensagens(base, token, sessao); }
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`mensagem ${r.status} na sessão ${sessao}`);
  const corpo = await r.json();
  return Array.isArray(corpo) ? corpo : (corpo.items ?? []);
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
  const token = pigeon.access_token;

  // Modo de inspeção: devolve o corpo cru de uma conversa, para conferir formato.
  const crua = url.searchParams.get("crua");
  if (crua) {
    try {
      const lista = await mensagens(base, token, crua);
      return Response.json({ sessao: crua, quantas: lista.length, primeiras: lista.slice(0, 4) });
    } catch (err) {
      return Response.json({ erro: String((err as Error).message ?? err) }, { status: 500 });
    }
  }

  let lidas = 0, gravadas = 0, vazias = 0;
  const erros: string[] = [];

  while (Date.now() - inicio < ORCAMENTO_MS) {
    const { data: pendentes } = await db
      .from("pigeon_conversas")
      .select("id")
      .is("primeira_mensagem_cliente", null)
      .is("mensagens_lidas_em", null)
      .order("inicio", { ascending: false })
      .limit(LOTE);

    const fila = (pendentes ?? []) as { id: string }[];
    if (fila.length === 0) break;

    for (const c of fila) {
      if (Date.now() - inicio >= ORCAMENTO_MS) break;
      lidas += 1;
      try {
        const lista = await mensagens(base, token, c.id);
        const primeira = lista.find((m: any) => doCliente(m) && conteudo(m));
        const frase = primeira ? conteudo(primeira)!.slice(0, 2000) : null;
        if (frase) gravadas += 1; else vazias += 1;
        await db.from("pigeon_conversas")
          .update({ primeira_mensagem_cliente: frase, mensagens_lidas_em: new Date().toISOString() })
          .eq("id", c.id);
      } catch (err) {
        erros.push(String((err as Error).message ?? err));
        // Marca como lida para a fila andar; o erro fica registrado na resposta.
        await db.from("pigeon_conversas")
          .update({ mensagens_lidas_em: new Date().toISOString() })
          .eq("id", c.id);
        if (erros.length > 20) break;
      }
    }
  }

  const { count: faltam } = await db
    .from("pigeon_conversas")
    .select("id", { count: "exact", head: true })
    .is("primeira_mensagem_cliente", null)
    .is("mensagens_lidas_em", null);

  return Response.json({ ok: true, lidas, gravadas, sem_mensagem_do_cliente: vazias, faltam, erros: erros.slice(0, 5) });
});
