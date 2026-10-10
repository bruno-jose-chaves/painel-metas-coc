"use client";
import { useEffect, useState } from "react";
import { supabase, SUPABASE_URL } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import { dataHora, dataCurta, num } from "@/lib/formato";

type Status = { servico: string; app_configurado: boolean; conectado: boolean; expira_em: string | null; atualizado_em: string | null };
type Sync = { id: number; fonte: string; terminado_em: string | null; lidas: number; importadas: number; rejeitadas: number; status: string };
type Usuario = { email: string; nome: string | null; papel: string };
type Pedido = { email: string; nome: string | null; mensagem: string | null; criada_em: string; situacao: string };

const NOMES: Record<string, string> = { rd_crm: "RD Station CRM", rd_marketing: "RD Station Marketing", planilha: "Planilha Coc Online - Comercial" };
const ROTA: Record<string, string> = { rd_crm: "crm", rd_marketing: "marketing" };

type Cobertura = {
  de: string | null; ate: string | null;
  dias_cobertos: number; dias_faltando: number;
  buraco_de: string | null; buraco_ate: string | null;
};

function AppRD({ servico, status, recarregar }: { servico: "rd_crm" | "rd_marketing"; status?: Status; recarregar: () => void }) {
  const [cid, setCid] = useState("");
  const [sec, setSec] = useState("");
  const [msg, setMsg] = useState("");
  const callback = `${SUPABASE_URL}/functions/v1/rd-oauth/${ROTA[servico]}/callback`;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("rd_configurar_app", { p_servico: servico, p_client_id: cid.trim(), p_client_secret: sec.trim() });
    setMsg(error ? error.message : "Credenciais salvas.");
    if (!error) { setCid(""); setSec(""); recarregar(); }
  }
  async function conectar() {
    const { error } = await supabase.rpc("rd_iniciar_conexao", { p_servico: servico });
    if (error) { setMsg(error.message); return; }
    window.location.href = `${SUPABASE_URL}/functions/v1/rd-oauth/${ROTA[servico]}/iniciar`;
  }

  return (
    <div className="bloco">
      <div className="card-top">
        <div><div className="rotulo">{servico === "rd_crm" ? "003" : "004"}</div><h3 style={{ margin: "4px 0" }}>{NOMES[servico]}</h3></div>
        <span className={"selo " + (status?.conectado ? "no_ritmo" : "nao_iniciada")}>{status?.conectado ? "Conectado" : status?.app_configurado ? "App cadastrado" : "Pendente"}</span>
      </div>
      <p className="mudo">URL de callback para cadastrar no App Publisher do RD:</p>
      <code style={{ display: "block", wordBreak: "break-all", padding: 10, border: "1px solid var(--linha)", background: "var(--superficie)", fontSize: 13 }}>{callback}</code>
      <form onSubmit={salvar} style={{ marginTop: 16 }}>
        <label className="campo"><span className="rotulo">client_id</span><input value={cid} onChange={(e) => setCid(e.target.value)} required autoComplete="off" /></label>
        <label className="campo"><span className="rotulo">client_secret</span><input value={sec} onChange={(e) => setSec(e.target.value)} required type="password" autoComplete="off" /></label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn claro">Salvar credenciais</button>
          <button type="button" className="btn" onClick={conectar} disabled={!status?.app_configurado}>Conectar ao RD</button>
        </div>
      </form>
      {msg && <div className="aviso">{msg}</div>}
      {status?.conectado && <p className="mudo">Conectado em {dataHora(status.atualizado_em)}.</p>}
    </div>
  );
}

export default function Configuracao({ admin }: { admin: boolean }) {
  const [status, setStatus] = useState<Status[]>([]);
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [syncs, setSyncs] = useState<Sync[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novo, setNovo] = useState({ email: "", nome: "", papel: "leitor", senha: "" });
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [n8n, setN8n] = useState({ url: "https://n8n.coconline.com.br", chave: "" });
  const [n8nMsg, setN8nMsg] = useState("");
  const [enderecoConversas, setEnderecoConversas] = useState("");
  const [pigeon, setPigeon] = useState({ url: "api.pigeon.runus.com.br", chave: "" });
  const [pigeonMsg, setPigeonMsg] = useState("");
  const [rascunho, setRascunho] = useState({ email: "", nome: "", papel: "leitor", senha: "" });
  const [retorno, setRetorno] = useState<{ tipo: string; msg: string } | null>(null);

  const carregar = () => {
    supabase.rpc("integracoes_status").then(({ data }) => setStatus((data as Status[]) ?? []));
    supabase.rpc("painel_cobertura_marketing")
      .then(({ data }) => setCobertura(((data as Cobertura[]) ?? [])[0] ?? null));
    supabase.from("sincronizacoes").select("*").order("id", { ascending: false }).limit(15).then(({ data }) => setSyncs((data as Sync[]) ?? []));
    supabase.from("usuarios_autorizados").select("email,nome,papel").order("email").then(({ data }) => setUsuarios((data as Usuario[]) ?? []));
    supabase.from("solicitacoes_acesso").select("email,nome,mensagem,criada_em,situacao")
      .eq("situacao", "pendente").order("criada_em", { ascending: false })
      .then(({ data }) => setPedidos((data as Pedido[]) ?? []));
  };
  useEffect(() => {
    carregar();
    const q = new URLSearchParams(window.location.search);
    if (q.get("rd") === "ok") setRetorno({ tipo: "ok", msg: `Conexão com o RD Station ${q.get("msg") === "crm" ? "CRM" : "Marketing"} concluída.` });
    if (q.get("rd") === "erro") setRetorno({ tipo: "erro", msg: q.get("msg") ?? "Não foi possível conectar." });
  }, []);

  async function adicionarSemSenha() {
    const { error } = await supabase.from("usuarios_autorizados").insert({ email: novo.email.trim().toLowerCase(), nome: novo.nome || null, papel: novo.papel });
    if (error) alert(error.message); else { setNovo({ email: "", nome: "", papel: "leitor", senha: "" }); carregar(); }
  }
  async function salvarPigeon(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("integracao_configurar", {
      p_servico: "pigeon", p_base_url: pigeon.url, p_token: pigeon.chave,
    });
    setPigeonMsg(error ? error.message : "Token guardado. Já consigo consultar o Pigeon Post.");
    if (!error) setPigeon({ ...pigeon, chave: "" });
  }

  async function mostrarEndereco() {
    const { data, error } = await supabase.rpc("endereco_conversas");
    if (error) { setN8nMsg(error.message); return; }
    setEnderecoConversas(String(data ?? ""));
  }

  async function salvarN8n(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("n8n_configurar", { p_base_url: n8n.url, p_chave: n8n.chave });
    setN8nMsg(error ? error.message : "Chave guardada. O painel já consegue ler o n8n.");
    if (!error) setN8n({ ...n8n, chave: "" });
  }

  async function chamarAdmin(corpo: Record<string, unknown>) {
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.session?.access_token ?? ""}`,
      },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.erro) throw new Error(j.erro ?? "falha na operação");
    return j;
  }

  async function salvarEdicao(original: string) {
    try {
      if (rascunho.email && rascunho.email !== original) {
        await chamarAdmin({ acao: "trocar_email", email: original, email_novo: rascunho.email });
      }
      const alvo = rascunho.email || original;
      const { error } = await supabase.from("usuarios_autorizados")
        .update({ nome: rascunho.nome || null, papel: rascunho.papel }).eq("email", alvo);
      if (error) throw new Error(error.message);
      if (rascunho.senha) await chamarAdmin({ acao: "senha", email: alvo, senha: rascunho.senha });
      setEditando(null);
      setRascunho({ email: "", nome: "", papel: "leitor", senha: "" });
      carregar();
    } catch (e) {
      alert(String((e as Error).message));
    }
  }

  async function criarComSenha() {
    try {
      await chamarAdmin({ acao: "criar", email: novo.email, nome: novo.nome || null, papel: novo.papel, senha: novo.senha });
      setNovo({ email: "", nome: "", papel: "leitor", senha: "" });
      carregar();
      alert("Conta criada. Passe a senha para a pessoa e peça que troque depois de entrar.");
    } catch (e) {
      alert(String((e as Error).message));
    }
  }

  async function aprovar(email: string, papel: string) {
    const { error } = await supabase.rpc("aprovar_acesso", { p_email: email, p_papel: papel });
    if (error) alert(error.message); else carregar();
  }
  async function recusar(email: string) {
    const { error } = await supabase.from("solicitacoes_acesso")
      .update({ situacao: "recusada", respondida_em: new Date().toISOString() }).eq("email", email);
    if (error) alert(error.message); else carregar();
  }
  async function remover(email: string) {
    if (!confirm(`Remover o acesso de ${email}?`)) return;
    await supabase.from("usuarios_autorizados").delete().eq("email", email);
    carregar();
  }
  const st = (s: string) => status.find((x) => x.servico === s);

  return (
    <>
      <div className="rotulo">Configuração</div>
      <h1>Integrações e acessos</h1>
      {retorno && <div className={"aviso " + retorno.tipo}>{retorno.msg}</div>}

      <h2><span className="idx">001</span> Planilha de vendas</h2>
      <div className="bloco">
        <p style={{ marginTop: 0 }}>Envio automático a cada 15 minutos pelo script instalado na própria planilha.</p>
        <div className="rolar"><table className="tabela">
          <thead><tr><th>Fonte</th><th>Quando</th><th>Linhas</th><th>Importadas</th><th>Rejeitadas</th><th>Status</th></tr></thead>
          <tbody>
            {syncs.length === 0 && <tr><td colSpan={6} className="mudo">Nenhuma sincronização ainda.</td></tr>}
            {syncs.map((s) => (
              <tr key={s.id}><td>{(s.fonte ?? "").replace("planilha:", "")}</td><td className="num">{dataHora(s.terminado_em)}</td>
                <td className="num">{num(s.lidas)}</td><td className="num">{num(s.importadas)}</td><td className="num">{num(s.rejeitadas)}</td><td>{s.status}</td></tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <h2><span className="idx">002</span> RD Station</h2>
      {admin ? (
        <>
          <AppRD servico="rd_crm" status={st("rd_crm")} recarregar={carregar} />
          <AppRD servico="rd_marketing" status={st("rd_marketing")} recarregar={carregar} />
        </>
      ) : <p className="mudo">Somente administradores configuram integrações.</p>}

      <h2><span className="idx">005</span> n8n</h2>
      <div className="bloco">
        <div className="card-top">
          <div><h3 style={{ margin: "4px 0" }}>Automações do n8n</h3></div>
          <span className={"selo " + (st("n8n")?.conectado ? "no_ritmo" : "nao_iniciada")}>
            {st("n8n")?.conectado ? "Conectado" : "Pendente"}
          </span>
        </div>
        <p className="mudo">
          A chave de API fica guardada no banco e nunca aparece na tela depois de salva. Ela é só de leitura do lado do
          painel: nada aqui dispara ou altera fluxo seu. No n8n, a chave se cria em Settings e depois n8n API.
        </p>
        {admin ? (
          <form onSubmit={salvarN8n} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: 12, alignItems: "end" }}>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">Endereço</span>
              <input value={n8n.url} onChange={(e) => setN8n({ ...n8n, url: e.target.value })} /></label>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">Chave de API</span>
              <input type="password" value={n8n.chave} onChange={(e) => setN8n({ ...n8n, chave: e.target.value })}
                placeholder="cole aqui" autoComplete="off" /></label>
            <button className="btn" disabled={!n8n.chave}>Salvar chave</button>
          </form>
        ) : <p className="mudo">Somente administradores configuram integrações.</p>}
        {n8nMsg && <div className="aviso ok">{n8nMsg}</div>}

      </div>

      <h2><span className="idx">006</span> Pigeon Post</h2>
      <div className="bloco">
        <div className="card-top">
          <div><h3 style={{ margin: "4px 0" }}>Conversas com clientes</h3></div>
          <span className={"selo " + (st("pigeon")?.conectado ? "no_ritmo" : "nao_iniciada")}>
            {st("pigeon")?.conectado ? "Conectado" : "Pendente"}
          </span>
        </div>
        <p className="mudo">
          Token permanente do Pigeon Post, do tipo Bearer. Fica guardado no banco e não aparece mais na tela depois de
          salvo. A leitura é só de consulta: nada no painel envia mensagem nem altera conversa.
        </p>
        {admin ? (
          <form onSubmit={salvarPigeon} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: 12, alignItems: "end" }}>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">Endereço base</span>
              <input value={pigeon.url} onChange={(e) => setPigeon({ ...pigeon, url: e.target.value })} /></label>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">Token permanente</span>
              <input type="password" value={pigeon.chave} onChange={(e) => setPigeon({ ...pigeon, chave: e.target.value })}
                placeholder="pn_..." autoComplete="off" /></label>
            <button className="btn" disabled={!pigeon.chave}>Salvar token</button>
          </form>
        ) : <p className="mudo">Somente administradores configuram integrações.</p>}
        {pigeonMsg && <div className="aviso ok">{pigeonMsg}</div>}

        {admin && (
          <>
            <h3 style={{ fontSize: 15, margin: "24px 0 4px" }}>Endereço para receber as conversas</h3>
            <p className="mudo">
              Clique em Mostrar endereço e copie o que aparecer. Esse é o endereço do painel: é ele que vai no campo
              <b> Url</b> quando você cria um webhook no Pigeon Post, ou num nó HTTP Request do n8n no fim do fluxo,
              método POST, enviando o item inteiro. Ele guarda tudo que chegar, mesmo antes de a gente mapear os campos.
            </p>
            {enderecoConversas ? (
              <code style={{ display: "block", wordBreak: "break-all", padding: 10, border: "1px solid var(--linha)", background: "var(--superficie)", fontSize: 13 }}>
                {enderecoConversas}
              </code>
            ) : (
              <button className="btn claro" onClick={mostrarEndereco}>Mostrar endereço</button>
            )}
            {enderecoConversas && (
              <p className="mudo">Esse endereço contém a chave de acesso. Trate como senha e não publique.</p>
            )}
          </>
        )}
      </div>

      <h2><span className="idx">007</span> Cobertura do RD Marketing</h2>
      <p className="nota">
        As conversões do RD Marketing vêm dia a dia, e dia que não foi buscado não aparece em lugar nenhum.
        <Ajuda titulo="Por que isso importa"
          fontes={["Dias já buscados: tabela rd_mkt_dias",
                   "Conversões: tabela rd_conversoes_diarias"]}>
          Um buraco aqui faz todo número de captação do período ficar por baixo, sem erro visível em lugar
          nenhum. Por isso a cobertura é acompanhada dia a dia e o buraco vira aviso na estrela.
        </Ajuda>
      </p>
      {!cobertura ? <p className="rotulo">Carregando</p> : (
        <div className="faixa">
          <div>
            <div className="rotulo">Dias cobertos</div>
            <div className="valor num">{num(cobertura.dias_cobertos)}</div>
            <div className="mudo num">{dataCurta(cobertura.de)} a {dataCurta(cobertura.ate)}</div>
          </div>
          <div>
            <div className="rotulo">Dias na fila</div>
            <div className="valor num">{num(cobertura.dias_faltando)}</div>
            <div className="mudo">
              {Number(cobertura.dias_faltando) === 0
                ? "nada faltando"
                : "a importação busca 25 por volta, a cada cinco minutos"}
            </div>
          </div>
          {Number(cobertura.dias_faltando) > 0 && (
            <div>
              <div className="rotulo">Mais recente faltando</div>
              <div className="valor num">{dataCurta(cobertura.buraco_ate)}</div>
              <div className="mudo">a fila começa pelo mais novo</div>
            </div>
          )}
        </div>
      )}

      <h2><span className="idx">003</span> Pedidos de acesso</h2>
      {!pedidos ? <p className="rotulo">Carregando</p> : pedidos.length === 0 ? (
        <p className="mudo">Nenhum pedido esperando resposta.</p>
      ) : (
        <div className="bloco">
          <div className="rolar"><table className="tabela">
            <thead><tr><th>E-mail</th><th>Nome</th><th>Para quê</th><th>Quando</th>{admin && <th>Liberar</th>}</tr></thead>
            <tbody>{pedidos.map((p) => (
              <tr key={p.email}>
                <td>{p.email}</td>
                <td>{p.nome ?? "-"}</td>
                <td className="mudo">{p.mensagem ?? "-"}</td>
                <td className="num">{dataHora(p.criada_em)}</td>
                {admin && (
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="sair" onClick={() => aprovar(p.email, "leitor")}>Leitor</button>{" "}
                    <button className="sair" onClick={() => aprovar(p.email, "admin")}>Admin</button>{" "}
                    <button className="sair" onClick={() => recusar(p.email)}>Recusar</button>
                  </td>
                )}
              </tr>
            ))}</tbody>
          </table></div>
          {!admin && <p className="mudo">Somente administradores liberam acesso.</p>}
        </div>
      )}

      <h2><span className="idx">004</span> Quem acessa</h2>
      <div className="bloco">
        <div className="rolar"><table className="tabela">
          <thead>
            <tr><th>E-mail</th><th>Nome</th><th>Papel</th><th>Senha nova</th>{admin && <th></th>}</tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              editando === u.email ? (
                <tr key={u.email} className="destaque">
                  <td><input type="email" value={rascunho.email} style={{ width: 230 }}
                    onChange={(e) => setRascunho({ ...rascunho, email: e.target.value })} /></td>
                  <td><input value={rascunho.nome} style={{ width: 150 }}
                    onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} /></td>
                  <td>
                    <select value={rascunho.papel} onChange={(e) => setRascunho({ ...rascunho, papel: e.target.value })}>
                      <option value="leitor">Leitor</option><option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td><input type="text" value={rascunho.senha} placeholder="deixe vazio para manter" style={{ width: 170 }}
                    onChange={(e) => setRascunho({ ...rascunho, senha: e.target.value })} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="sair" onClick={() => salvarEdicao(u.email)}>Salvar</button>{" "}
                    <button className="sair" onClick={() => setEditando(null)}>Cancelar</button>
                  </td>
                </tr>
              ) : (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{u.nome ?? "-"}</td>
                  <td>{u.papel === "admin" ? "Administrador" : "Leitor"}</td>
                  <td className="mudo">-</td>
                  {admin && (
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="sair" onClick={() => {
                        setEditando(u.email);
                        setRascunho({ email: u.email, nome: u.nome ?? "", papel: u.papel, senha: "" });
                      }}>Editar</button>{" "}
                      <button className="sair" onClick={() => remover(u.email)}>Remover</button>
                    </td>
                  )}
                </tr>
              )
            ))}
          </tbody>
        </table></div>

        {admin && (
          <>
            <p className="rodape">
              Para liberar alguém, crie a conta já com uma senha e entregue essa senha à pessoa. É o caminho mais direto
              enquanto o envio de e-mail não estiver configurado em servidor próprio.
            </p>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginTop: 8, alignItems: "end" }}>
              <label className="campo" style={{ margin: 0 }}><span className="rotulo">E-mail</span>
                <input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></label>
              <label className="campo" style={{ margin: 0 }}><span className="rotulo">Nome</span>
                <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></label>
              <label className="campo" style={{ margin: 0 }}><span className="rotulo">Papel</span>
                <select value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value })}
                  style={{ font: "inherit", padding: 10, border: "1px solid var(--tinta)" }}>
                  <option value="leitor">Leitor</option><option value="admin">Administrador</option>
                </select></label>
              <label className="campo" style={{ margin: 0 }}><span className="rotulo">Senha inicial</span>
                <input value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} placeholder="mínimo 8" /></label>
              <button className="btn" onClick={criarComSenha} disabled={!novo.email || novo.senha.length < 8}>Criar conta</button>
            </div>
            <button className="btn claro" style={{ marginTop: 12 }} onClick={adicionarSemSenha} disabled={!novo.email}>
              Só liberar o e-mail, sem criar senha
            </button>
          </>
        )}
      </div>
    </>
  );
}
