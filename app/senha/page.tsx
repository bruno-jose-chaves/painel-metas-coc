"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DefinirSenha() {
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [repetida, setRepetida] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // O link de recuperação chega com a sessão no endereço. O cliente do Supabase
  // lê isso sozinho, então aqui só esperamos a sessão aparecer.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setPronto(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setPronto(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) { setAviso({ tipo: "erro", texto: "A senha precisa de pelo menos 8 caracteres." }); return; }
    if (senha !== repetida) { setAviso({ tipo: "erro", texto: "As duas senhas não são iguais." }); return; }
    setOcupado(true); setAviso(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setOcupado(false);
    if (error) {
      const m = error.message.toLowerCase();
      setAviso({
        tipo: "erro",
        texto: m.includes("pwned") || m.includes("compromised") || m.includes("weak")
          ? "Essa senha já apareceu em vazamentos conhecidos. Escolha outra."
          : error.message,
      });
      return;
    }
    setAviso({ tipo: "ok", texto: "Senha alterada. Levando você para o painel." });
    setTimeout(() => { window.location.href = "/"; }, 1200);
  }

  return (
    <div className="centro"><div className="login">
      <div className="rotulo">Painel de metas</div>
      <h1>Nova senha</h1>
      {!pronto ? (
        <>
          <p className="mudo">
            Abra esta página pelo link que enviamos por e-mail. Se você chegou aqui direto, volte ao login e peça
            Esqueci a senha.
          </p>
          <a className="btn claro" href="/login/" style={{ display: "inline-block", textDecoration: "none" }}>Voltar ao login</a>
        </>
      ) : (
        <form onSubmit={salvar}>
          <label className="campo"><span className="rotulo">Senha nova</span>
            <input type="password" required minLength={8} value={senha}
              onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="campo"><span className="rotulo">Repita a senha</span>
            <input type="password" required minLength={8} value={repetida}
              onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" />
          </label>
          <button className="btn" disabled={ocupado} style={{ width: "100%" }}>{ocupado ? "Salvando" : "Salvar senha"}</button>
        </form>
      )}
      {aviso && <div className={"aviso " + aviso.tipo}>{aviso.texto}</div>}
    </div></div>
  );
}
