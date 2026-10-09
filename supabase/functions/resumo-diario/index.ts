// Entrega o resumo do dia em texto pronto para o WhatsApp. O n8n chama este
// endereço no horário que o Bruno quiser e manda o campo texto para o grupo.
// Chave própria, só no cabeçalho. Duas razões. A chave na query entra em log de
// servidor, em histórico de navegador e em print de tela, e chave que aparece em
// log é chave queimada. E a chave do cron abre todas as rotinas do painel: quem
// guardasse a URL do resumo guardaria a chave-mestra. Esta abre só o resumo.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const chave = req.headers.get("x-chave-painel") ?? "";
  const { data: cred } = await db.rpc("credencial_obter", { p_servico: "resumo" });
  const esperada = cred?.[0]?.access_token;
  if (!esperada || chave.length !== esperada.length || chave !== esperada) {
    return new Response("não autorizado", { status: 401 });
  }

  const dia = url.searchParams.get("dia");
  const { data, error } = await db.rpc("resumo_do_dia", { p_dia: dia ?? null });
  if (error) return Response.json({ ok: false, erro: error.message }, { status: 500 });

  const texto = String(data ?? "").trim();
  // Texto puro para quem só quer encaminhar, e json para quem quer montar.
  if (url.searchParams.get("formato") === "texto") {
    return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return Response.json({ ok: true, dia: dia ?? "hoje", texto });
});
