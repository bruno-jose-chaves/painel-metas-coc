"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Aba = "entrar" | "criar" | "pedir";

export default function Login() {
  const [aba, setAba] = useState<Aba>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const limpo = () => email.trim().toLowerCase();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setAviso(null);
    const { error } = await supabase.auth.signInWithPassword({ email: limpo(), password: senha });
    setOcupado(false);
    if (!error) { window.location.href = "/"; return; }
    const m = error.message.toLowerCase();
    if (m.includes("invalid")) {
      setAviso({ tipo: "erro", texto: "E-mail ou senha não conferem. Se é seu primeiro acesso, use Criar senha." });
    } else if (m.includes("not confirmed")) {
      setAviso({ tipo: "erro", texto: "Falta confirmar o e-mail. Procure a mensagem de confirmação na sua caixa de entrada." });
    } else {
      setAviso({ tipo: "erro", texto: error.message });
    }
  }

  async function criarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) { setAviso({ tipo: "erro", texto: "A senha precisa de pelo menos 8 caracteres." }); return; }
    setOcupado(true); setAviso(null);
    const { data, error } = await supabase.auth.signUp({
      email: limpo(), password: senha,
      options: { emailRedirectTo: window.location.origin + "/" },
    });
    setOcupado(false);
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already") || m.includes("registered")) {
        setAviso({ tipo: "erro", texto: "Esse e-mail já tem senha. Use Entrar, ou Esqueci a senha para trocar." });
      } else if (m.includes("pwned") || m.includes("compromised") || m.includes("weak")) {
        setAviso({ tipo: "erro", texto: "Essa senha já apareceu em vazamentos conhecidos. Escolha outra." });
      } else {
        setAviso({ tipo: "erro", texto: error.message });
      }
      return;
    }
    if (data.session) { window.location.href = "/"; return; }
    // Conta já existente volta com a lista de identidades vazia e sem enviar nada.
    // Nesse caso o caminho certo é redefinir a senha.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      await supabase.auth.resetPasswordForEmail(limpo(), { redirectTo: window.location.origin + "/senha/" });
      setAviso({
        tipo: "ok",
        texto: "Esse e-mail já tem conta. Enviamos o link para definir uma senha nova. Se não chegar em alguns minutos, peça para a diretoria definir sua senha direto no painel.",
      });
      return;
    }
    setAviso({ tipo: "ok", texto: "Conta criada. Confirme pelo link que enviamos para " + limpo() + " e depois entre normalmente." });
  }

  async function recuperar() {
    if (!limpo()) { setAviso({ tipo: "erro", texto: "Escreva seu e-mail primeiro." }); return; }
    setOcupado(true); setAviso(null);
    const { error } = await supabase.auth.resetPasswordForEmail(limpo(), {
      redirectTo: window.location.origin + "/senha/",
    });
    setOcupado(false);
    setAviso(error
      ? { tipo: "erro", texto: error.message }
      : { tipo: "ok", texto: "Se esse e-mail tiver cadastro, o link para definir nova senha chega em instantes." });
  }

  async function pedirAcesso(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setAviso(null);
    const { data, error } = await supabase.rpc("solicitar_acesso", {
      p_email: limpo(), p_nome: nome || null, p_mensagem: mensagem || null,
    });
    setOcupado(false);
    if (error) { setAviso({ tipo: "erro", texto: error.message }); return; }
    const resposta: Record<string, { tipo: "ok" | "erro"; texto: string }> = {
      registrada: { tipo: "ok", texto: "Pedido enviado. A diretoria libera o acesso e você recebe um aviso." },
      ja_autorizado: { tipo: "ok", texto: "Esse e-mail já tem acesso liberado. Use Criar senha e depois entre." },
      email_invalido: { tipo: "erro", texto: "Esse e-mail não parece válido." },
      muitas_solicitacoes: { tipo: "erro", texto: "Muitos pedidos em pouco tempo. Tente de novo mais tarde." },
    };
    setAviso(resposta[data as string] ?? { tipo: "ok", texto: "Pedido registrado." });
  }

  return (
    <div className="centro"><div className="login">
      <div className="rotulo">Painel de metas</div>
      <h1>COC Online</h1>

      <div className="abas">
        <button className={aba === "entrar" ? "ativo" : ""} onClick={() => { setAba("entrar"); setAviso(null); }}>Entrar</button>
        <button className={aba === "pedir" ? "ativo" : ""} onClick={() => { setAba("pedir"); setAviso(null); }}>Pedir acesso</button>
      </div>

      {aba === "entrar" && (
        <form onSubmit={entrar}>
          <label className="campo"><span className="rotulo">E-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com" autoComplete="email" />
          </label>
          <label className="campo"><span className="rotulo">Senha</span>
            <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password" />
          </label>
          <button className="btn" disabled={ocupado} style={{ width: "100%" }}>{ocupado ? "Entrando" : "Entrar"}</button>
          <button type="button" className="btn claro" disabled={ocupado} style={{ width: "100%", marginTop: 8 }} onClick={recuperar}>
            Esqueci a senha
          </button>
          <p className="mudo" style={{ marginTop: 14 }}>
            É seu primeiro acesso?{" "}
            <button type="button" onClick={() => { setAba("criar"); setAviso(null); }}
              style={{ background: "none", border: 0, padding: 0, textDecoration: "underline", color: "inherit", font: "inherit" }}>
              Defina sua senha aqui
            </button>.
          </p>
        </form>
      )}

      {aba === "criar" && (
        <form onSubmit={criarSenha}>
          <label className="campo"><span className="rotulo">E-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com" autoComplete="email" />
          </label>
          <label className="campo"><span className="rotulo">Senha nova</span>
            <input type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password" />
          </label>
          <button className="btn" disabled={ocupado} style={{ width: "100%" }}>{ocupado ? "Definindo" : "Definir senha"}</button>
          <button type="button" className="btn claro" style={{ width: "100%", marginTop: 8 }} onClick={() => { setAba("entrar"); setAviso(null); }}>
            Voltar
          </button>
          <p className="mudo">Mínimo de 8 caracteres. Senhas que já vazaram em outros sites são recusadas.</p>
        </form>
      )}

      {aba === "pedir" && (
        <form onSubmit={pedirAcesso}>
          <label className="campo"><span className="rotulo">E-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com" autoComplete="email" />
          </label>
          <label className="campo"><span className="rotulo">Seu nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
          </label>
          <label className="campo"><span className="rotulo">Para que você precisa</span>
            <input value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="opcional" />
          </label>
          <button className="btn" disabled={ocupado} style={{ width: "100%" }}>{ocupado ? "Enviando" : "Pedir acesso"}</button>
        </form>
      )}

      {aviso && <div className={"aviso " + aviso.tipo}>{aviso.texto}</div>}
    </div></div>
  );
}
