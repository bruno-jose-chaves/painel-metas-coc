// Gestão de contas feita pelo próprio painel, sem depender de e-mail.
// Só administradores chamam: a permissão é conferida com o token de quem pediu.
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLICA = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(URL_SB, SERVICO, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function ehAdmin(auth: string | null) {
  if (!auth) return false;
  const comoUsuario = createClient(URL_SB, PUBLICA, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await comoUsuario.rpc("is_admin");
  return !error && data === true;
}

async function acharUsuario(email: string) {
  // A API não tem busca por e-mail, então varremos as páginas até achar.
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(error.message);
    const achado = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (achado) return achado;
    if (data.users.length < 200) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("método não permitido", { status: 405, headers: cors });

  if (!(await ehAdmin(req.headers.get("Authorization")))) {
    return Response.json({ erro: "apenas administradores" }, { status: 403, headers: cors });
  }

  const corpo = await req.json().catch(() => ({}));
  const acao = corpo.acao as string;
  const email = (corpo.email ?? "").toString().trim().toLowerCase();
  const senha = (corpo.senha ?? "").toString();
  const papel = (corpo.papel ?? "leitor").toString();
  const nome = corpo.nome ? String(corpo.nome) : null;

  if (!email) return Response.json({ erro: "falta o e-mail" }, { status: 400, headers: cors });

  try {
    if (acao === "criar") {
      if (senha.length < 8) return Response.json({ erro: "senha curta" }, { status: 400, headers: cors });
      const existente = await acharUsuario(email);
      if (existente) {
        await admin.auth.admin.updateUserById(existente.id, { password: senha, email_confirm: true });
      } else {
        const { error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
        if (error) throw new Error(error.message);
      }
      const { error: e2 } = await admin.from("usuarios_autorizados")
        .upsert({ email, nome, papel }, { onConflict: "email" });
      if (e2) throw new Error(e2.message);
      await admin.from("solicitacoes_acesso")
        .update({ situacao: "aprovada", respondida_em: new Date().toISOString() }).eq("email", email);
      return Response.json({ ok: true, criado: !existente }, { headers: cors });
    }

    if (acao === "senha") {
      if (senha.length < 8) return Response.json({ erro: "senha curta" }, { status: 400, headers: cors });
      const u = await acharUsuario(email);
      if (!u) return Response.json({ erro: "essa pessoa ainda não tem conta" }, { status: 404, headers: cors });
      const { error } = await admin.auth.admin.updateUserById(u.id, { password: senha, email_confirm: true });
      if (error) throw new Error(error.message);
      return Response.json({ ok: true }, { headers: cors });
    }

    if (acao === "trocar_email") {
      const novo = (corpo.email_novo ?? "").toString().trim().toLowerCase();
      if (!novo) return Response.json({ erro: "falta o e-mail novo" }, { status: 400, headers: cors });
      const u = await acharUsuario(email);
      if (u) {
        const { error } = await admin.auth.admin.updateUserById(u.id, { email: novo, email_confirm: true });
        if (error) throw new Error(error.message);
      }
      const { error: e2 } = await admin.from("usuarios_autorizados")
        .update({ email: novo }).eq("email", email);
      if (e2) throw new Error(e2.message);
      return Response.json({ ok: true, conta_movida: !!u }, { headers: cors });
    }

    return Response.json({ erro: "ação desconhecida" }, { status: 400, headers: cors });
  } catch (e) {
    return Response.json({ erro: String((e as Error).message ?? e) }, { status: 500, headers: cors });
  }
});
