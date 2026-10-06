"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { brl, num, dataCurta } from "@/lib/formato";

type Campanha = {
  id: string; nome: string; produto_id: string; inicio: string; fim: string;
  meta_ativa: number; mercado_candidatos: number | null; vendas_desde: string | null;
  regra_curso: string | null; ativa: boolean;
};
type Produto = { id: string; nome: string };
type Meta = { nivel: number; alunos: number; faturamento: number };
type Fase = {
  ordem: number; nome: string; inicio: string; fim: string;
  preco: number; meta_alunos: number; bonus: string | null;
};

const vazia = (): Campanha => ({
  id: "", nome: "", produto_id: "metodo-acafe", inicio: "", fim: "",
  meta_ativa: 2, mercado_candidatos: null, vendas_desde: null, regra_curso: null, ativa: true,
});
const metasVazias = (): Meta[] => [0, 1, 2, 3].map((nivel) => ({ nivel, alunos: 0, faturamento: 0 }));
const faseVazia = (ordem: number): Fase =>
  ({ ordem, nome: "", inicio: "", fim: "", preco: 0, meta_alunos: 0, bonus: null });

function Editor({ admin }: { admin: boolean }) {
  const [lista, setLista] = useState<Campanha[] | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [sel, setSel] = useState<string>("");
  const [c, setC] = useState<Campanha>(vazia());
  const [metas, setMetas] = useState<Meta[]>(metasVazias());
  const [fases, setFases] = useState<Fase[]>([]);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => {
    supabase.from("campanhas").select("*").order("inicio", { ascending: false })
      .then(({ data }) => setLista((data as Campanha[]) ?? []));
    supabase.from("produtos").select("id,nome").order("ordem")
      .then(({ data }) => setProdutos((data as Produto[]) ?? []));
  };
  useEffect(carregar, []);

  async function abrir(id: string) {
    setSel(id); setAviso(null);
    if (!id) { setC(vazia()); setMetas(metasVazias()); setFases([]); return; }
    const atual = lista?.find((x) => x.id === id);
    if (atual) setC({ ...atual });
    const [{ data: m }, { data: f }] = await Promise.all([
      supabase.from("metas").select("nivel,alunos,faturamento").eq("campanha_id", id).order("nivel"),
      supabase.from("fases").select("ordem,nome,inicio,fim,preco,meta_alunos,bonus").eq("campanha_id", id).order("ordem"),
    ]);
    const base = metasVazias();
    for (const linha of (m as Meta[]) ?? []) base[linha.nivel] = linha;
    setMetas(base);
    setFases((f as Fase[]) ?? []);
  }

  async function salvar() {
    if (!c.id.trim() || !c.nome.trim() || !c.inicio || !c.fim) {
      setAviso({ tipo: "erro", texto: "Preencha código, nome e as duas datas." });
      return;
    }
    setOcupado(true); setAviso(null);
    const campanha = {
      ...c,
      id: c.id.trim(),
      mercado_candidatos: c.mercado_candidatos || null,
      vendas_desde: c.vendas_desde || null,
      regra_curso: c.regra_curso?.trim() || null,
    };
    const { error: e1 } = await supabase.from("campanhas").upsert(campanha);
    if (e1) { setOcupado(false); setAviso({ tipo: "erro", texto: e1.message }); return; }

    const { error: e2 } = await supabase.from("metas")
      .upsert(metas.map((m) => ({ ...m, campanha_id: campanha.id })));
    if (e2) { setOcupado(false); setAviso({ tipo: "erro", texto: e2.message }); return; }

    await supabase.from("fases").delete().eq("campanha_id", campanha.id);
    if (fases.length) {
      const { error: e3 } = await supabase.from("fases")
        .insert(fases.map((f, i) => ({ ...f, ordem: i + 1, campanha_id: campanha.id, bonus: f.bonus || null })));
      if (e3) { setOcupado(false); setAviso({ tipo: "erro", texto: e3.message }); return; }
    }
    setOcupado(false);
    setAviso({ tipo: "ok", texto: "Campanha salva." });
    carregar();
    setSel(campanha.id);
  }

  const somaFases = fases.reduce((s, f) => s + Number(f.meta_alunos || 0), 0);
  const metaAtiva = metas[c.meta_ativa];

  if (!admin) return <p className="mudo">Somente administradores editam campanhas.</p>;
  if (!lista) return <p className="rotulo">Carregando</p>;

  return (
    <>
      <div className="rotulo">001 · Campanhas</div>
      <h1>Cadastro de campanhas</h1>

      <div className="filtros">
        <label>
          <span className="rotulo">Campanha</span>
          <select value={sel} onChange={(e) => abrir(e.target.value)}>
            <option value="">Nova campanha</option>
            {lista.map((x) => (
              <option key={x.id} value={x.id}>{x.nome}{x.ativa ? "" : " (desligada)"}</option>
            ))}
          </select>
        </label>
        <button className="btn" disabled={ocupado} onClick={salvar} style={{ marginLeft: "auto" }}>
          {ocupado ? "Salvando" : "Salvar"}
        </button>
      </div>
      {aviso && <div className={"aviso " + aviso.tipo}>{aviso.texto}</div>}

      <h2><span className="idx">002</span> Dados da campanha</h2>
      <div className="bloco" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Código</span>
          <input value={c.id} disabled={!!sel} onChange={(e) => setC({ ...c, id: e.target.value })} placeholder="semi-2027-1" />
        </label>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Nome</span>
          <input value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} placeholder="Semi Extensivo 1º/2027" />
        </label>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Produto</span>
          <select value={c.produto_id} onChange={(e) => setC({ ...c, produto_id: e.target.value })}>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Primeiro dia de venda</span>
          <input type="date" value={c.inicio} onChange={(e) => setC({ ...c, inicio: e.target.value })} />
        </label>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Último dia de venda</span>
          <input type="date" value={c.fim} onChange={(e) => setC({ ...c, fim: e.target.value })} />
        </label>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Meta ativa</span>
          <select value={c.meta_ativa} onChange={(e) => setC({ ...c, meta_ativa: Number(e.target.value) })}>
            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>Meta {n}</option>)}
          </select>
        </label>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Mercado (candidatos)</span>
          <input type="number" value={c.mercado_candidatos ?? ""} onChange={(e) => setC({ ...c, mercado_candidatos: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Contar vendas desde</span>
          <input type="date" value={c.vendas_desde ?? ""} onChange={(e) => setC({ ...c, vendas_desde: e.target.value || null })} />
        </label>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Regra do curso</span>
          <input value={c.regra_curso ?? ""} onChange={(e) => setC({ ...c, regra_curso: e.target.value })} placeholder="acaf.*/\\s*2" />
        </label>
        <label className="campo" style={{ margin: 0 }}><span className="rotulo">Situação</span>
          <select value={c.ativa ? "1" : "0"} onChange={(e) => setC({ ...c, ativa: e.target.value === "1" })}>
            <option value="1">Ligada</option><option value="0">Desligada</option>
          </select>
        </label>
      </div>
      <p className="mudo">
        O último dia de venda é uma semana depois do início das aulas. A regra do curso diz quais linhas da planilha
        pertencem a esta campanha, comparando com o nome do curso; em branco, vale a regra do produto.
      </p>

      <h2><span className="idx">003</span> Metas</h2>
      <div className="rolar">
        <table className="tabela">
          <thead><tr><th>Nível</th><th className="n">Alunos</th><th className="n">Faturamento</th><th className="n">Ticket implícito</th></tr></thead>
          <tbody>
            {metas.map((m, i) => (
              <tr key={m.nivel} className={m.nivel === c.meta_ativa ? "destaque" : undefined}>
                <td><b>Meta {m.nivel}</b>{m.nivel === c.meta_ativa && <div className="rotulo">Ativa</div>}</td>
                <td className="n">
                  <input type="number" value={m.alunos} style={{ width: 110, textAlign: "right" }}
                    onChange={(e) => { const v = [...metas]; v[i] = { ...m, alunos: Number(e.target.value) }; setMetas(v); }} />
                </td>
                <td className="n">
                  <input type="number" step="0.01" value={m.faturamento} style={{ width: 140, textAlign: "right" }}
                    onChange={(e) => { const v = [...metas]; v[i] = { ...m, faturamento: Number(e.target.value) }; setMetas(v); }} />
                </td>
                <td className="n">{m.alunos > 0 ? brl(m.faturamento / m.alunos) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2><span className="idx">004</span> Fases e escada de preço</h2>
      <div className="rolar">
        <table className="tabela">
          <thead>
            <tr><th>#</th><th>Nome</th><th>Início</th><th>Fim</th><th className="n">Preço</th><th className="n">Meta de alunos</th><th>Bônus</th><th /></tr>
          </thead>
          <tbody>
            {fases.map((f, i) => (
              <tr key={i}>
                <td className="num mudo">{i + 1}</td>
                <td><input value={f.nome} style={{ width: 170 }} onChange={(e) => { const v = [...fases]; v[i] = { ...f, nome: e.target.value }; setFases(v); }} /></td>
                <td><input type="date" value={f.inicio} onChange={(e) => { const v = [...fases]; v[i] = { ...f, inicio: e.target.value }; setFases(v); }} /></td>
                <td><input type="date" value={f.fim} onChange={(e) => { const v = [...fases]; v[i] = { ...f, fim: e.target.value }; setFases(v); }} /></td>
                <td className="n"><input type="number" step="0.01" value={f.preco} style={{ width: 100, textAlign: "right" }} onChange={(e) => { const v = [...fases]; v[i] = { ...f, preco: Number(e.target.value) }; setFases(v); }} /></td>
                <td className="n"><input type="number" value={f.meta_alunos} style={{ width: 90, textAlign: "right" }} onChange={(e) => { const v = [...fases]; v[i] = { ...f, meta_alunos: Number(e.target.value) }; setFases(v); }} /></td>
                <td><input value={f.bonus ?? ""} style={{ width: 180 }} onChange={(e) => { const v = [...fases]; v[i] = { ...f, bonus: e.target.value }; setFases(v); }} /></td>
                <td><button className="sair" onClick={() => setFases(fases.filter((_, j) => j !== i))}>Remover</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Soma das fases</td>
              <td className="n">{num(somaFases)}</td>
              <td colSpan={2} className="mudo">
                {metaAtiva && somaFases !== metaAtiva.alunos
                  ? `difere da Meta ${c.meta_ativa} (${num(metaAtiva.alunos)})`
                  : "bate com a meta ativa"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button className="btn claro" style={{ marginTop: 12 }} onClick={() => setFases([...fases, faseVazia(fases.length + 1)])}>
        Adicionar fase
      </button>

      <h2><span className="idx">005</span> Campanhas cadastradas</h2>
      <div className="rolar">
        <table className="tabela">
          <thead><tr><th>Nome</th><th>Produto</th><th>Venda</th><th className="n">Meta ativa</th><th>Situação</th></tr></thead>
          <tbody>
            {lista.map((x) => (
              <tr key={x.id}>
                <td><b>{x.nome}</b><div className="rotulo">{x.id}</div></td>
                <td className="mudo">{produtos.find((p) => p.id === x.produto_id)?.nome ?? x.produto_id}</td>
                <td className="num">{dataCurta(x.inicio)} a {dataCurta(x.fim)}</td>
                <td className="n">Meta {x.meta_ativa}</td>
                <td>{x.ativa ? "Ligada" : "Desligada"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Editor admin={admin} />}</Shell>;
}
