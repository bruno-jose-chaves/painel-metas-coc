"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin + "/" },
    });
    setOcupado(false);
    if (error) setErro(error.message.includes("rate") ? "Muitas tentativas seguidas. Aguarde alguns minutos." : error.message);
    else setEnviado(true);
  }

  return (
    <div className="centro"><div className="login">
      <div className="rotulo">001 · Painel de metas</div>
      <h1>COC Online</h1>
      {enviado ? (
        <div className="aviso ok">Enviamos um link de acesso para <b>{email}</b>. Abra o e-mail neste mesmo aparelho e toque no link.</div>
      ) : (
        <form onSubmit={entrar}>
          <label className="campo"><span className="rotulo">Seu e-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" autoComplete="email" />
          </label>
          <button className="btn" disabled={ocupado} style={{ width: "100%" }}>{ocupado ? "Enviando" : "Receber link de acesso"}</button>
          {erro && <div className="aviso erro">{erro}</div>}
          <p className="mudo">Sem senha. Você recebe um link por e-mail a cada novo acesso.</p>
        </form>
      )}
    </div></div>
  );
}
