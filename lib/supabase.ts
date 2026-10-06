import { createClient } from "@supabase/supabase-js";

// Chave publicável: pode ficar no navegador. Os dados são protegidos pelas regras do banco (RLS).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://raelmxfhzplsvipnthrd.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "sb_publishable_Q6TBX0uuIr8kT0LtlmghXQ_-Yh80_NL";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
});
