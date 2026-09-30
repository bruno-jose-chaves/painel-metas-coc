// Sincronização periódica com RD Station CRM (negociações, contatos, tarefas, catálogos)
// e RD Station Marketing (conversões por página/formulário por dia).
// Chamada a cada 5 minutos pelo agendador do banco. Cada execução trabalha no máximo ~110s
// e guarda onde parou em public.sync_estado.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CRM = "https://api.rd.services/crm/v2";
let INICIO = Date.now();
const PRAZO_MS = 110_000;
const temTempo = () => Date.now() - INICIO < PRAZO_MS;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
let log: string[] = [];

// ---------- credenciais ----------
type Cred = { access_token: string; refresh_token: string; expira_em: string; extra: Record<string, string> };
async function cred(servico: string): Promise<Cred | null> {
  const { data } = await db.rpc("credencial_obter", { p_servico: servico });
  return data?.[0] ?? null;
}
async function token(servico: "rd_crm" | "rd_marketing"): Promise<string | null> {
  const c = await cred(servico);
  if (!c?.refresh_token) return null;
  if (c.access_token && c.expira_em && new Date(c.expira_em).getTime() - Date.now() > 10 * 60_000) return c.access_token;
  const { client_id, client_secret } = c.extra;
  const r = servico === "rd_crm"
    ? await fetch("https://api.rd.services/oauth2/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id, client_secret, refresh_token: c.refresh_token, grant_type: "refresh_token" }),
      })
    : await fetch("https://api.rd.services/auth/token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id, client_secret, refresh_token: c.refresh_token }),
      });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { log.push(`${servico}: falha ao renovar token (${r.status})`); return null; }
  await db.rpc("credencial_salvar", {
    p_servico: servico, p_access: j.access_token, p_refresh: j.refresh_token ?? null,
    p_expira: new Date(Date.now() + (Number(j.expires_in ?? 7200) - 120) * 1000).toISOString(), p_extra: null,
  });
  return j.access_token;
}

// ---------- estado ----------
async function estado(chave: string): Promise<Record<string, any>> {
  const { data } = await db.from("sync_estado").select("valor").eq("chave", chave).maybeSingle();
  return data?.valor ?? {};
}
async function salvarEstado(chave: string, valor: Record<string, unknown>) {
  await db.from("sync_estado").upsert({ chave, valor, atualizado_em: new Date().toISOString() });
}

// ---------- chamadas CRM com limite de ritmo ----------
let ultima = 0;
async function crm(tk: string, caminho: string, params: Record<string, string> = {}) {
  const espera = 550 - (Date.now() - ultima);
  if (espera > 0) await dormir(espera);
  ultima = Date.now();
  const u = new URL(CRM + caminho);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { Authorization: `Bearer ${tk}`, accept: "application/json" } });
  if (r.status === 429) { await dormir(Number(r.headers.get("Retry-After") ?? 10) * 1000); return crm(tk, caminho, params); }
  if (!r.ok) throw new Error(`CRM ${caminho} ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const normTel = (t?: string) => {
  let d = (t ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && "6789".includes(d[2])) d = d.slice(0, 2) + "9" + d.slice(2);
  return d.length >= 10 ? d : null;
};
const STATUS: Record<string, string> = { ongoing: "aberta", won: "ganha", lost: "perdida", paused: "pausada" };

// ---------- catálogos ----------
async function sincronizarCatalogo(tk: string) {
  const est = await estado("crm_catalogo");
  if (est.em && Date.now() - new Date(est.em).getTime() < 6 * 3600_000) return;
  const linhas: { tipo: string; id: string; nome: string; extra: Record<string, unknown> }[] = [];
  const todos = async (caminho: string) => {
    const out: any[] = []; let p = 1;
    try {
      while (true) {
        const j = await crm(tk, caminho, { "page[size]": "200", "page[number]": String(p) });
        out.push(...(j.data ?? []));
        if (!j.links?.next) break; p++;
      }
    } catch (e) { log.push(`catálogo ${caminho}: ${(e as Error).message}`); }
    return out;
  };
  for (const u of await todos("/users")) linhas.push({ tipo: "usuario", id: u.id, nome: (u.name ?? "").trim(), extra: { email: u.email } });
  for (const f of await todos("/pipelines")) {
    linhas.push({ tipo: "funil", id: f.id, nome: f.name, extra: { ordem: f.order } });
    for (const e of await todos(`/pipelines/${f.id}/stages`))
      linhas.push({ tipo: "etapa", id: e.id, nome: e.name, extra: { funil_id: f.id, ordem: e.order } });
  }
  for (const m of await todos("/lost_reasons")) linhas.push({ tipo: "motivo_perda", id: m.id, nome: m.name, extra: {} });
  for (const s of await todos("/sources")) linhas.push({ tipo: "fonte", id: s.id, nome: s.name, extra: {} });
  for (const c of await todos("/campaigns")) linhas.push({ tipo: "campanha", id: c.id, nome: c.name, extra: {} });
  for (const p of await todos("/products")) linhas.push({ tipo: "produto", id: p.id, nome: (p.name ?? "").trim(), extra: {} });
  await db.from("rd_catalogo").upsert(linhas);
  await salvarEstado("crm_catalogo", { em: new Date().toISOString(), itens: linhas.length });
  log.push(`catálogo: ${linhas.length}`);
}

async function mapaCatalogo() {
  const { data } = await db.from("rd_catalogo").select("tipo,id,nome");
  const m: Record<string, Record<string, string>> = {};
  for (const r of data ?? []) (m[r.tipo] ??= {})[r.id] = r.nome;
  return m;
}

// ---------- recurso paginado por cursor de data ----------
// A API só entrega os primeiros 10.000 registros de cada filtro. Por isso a leitura anda por data:
// pede sempre a página 1 de "atualizados desde X" em ordem crescente e avança o X até o último registro lido.
async function sincronizarRecurso(tk: string, chave: string, caminho: string, gravar: (itens: any[]) => Promise<void>) {
  const est = await estado(chave);
  let desde: string = est.desde ?? "2000-01-01T00:00:00-03:00";
  let total = 0;
  while (temTempo()) {
    const j = await crm(tk, caminho, {
      "page[size]": "200", "page[number]": "1",
      filter: `updated_at:>=${desde}`, "sort[updated_at]": "asc",
    });
    const itens: any[] = j.data ?? [];
    if (itens.length) { await gravar(itens); total += itens.length; }
    const maior = itens.reduce((m, x) => (x.updated_at > m ? x.updated_at : m), desde);
    const avancou = maior !== desde;
    if (avancou) desde = maior;
    await salvarEstado(chave, { desde, ultima: new Date().toISOString() });
    if (itens.length < 200 || !avancou) break; // em dia
  }
  log.push(`${chave}: ${total} (até ${desde.slice(0, 16)})`);
}

// ---------- Marketing: conversões por ativo por dia ----------
async function sincronizarMarketing() {
  const tk = await token("rd_marketing");
  if (!tk) return;
  const est = await estado("mkt_conversoes");
  const hoje = new Date(Date.now() - 3 * 3600_000); // horário de Brasília
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const dias: string[] = [iso(hoje), iso(new Date(hoje.getTime() - 86400_000))];
  let recuo = est.recuo_ate ? new Date(est.recuo_ate) : new Date(hoje.getTime() - 2 * 86400_000);
  const limite = new Date("2025-01-01");
  for (let i = 0; i < 25 && recuo >= limite; i++) { dias.push(iso(recuo)); recuo = new Date(recuo.getTime() - 86400_000); }
  let n = 0;
  for (const dia of dias) {
    if (!temTempo()) break;
    const r = await fetch(`https://api.rd.services/platform/analytics/conversions?start_date=${dia}&end_date=${dia}`, { headers: { Authorization: `Bearer ${tk}` } });
    if (!r.ok) { log.push(`marketing ${dia}: ${r.status}`); break; }
    const j = await r.json();
    const linhas = (j.conversions ?? []).filter((c: any) => c.conversion_count > 0 || Number(c.visits_count) > 0).map((c: any) => ({
      dia, asset_id: c.asset_id, identificador: c.asset_identifier, tipo: c.assets_type,
      conversoes: c.conversion_count ?? 0, visitas: Number(c.visits_count ?? 0),
    }));
    await db.from("rd_conversoes_diarias").delete().eq("dia", dia);
    if (linhas.length) await db.from("rd_conversoes_diarias").insert(linhas);
    n++;
    await dormir(300);
  }
  await salvarEstado("mkt_conversoes", { recuo_ate: iso(recuo), ultima: new Date().toISOString() });
  log.push(`marketing: ${n} dias`);
}

// ---------- execução ----------
Deno.serve(async (req) => {
  INICIO = Date.now();
  log = [];
  const { data: c } = await db.rpc("credencial_obter", { p_servico: "cron" });
  if (!c?.[0]?.access_token || req.headers.get("x-chave-painel") !== c[0].access_token) return new Response("não autorizado", { status: 401 });

  const { data: sync } = await db.from("sincronizacoes").insert({ fonte: "rd", status: "rodando" }).select("id").single();
  let erro: string | null = null;
  try {
    const tk = await token("rd_crm");
    if (tk) {
      await sincronizarCatalogo(tk);
      const cat = await mapaCatalogo();
      await sincronizarRecurso(tk, "crm_negociacoes", "/deals", async (itens) => {
        const p = itens.map((d) => ({
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
        }));
        const { error } = await db.rpc("rd_upsert_negociacoes", { p });
        if (error) throw new Error("negociações: " + error.message);
      });
      if (temTempo()) await sincronizarRecurso(tk, "crm_tarefas", "/tasks", async (itens) => {
        const linhas = itens.map((t) => ({
          id: t.id, negociacao_id: t.deal_id ?? null, usuario_id: t.owner_ids?.[0] ?? null, nome: t.name, tipo: t.type,
          status: t.status, vence_em: t.due_date ?? null, concluida_em: t.done_at ?? t.completed_at ?? null, bruto: null,
        }));
        const { error } = await db.from("rd_tarefas").upsert(linhas);
        if (error) throw new Error("tarefas: " + error.message);
      });
    } else log.push("CRM sem token");
    if (temTempo()) await sincronizarMarketing();
    if (tk) {
      // contatos: a listagem da API não permite ordenar, então buscamos um a um os contatos
      // das negociações recentes que ainda não temos (vendas ganhas primeiro)
      if (temTempo()) {
        const { data: pend } = await db.rpc("rd_contatos_pendentes", { p_limite: 180 });
        const linhas: Record<string, unknown>[] = [];
        for (const { contato_id } of pend ?? []) {
          if (!temTempo()) break;
          try {
            const { data: x } = await crm(tk, `/contacts/${contato_id}`);
            linhas.push({
              id: x.id, nome: x.name,
              email_norm: (x.emails?.[0]?.email ?? "").trim().toLowerCase() || null,
              telefone_norm: normTel(x.phones?.[0]?.phone),
              criado_em: x.created_at, atualizado_em: x.updated_at,
            });
          } catch (e) {
            if (String((e as Error).message).includes(" 404")) linhas.push({ id: contato_id, nome: null });
            else throw e;
          }
        }
        if (linhas.length) {
          const { error } = await db.from("rd_contatos").upsert(linhas);
          if (error) throw new Error("contatos: " + error.message);
        }
        log.push(`crm_contatos: ${linhas.length} de ${pend?.length ?? 0} pendentes`);
      }
    }
  } catch (e) {
    erro = String((e as Error).message ?? e);
  }
  await db.from("sincronizacoes").update({
    terminado_em: new Date().toISOString(), status: erro ? "erro" : "ok", detalhes: { erro, log },
  }).eq("id", sync!.id);
  return Response.json({ ok: !erro, erro, log, segundos: Math.round((Date.now() - INICIO) / 1000) });
});
