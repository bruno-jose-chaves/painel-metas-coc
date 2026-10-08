"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, dataCurta } from "@/lib/formato";

type Pendencia = {
  tipo: string; valor: string; volume: number; matriculas: number;
  primeira: string; ultima: string; sugestao: string | null;
};
type Campanha = { id: string; nome: string; produto_id: string | null };
type Regra = { id: number; campanha_id: string; indicador: string; tipo: string; valor: string };

const TIPO: Record<string, string> = { campanha_crm: "Campanha no CRM", formulario: "Formulário" };
const INDICADORES = [
  { id: "leads", nome: "Leads captados" },
  { id: "inscritos_lives", nome: "Inscritos nas lives" },
  { id: "reservas", nome: "Reservas" },
];

function Tela({ admin }: { admin: boolean }) {
  const { volta, em, minutos } = useAtualizacao();
  const [lista, setLista] = useState<Pendencia[] | null>(null);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [regras, setRegras] = useState<Regra[] | null>(null);
  const [aviso, setAviso] = useState("");
  const [tudo, setTudo] = useState(false);

  function carregar() {
    supabase.rpc("painel_pendencias", { p_desde: "2026-08-01", p_minimo: tudo ? 1 : 10 })
      .then(({ data }) => setLista((data as Pendencia[]) ?? []));
    supabase.from("captacao_regras").select("*").order("campanha_id")
      .then(({ data }) => setRegras((data as Regra[]) ?? []));
  }

  useEffect(() => {
    supabase.from("resumo_campanhas").select("id,nome,produto_id").order("inicio")
      .then(({ data }) => setCampanhas((data as Campanha[]) ?? []));
    carregar();
  }, [volta, tudo]);

  async function apontar(p: Pendencia, campanhaId: string, indicador: string) {
    const { error } = await supabase.from("captacao_regras").insert({
      campanha_id: campanhaId, indicador, tipo: p.tipo, valor: p.valor,
    });
    setAviso(error ? error.message : `"${p.valor}" passou a contar em ${indicador}.`);
    if (!error) carregar();
  }

  async function remover(id: number) {
    const { error } = await supabase.from("captacao_regras").delete().eq("id", id);
    setAviso(error ? error.message : "Regra removida.");
    if (!error) carregar();
  }

  const total = lista?.reduce((s, p) => s + Number(p.volume), 0) ?? 0;

  return (
    <>
      <div className="rotulo">020 · Pendências</div>
      <h1>O que falta classificar</h1>
      <p className="mudo num" style={{ marginTop: -8, marginBottom: 16 }}>
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <div className="faixa">
        <div>
          <div className="rotulo">Sem classificação</div>
          <div className="valor num">{lista ? num(total) : "..."}</div>
          <div className="mudo">leads e conversões</div>
        </div>
        <div>
          <div className="rotulo">Itens a apontar</div>
          <div className="valor num">{lista ? num(lista.length) : "..."}</div>
        </div>
        <div>
          <div className="rotulo">Regras já apontadas</div>
          <div className="valor num">{regras ? num(regras.length) : "..."}</div>
        </div>
      </div>

      <h2><span className="idx">021</span> Esperando a sua decisão</h2>
      <p className="mudo" style={{ marginBottom: 12 }}>
        Campanhas do CRM e formulários que o painel não conseguiu ligar a um curso. Enquanto não forem apontados,
        esses leads ficam fora dos filtros por curso. O maior volume vem primeiro, então resolver os primeiros já
        fecha a maior parte do buraco. A lista olha de 01/08/2026 em diante: o que aparece com nome de 2025 é peça
        antiga que continua no ar e segue trazendo lead agora, e a coluna de período mostra a data real.
      </p>
      <div className="atalhos" style={{ marginBottom: 16 }}>
        <button className={!tudo ? "ativo" : ""} onClick={() => setTudo(false)}>Com volume (10 ou mais)</button>
        <button className={tudo ? "ativo" : ""} onClick={() => setTudo(true)}>Tudo, inclusive a cauda</button>
      </div>
      {!lista ? <p className="rotulo">Carregando</p> : lista.length === 0 ? (
        <p className="mudo">Nada pendente. Tudo classificado.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>O quê</th><th>Tipo</th><th className="n">Volume</th><th className="n">Viraram matrícula</th>
                <th>Período</th>{admin && <th>Apontar para</th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.tipo + p.valor}>
                  <td style={{ maxWidth: 360, wordBreak: "break-word" }}>
                    <b>{p.valor}</b>
                    {p.sugestao && <div className="rotulo">parece {p.sugestao}</div>}
                  </td>
                  <td className="mudo">{TIPO[p.tipo] ?? p.tipo}</td>
                  <td className="n"><b>{num(p.volume)}</b></td>
                  <td className="n">{Number(p.matriculas) > 0 ? num(p.matriculas) : "-"}</td>
                  <td className="mudo num">{dataCurta(p.primeira)} a {dataCurta(p.ultima)}</td>
                  {admin && (
                    <td>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const [cid, ind] = e.target.value.split("|");
                          apontar(p, cid, ind);
                          e.target.value = "";
                        }}
                      >
                        <option value="">escolher</option>
                        {campanhas.map((c) =>
                          INDICADORES.map((i) => (
                            <option key={c.id + i.id} value={c.id + "|" + i.id}>
                              {c.nome} · {i.nome}
                            </option>
                          ))
                        )}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aviso && <div className="aviso ok" style={{ marginTop: 12 }}>{aviso}</div>}

      <h2><span className="idx">022</span> Regras já apontadas</h2>
      {!regras ? <p className="rotulo">Carregando</p> : regras.length === 0 ? (
        <p className="mudo">Nenhuma regra cadastrada. O painel está usando só a regra automática pelo nome do curso.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr><th>Campanha</th><th>Indicador</th><th>Tipo</th><th>O quê</th>{admin && <th />}</tr>
            </thead>
            <tbody>
              {regras.map((r) => (
                <tr key={r.id}>
                  <td>{campanhas.find((c) => c.id === r.campanha_id)?.nome ?? r.campanha_id}</td>
                  <td>{INDICADORES.find((i) => i.id === r.indicador)?.nome ?? r.indicador}</td>
                  <td className="mudo">{TIPO[r.tipo] ?? r.tipo}</td>
                  <td style={{ wordBreak: "break-word" }}>{r.valor}</td>
                  {admin && <td><button className="btn claro" onClick={() => remover(r.id)}>Tirar</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Tela admin={admin} />}</Shell>;
}
