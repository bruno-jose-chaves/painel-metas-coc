// Recebe as linhas da planilha "Coc Online - Comercial" enviadas pelo Apps Script
// e espelha cada aba na tabela public.vendas.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// nome do cabeçalho (normalizado) -> coluna do banco
const MAPA: Record<string, string> = {
  "n": "numero", "n°": "numero", "nº": "numero", "a": "numero",
  "data": "data", "data da compra": "data",
  "vendedor": "vendedor",
  "status": "status", "condicao": "status",
  "nome": "nome",
  "email do cliente": "email", "email": "email",
  "telefone": "telefone", "telefone do aluno": "telefone",
  "resp. financeiro": "resp_financeiro", "nome do responsavel financeiro": "resp_financeiro",
  "cursos": "curso", "curso adquirido": "curso",
  "material": "material",
  "valor total": "valor_tabela",
  "porcentagem de desconto": "desconto_pct",
  "valor do desconto": "desconto_valor",
  "valor da venda": "valor_venda",
  "cidade": "cidade", "cidade do aluno": "cidade",
  "estado": "estado",
  "obs": "obs",
};

function dinheiro(v: string): number | null {
  if (!v) return null;
  const s = v.replace(/[^\d,\-]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function percentual(v: string): number | null {
  if (!v || !/\d/.test(v)) return null;
  const n = parseFloat(v.replace(/[^\d,\-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n / 100 : null;
}
function dataBR(v: string): string | null {
  const m = (v || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const ano = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
const texto = (v: string) => {
  const t = (v ?? "").toString().replace(/\r/g, "").trim();
  return t === "" ? null : t;
};

async function chaveValida(req: Request) {
  const enviada = req.headers.get("x-chave-painel") ?? "";
  if (!enviada) return false;
  const { data } = await db.rpc("credencial_obter", { p_servico: "planilha" });
  const token = data?.[0]?.access_token;
  return !!token && token === enviada;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });
  if (!(await chaveValida(req))) return new Response("não autorizado", { status: 401 });

  const { aba, cabecalho, linhas } = await req.json() as { aba: string; cabecalho: string[]; linhas: string[][] };
  if (!aba || !Array.isArray(cabecalho) || !Array.isArray(linhas)) {
    return new Response("payload inválido", { status: 400 });
  }

  const { data: sync } = await db.from("sincronizacoes").insert({ fonte: `planilha:${aba}`, status: "rodando" }).select("id").single();

  // posição de cada coluna, sempre pela primeira ocorrência do nome
  const pos: Record<string, number> = {};
  cabecalho.forEach((h, i) => {
    const k = norm(String(h ?? "")).replace(/\.\.\.$/, "");
    const alvo = MAPA[k] ?? (k.startsWith("nome do responsavel") ? "resp_financeiro" : undefined);
    if (alvo && pos[alvo] === undefined) pos[alvo] = i;
  });

  const registros: Record<string, unknown>[] = [];
  const rejeitadas: { linha: number; motivo: string }[] = [];
  const avisos: string[] = [];
  linhas.forEach((l, idx) => {
    const g = (c: string) => (pos[c] === undefined ? "" : String(l[pos[c]] ?? ""));
    const nome = texto(g("nome"));
    const data = dataBR(g("data"));
    if (!nome && !data) return; // linha vazia
    if (!data) { rejeitadas.push({ linha: idx + 2, motivo: "data ilegível" }); return; }
    const numero = texto(g("numero"));
    registros.push({
      chave: `${aba}|${numero ?? "L" + (idx + 2)}`,
      _linha: idx + 2,
      aba, numero, data,
      vendedor: texto(g("vendedor")),
      status: texto(g("status")),
      nome,
      email: texto(g("email")),
      telefone: texto(g("telefone")),
      resp_financeiro: texto(g("resp_financeiro")),
      curso: texto(g("curso")),
      material: texto(g("material")),
      valor_tabela: dinheiro(g("valor_tabela")),
      desconto_pct: percentual(g("desconto_pct")),
      desconto_valor: dinheiro(g("desconto_valor")),
      valor_venda: dinheiro(g("valor_venda")),
      cidade: texto(g("cidade")),
      estado: texto(g("estado")),
      obs: texto(g("obs")),
    });
  });

  // número repetido na coluna "n": a segunda ocorrência ganha a linha na chave, sem perder a venda
  const unicos = new Map<string, Record<string, unknown>>();
  for (const r of registros) {
    if (unicos.has(r.chave as string)) {
      avisos.push(`número repetido na planilha: ${r.numero} (linha ${r._linha})`);
      r.chave = `${r.chave}|L${r._linha}`;
    }
    unicos.set(r.chave as string, r);
  }
  for (const r of unicos.values()) delete r._linha;
  const lista = [...unicos.values()];

  let erro: string | null = null;
  for (let i = 0; i < lista.length && !erro; i += 500) {
    const { error } = await db.from("vendas").upsert(lista.slice(i, i + 500), { onConflict: "chave" });
    if (error) erro = error.message;
  }
  // espelho: remove da base o que saiu da aba
  if (!erro && lista.length > 0) {
    const chaves = lista.map((r) => r.chave as string);
    const { data: existentes } = await db.from("vendas").select("chave").eq("aba", aba);
    const sobrando = (existentes ?? []).map((e) => e.chave).filter((c) => !chaves.includes(c));
    for (let i = 0; i < sobrando.length; i += 200) {
      await db.from("vendas").delete().in("chave", sobrando.slice(i, i + 200));
    }
  }

  await db.from("sincronizacoes").update({
    terminado_em: new Date().toISOString(),
    lidas: linhas.length,
    importadas: erro ? 0 : lista.length,
    rejeitadas: rejeitadas.length,
    status: erro ? "erro" : "ok",
    detalhes: { erro, rejeitadas: rejeitadas.slice(0, 50), avisos: avisos.slice(0, 50) },
  }).eq("id", sync!.id);

  return Response.json({ ok: !erro, importadas: lista.length, rejeitadas: rejeitadas.length, erro },
    { status: erro ? 500 : 200 });
});
