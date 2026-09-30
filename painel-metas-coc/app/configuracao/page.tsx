"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase, SUPABASE_URL } from "@/lib/supabase";
import { dataHora, num } from "@/lib/formato";

type Status = { servico: string; app_configurado: boolean; conectado: boolean; expira_em: string | null; atualizado_em: string | null };
type Sync = { id: number; fonte: string; terminado_em: string | null; lidas: number; importadas: number; rejeitadas: number; status: string };
type Usuario = { email: string; nome: string | null; papel: string };

const NOMES: Record<string, string> = { rd_crm: "RD Station CRM", rd_marketing: "RD Station Marketing", planilha: "Planilha Coc Online - Comercial" };
const ROTA: Record<string, string> = { rd_crm: "crm", rd_marketing: "marketing" };

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
      <code style={{ display: "block", wordBreak: "break-all", padding: 10, border: "1px solid var(--linha)", background: "#fff", fontSize: 13 }}>{callback}</code>
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

function Config({ admin }: { admin: boolean }) {
  const [status, setStatus] = useState<Status[]>([]);
  const [syncs, setSyncs] = useState<Sync[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novo, setNovo] = useState({ email: "", nome: "", papel: "leitor" });
  const [retorno, setRetorno] = useState<{ tipo: string; msg: string } | null>(null);

  const carregar = () => {
    supabase.rpc("integracoes_status").then(({ data }) => setStatus((data as Status[]) ?? []));
    supabase.from("sincronizacoes").select("*").order("id", { ascending: false }).limit(15).then(({ data }) => setSyncs((data as Sync[]) ?? []));
    supabase.from("usuarios_autorizados").select("email,nome,papel").order("email").then(({ data }) => setUsuarios((data as Usuario[]) ?? []));
  };
  useEffect(() => {
    carregar();
    const q = new URLSearchParams(window.location.search);
    if (q.get("rd") === "ok") setRetorno({ tipo: "ok", msg: `Conexão com o RD Station ${q.get("msg") === "crm" ? "CRM" : "Marketing"} concluída.` });
    if (q.get("rd") === "erro") setRetorno({ tipo: "erro", msg: q.get("msg") ?? "Não foi possível conectar." });
  }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("usuarios_autorizados").insert({ email: novo.email.trim().toLowerCase(), nome: novo.nome || null, papel: novo.papel });
    if (error) alert(error.message); else { setNovo({ email: "", nome: "", papel: "leitor" }); carregar(); }
  }
  async function remover(email: string) {
    if (!confirm(`Remover o acesso de ${email}?`)) return;
    await supabase.from("usuarios_autorizados").delete().eq("email", email);
    carregar();
  }
  const st = (s: string) => status.find((x) => x.servico === s);

  return (
    <>
      <div className="rotulo">006 · Configuração</div>
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
              <tr key={s.id}><td>{s.fonte.replace("planilha:", "")}</td><td className="num">{dataHora(s.terminado_em)}</td>
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

      <h2><span className="idx">003</span> Quem acessa</h2>
      <div className="bloco">
        <div className="rolar"><table className="tabela">
          <thead><tr><th>E-mail</th><th>Nome</th><th>Papel</th>{admin && <th></th>}</tr></thead>
          <tbody>{usuarios.map((u) => (
            <tr key={u.email}><td>{u.email}</td><td>{u.nome ?? "-"}</td><td>{u.papel}</td>
              {admin && <td><button className="sair" onClick={() => remover(u.email)}>Remover</button></td>}</tr>
          ))}</tbody>
        </table></div>
        {admin && (
          <form onSubmit={adicionar} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 16, alignItems: "end" }}>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">E-mail</span><input type="email" required value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></label>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">Nome</span><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></label>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">Papel</span>
              <select value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value })} style={{ font: "inherit", padding: 10, border: "1px solid var(--tinta)" }}>
                <option value="leitor">Leitor</option><option value="admin">Administrador</option>
              </select></label>
            <button className="btn">Liberar acesso</button>
          </form>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Config admin={admin} />}</Shell>;
}
