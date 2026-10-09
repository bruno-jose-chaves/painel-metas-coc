// Conexão OAuth com RD Station CRM e RD Station Marketing.
// Rotas:  /rd-oauth/{crm|marketing}/iniciar   -> redireciona para o login do RD
//         /rd-oauth/{crm|marketing}/callback  -> troca o code por tokens e volta para o painel
// Só funciona até 10 minutos depois de um administrador clicar em "Conectar" no painel.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
// O endereço de volta do OAuth. O padrão apontava para um subdomínio da Netlify
// que não é mais nosso: subdomínio abandonado pode ser reivindicado por outra
// pessoa, e o retorno do OAuth leva parâmetros junto. Padrão agora é o endereço
// de verdade do painel.
const APP_URL = Deno.env.get("APP_URL") ?? "https://painel-metas-coc.pages.dev";

const CFG = {
  crm: {
    servico: "rd_crm",
    autorizar: (cid: string, cb: string) =>
      `https://accounts.rdstation.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(cid)}&redirect_uri=${encodeURIComponent(cb)}`,
    trocar: async (cid: string, sec: string, code: string, cb: string) => {
      const r = await fetch("https://api.rd.services/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: cid, client_secret: sec, code, redirect_uri: cb, grant_type: "authorization_code" }),
      });
      return { status: r.status, corpo: await r.json().catch(() => ({})) };
    },
  },
  marketing: {
    servico: "rd_marketing",
    autorizar: (cid: string, cb: string) =>
      `https://api.rd.services/auth/dialog?client_id=${encodeURIComponent(cid)}&redirect_uri=${encodeURIComponent(cb)}`,
    trocar: async (cid: string, sec: string, code: string, _cb: string) => {
      const r = await fetch("https://api.rd.services/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: cid, client_secret: sec, code }),
      });
      return { status: r.status, corpo: await r.json().catch(() => ({})) };
    },
  },
} as const;

const voltar = (resultado: string, msg = "") =>
  Response.redirect(`${APP_URL}/ajustes/?v=sistema&rd=${resultado}${msg ? "&msg=" + encodeURIComponent(msg) : ""}`, 302);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const partes = url.pathname.split("/").filter(Boolean);
  const i = partes.indexOf("rd-oauth");
  const qual = partes[i + 1] as keyof typeof CFG;
  const acao = partes[i + 2];
  const cfg = CFG[qual];
  if (!cfg || !["iniciar", "callback"].includes(acao)) return new Response("rota inválida", { status: 404 });

  const callback = `${SUPABASE_URL}/functions/v1/rd-oauth/${qual}/callback`;
  const { data } = await db.rpc("credencial_obter", { p_servico: cfg.servico });
  const extra = (data?.[0]?.extra ?? {}) as Record<string, string>;
  const pendente = extra.pendente_ate && new Date(extra.pendente_ate) > new Date();
  if (!extra.client_id || !extra.client_secret) return voltar("erro", "aplicativo RD não cadastrado");
  if (!pendente) return voltar("erro", "conexão expirada, clique em Conectar novamente");

  if (acao === "iniciar") return Response.redirect(cfg.autorizar(extra.client_id, callback), 302);

  const code = url.searchParams.get("code");
  if (!code) return voltar("erro", "RD não devolveu o código de autorização");
  const { status, corpo } = await cfg.trocar(extra.client_id, extra.client_secret, code, callback);
  if (status >= 300 || !corpo.access_token) return voltar("erro", `RD recusou a troca (${status})`);

  const expira = new Date(Date.now() + (Number(corpo.expires_in ?? 7200) - 120) * 1000).toISOString();
  await db.rpc("credencial_salvar", {
    p_servico: cfg.servico,
    p_access: corpo.access_token,
    p_refresh: corpo.refresh_token ?? null,
    p_expira: expira,
    p_extra: { pendente_ate: null, conectado_em: new Date().toISOString() },
  });
  return voltar("ok", qual);
});
