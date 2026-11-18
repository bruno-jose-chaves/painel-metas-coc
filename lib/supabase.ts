import { createClient } from "@supabase/supabase-js";
import { registrarFalha } from "@/lib/erros";

// Chave publicável: pode ficar no navegador. Os dados são protegidos pelas regras do banco (RLS).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://raelmxfhzplsvipnthrd.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "sb_publishable_Q6TBX0uuIr8kT0LtlmghXQ_-Yh80_NL";

// Toda leitura de dados que falha (sem rede, 5xx, erro de consulta) é registrada
// para o Shell avisar a pessoa. Fica de fora: login e sessão (401 e 403 têm
// tratamento próprio), escrita (cada formulário mostra o seu erro), 406 (consulta
// de uma linha sem resultado) e requisição cancelada de propósito.
const buscarComAviso: typeof fetch = async (entrada, init) => {
  const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const metodo = (init?.method ?? (typeof entrada === "object" && "method" in entrada ? entrada.method : "GET")).toUpperCase();
  const leitura = url.includes("/rest/v1/") && (metodo === "GET" || metodo === "HEAD" || url.includes("/rpc/"));
  try {
    const r = await fetch(entrada, init);
    if (leitura && !r.ok && ![401, 403, 406].includes(r.status)) registrarFalha();
    return r;
  } catch (e) {
    if (leitura && (e as Error).name !== "AbortError") registrarFalha();
    throw e;
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: buscarComAviso },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
});
