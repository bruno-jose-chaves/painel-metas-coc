"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, dataCurta } from "@/lib/formato";
import Ajuda from "@/components/Ajuda";

type Venda = {
  chave: string; numero: string | null; data: string; vendedor: string | null; status: string | null;
  nome: string | null; curso: string | null; material: string | null; valor_tabela: number | null;
  desconto_pct: number | null; valor_venda: number | null; cidade: string | null; estado: string | null;
  campanha_id: string | null;
};
type Campanha = { id: string; nome: string };

const PAGINA = 100;

export default function Vendas({ embutido }: { embutido?: boolean } = {}) {
  const { volta, em, minutos } = useAtualizacao();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [campanha, setCampanha] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [status, setStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<Venda[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    supabase.from("campanhas").select("id,nome").order("inicio").then(({ data }) => {
      const lista = (data as Campanha[]) ?? [];
      setCampanhas(lista);
      if (lista.length) setCampanha(lista[lista.length - 1].id);
    });
  }, [volta]);

  useEffect(() => { setPagina(0); }, [campanha, vendedor, status, busca, volta]);

  useEffect(() => {
    if (!campanha) return;
    let q = supabase
      .from("vendas")
      .select("chave,numero,data,vendedor,status,nome,curso,material,valor_tabela,desconto_pct,valor_venda,cidade,estado,campanha_id",
        { count: "exact" })
      .eq("campanha_id", campanha);
    if (vendedor) q = q.eq("vendedor", vendedor);
    if (status === "ativos") q = q.not("status", "ilike", "cancel%");
    else if (status === "cancelados") q = q.ilike("status", "cancel%");
    else if (status) q = q.eq("status", status);
    if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
    q.order("data", { ascending: false }).order("numero", { ascending: false })
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1)
      .then(({ data, count }) => { setLinhas((data as Venda[]) ?? []); setTotal(count ?? 0); });
  }, [campanha, vendedor, status, busca, pagina, volta]);

  // Totais da seleção inteira, não só da página visível.
  const [resumo, setResumo] = useState<{ alunos: number; faturamento: number; tabela: number } | null>(null);
  useEffect(() => {
    if (!campanha) return;
    setResumo(null);
    let q = supabase.from("vendas").select("valor_venda,valor_tabela,status,vendedor,nome").eq("campanha_id", campanha);
    if (vendedor) q = q.eq("vendedor", vendedor);
    if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
    q.then(({ data }) => {
      const todas = (data as { valor_venda: number | null; valor_tabela: number | null; status: string | null }[]) ?? [];
      const filtra = (v: { status: string | null }) => {
        const cancel = (v.status ?? "").toLowerCase().startsWith("cancel");
        if (status === "ativos") return !cancel;
        if (status === "cancelados") return cancel;
        if (status) return v.status === status;
        return true;
      };
      const sel = todas.filter(filtra);
      setResumo({
        alunos: sel.length,
        faturamento: sel.reduce((s, v) => s + Number(v.valor_venda ?? 0), 0),
        tabela: sel.reduce((s, v) => s + Number(v.valor_tabela ?? 0), 0),
      });
    });
  }, [campanha, vendedor, status, busca, volta]);

  const vendedores = useMemo(() => {
    const s = new Set((linhas ?? []).map((l) => l.vendedor).filter(Boolean) as string[]);
    return [...s].sort();
  }, [linhas, volta]);

  const statusUnicos = useMemo(() => {
    const s = new Set((linhas ?? []).map((l) => l.status).filter(Boolean) as string[]);
    return [...s].sort();
  }, [linhas, volta]);

  const paginas = Math.ceil(total / PAGINA);

  return (
    <>
      {!embutido && (
        <>
          <div className="rotulo">Vendas</div>
          <h1>Matrícula por matrícula</h1>
          <p className="carimbo num">
            Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
          </p>
        </>
      )}

      <div className="filtros">
        <label>
          <span className="rotulo">Campanha</span>
          <select value={campanha} onChange={(e) => setCampanha(e.target.value)}>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label>
          <span className="rotulo">Vendedor</span>
          <select value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
            <option value="">Todos</option>
            {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>
          <span className="rotulo">Situação</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            <option value="ativos">Só ativos</option>
            <option value="cancelados">Só cancelados</option>
            {statusUnicos.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ flex: 1, minWidth: 180 }}>
          <span className="rotulo">Buscar aluno</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome do aluno" />
        </label>
      </div>

      <div className="faixa">
        <div><div className="rotulo">Alunos na seleção</div><div className="valor num">{resumo ? num(resumo.alunos) : "..."}</div></div>
        <div><div className="rotulo">Faturamento</div><div className="valor num">{resumo ? brl(resumo.faturamento) : "..."}</div></div>
        <div>
          <div className="rotulo">Ticket médio</div>
          <div className="valor num">{resumo && resumo.alunos ? brl(resumo.faturamento / resumo.alunos) : "-"}</div>
        </div>
        <div>
          <div className="rotulo">Desconto médio</div>
          <div className="valor num">{resumo && resumo.tabela ? pct(1 - resumo.faturamento / resumo.tabela) : "-"}</div>
        </div>
      </div>

      <h2><span className="idx" /> Lançamentos</h2>
      <p className="nota">
        A planilha comercial como o painel a leu, linha por linha. Serve para conferir uma venda
        específica: se o número da tela parecer errado, é aqui que se vê o que entrou de fato.
        <Ajuda titulo="O que cada coluna é"
          fontes={["Tudo nesta tabela vem da planilha comercial, aba Vendas do ano",
                   "Produto: o curso da planilha, apontado para produto em Ajustes, Cursos",
                   "Turma e campanha: resolvidas pela data da venda contra a janela de cada uma"]}>
          <b>#</b> é o número da linha na própria planilha, que é por onde se acha a venda lá.
          <b> Venda automática</b> é a matrícula que entrou sem vendedor na planilha: é a compra que o
          aluno fez sozinho pelo site. Ela conta no faturamento e fica fora do ranking e da comissão, de
          propósito, porque não houve ninguém para creditar. <b>Valor</b> é o valor cheio da matrícula no
          dia em que foi lançada, não a parcela paga.
          Matrícula com condição cancelada aparece na lista e fica fora de toda contagem do painel.
          E-mail, telefone e responsável financeiro ficam fora desta tela de propósito: quem precisa desse
          dado usa a planilha ou o CRM.
        </Ajuda>
      </p>
      {!linhas ? <p className="rotulo">Carregando</p> : linhas.length === 0 ? (
        <p className="mudo">Nenhuma venda com esses filtros.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th className="n">#</th><th>Data</th><th>Aluno</th><th>Curso</th><th>Vendedor</th>
                <th>Situação</th><th className="n">Tabela</th><th className="n">Desconto</th>
                <th className="n">Venda</th><th>Cidade</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const cancel = (l.status ?? "").toLowerCase().startsWith("cancel");
                return (
                  <tr key={l.chave} style={cancel ? { opacity: 0.5 } : undefined}>
                    <td className="n mudo">{l.numero ?? "-"}</td>
                    <td className="num">{dataCurta(l.data)}</td>
                    <td>{l.nome ?? "-"}</td>
                    <td className="mudo">{l.curso ?? "-"}{l.material ? ` · ${l.material}` : ""}</td>
                    <td>
                      {l.vendedor ?? <span className="mudo">Venda automática</span>}
                    </td>
                    <td>{l.status ?? "-"}</td>
                    <td className="n">{brl(l.valor_tabela, 2)}</td>
                    <td className="n">{pct(descontoDe(l))}</td>
                    <td className="n"><b>{brl(l.valor_venda, 2)}</b></td>
                    <td className="mudo">{l.cidade ?? "-"}{l.estado ? `/${l.estado}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <div className="atalhos" style={{ marginTop: 16 }}>
          <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <span className="mudo num" style={{ padding: "7px 10px" }}>
            Página {pagina + 1} de {paginas} · {num(total)} registros
          </span>
          <button disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
        </div>
      )}
    </>
  );
}

// A planilha quase nunca traz a coluna de desconto preenchida: 250 das 272
// matrículas das campanhas de 2026 vinham sem ela, embora a venda esteja abaixo
// da tabela. Quando falta, calcula pela diferença entre tabela e venda, que é a
// mesma conta usada no desconto médio do topo da tela.
function descontoDe(l: Venda) {
  if (l.desconto_pct != null) return Number(l.desconto_pct);
  const tabela = Number(l.valor_tabela ?? 0);
  const venda = Number(l.valor_venda ?? 0);
  if (!tabela || venda >= tabela) return null;
  return (tabela - venda) / tabela;
}
