"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, dataCurta } from "@/lib/formato";
import { useIndicadores, useDestinos, partirDestino, type Indicador, type Destino } from "@/lib/indicadores";

type Pendencia = {
  tipo: string; valor: string; volume: number; matriculas: number;
  primeira: string; ultima: string;
  sugestao_produto: string | null; sugestao_produto_nome: string | null;
  sugestao_indicador: string | null; sugestao_confianca: string | null;
};
type Campanha = { id: string; nome: string; produto_id: string | null };
type Regra = {
  id: number; campanha_id: string | null; turma_id: string | null; produto_id: string | null;
  indicador: string; tipo: string; valor: string;
};

const TIPO: Record<string, string> = { campanha_crm: "Campanha no CRM", formulario: "Formulário" };


export default function Pendencias({ admin }: { admin: boolean }) {
  const { volta, em, minutos } = useAtualizacao();
  const [lista, setLista] = useState<Pendencia[] | null>(null);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [regras, setRegras] = useState<Regra[] | null>(null);
  const [aviso, setAviso] = useState("");
  const [tudo, setTudo] = useState(false);
  const [apontando, setApontando] = useState<string | null>(null);
  const indicadores = useIndicadores();
  const destinos = useDestinos();

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

  // Aplica o palpite que o nome já dá. O destino é o produto, não a campanha:
  // "material rico do ACAFE" vale todo ano, e a data do lead resolve a turma.
  async function aceitarSugestao(p: Pendencia) {
    if (!p.sugestao_produto) return;
    await apontar(p, "p:" + p.sugestao_produto, p.sugestao_indicador ?? "leads");
  }

  async function aceitarTodas() {
    const comPalpite = (lista ?? []).filter((p) => p.sugestao_produto);
    if (comPalpite.length === 0) return;
    const linhas = comPalpite.map((p) => ({
      ...partirDestino("p:" + p.sugestao_produto),
      indicador: p.sugestao_indicador ?? "leads",
      tipo: p.tipo,
      valor: p.valor,
    }));
    const { error } = await supabase.from("captacao_regras").insert(linhas);
    if (error) { setAviso(error.message); return; }
    setLista((atual) => (atual ?? []).filter((x) => !x.sugestao_produto));
    setAviso(`${comPalpite.length} regra${comPalpite.length > 1 ? "s" : ""} criada${comPalpite.length > 1 ? "s" : ""} pelo nome.`);
    carregar();
  }

  async function apontar(p: Pendencia, destino: string, indicador: string) {
    const { error } = await supabase.from("captacao_regras").insert({
      ...partirDestino(destino), indicador, tipo: p.tipo, valor: p.valor,
    });
    setApontando(null);
    if (error) { setAviso(error.message); return; }
    // Some da lista na hora. Antes só saía depois que a classificação rodava, e
    // para campanha do CRM nem isso acontecia, porque a classificação ignorava
    // a decisão apontada aqui. A pessoa apontava e o item continuava ali.
    setLista((atual) => (atual ?? []).filter((x) => !(x.tipo === p.tipo && x.valor === p.valor)));
    const nome = destinos.find((d) => d.id === destino)?.nome ?? destino;
    const ind = indicadores.find((i) => i.id === indicador)?.nome ?? indicador;
    setAviso(`"${p.valor}" passou a contar como ${ind} em ${nome}.`);
    carregar();
  }

  async function remover(id: number) {
    const { error } = await supabase.from("captacao_regras").delete().eq("id", id);
    setAviso(error ? error.message : "Regra removida.");
    if (!error) carregar();
  }

  const total = lista?.reduce((s, p) => s + Number(p.volume), 0) ?? 0;
  const comPalpite = lista?.filter((p) => p.sugestao_produto).length ?? 0;

  return (
    <>
      <div className="rotulo">Pendências</div>
      <h1>O que falta classificar</h1>
      <p className="carimbo num">
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
      <p className="nota">
        Campanhas do CRM e formulários que o painel não conseguiu ligar a um curso sozinho.
        <Ajuda titulo="Por que resolver, e em que ordem"
          fontes={["Campanhas: RD Station CRM (tabela rd_negociacoes, campo campanha)",
                   "Formulários: RD Station Marketing (tabela rd_conversoes_diarias)",
                   "A decisão apontada aqui vira regra na tabela captacao_regras"]}>
          Enquanto não forem apontados, esses leads ficam fora dos filtros por curso. O maior volume vem
          primeiro, então resolver os primeiros já fecha a maior parte do buraco. A lista olha de 01/08/2026 em
          diante: o que aparece com nome de 2025 é peça antiga que continua no ar e segue trazendo lead agora, e
          a coluna de período mostra a data real.
        </Ajuda>
      </p>
      <div className="filtros">
        <div className="atalhos">
          <button className={!tudo ? "ativo" : ""} onClick={() => setTudo(false)}>Com volume (10 ou mais)</button>
          <button className={tudo ? "ativo" : ""} onClick={() => setTudo(true)}>Tudo, inclusive a cauda</button>
        </div>
        {admin && comPalpite > 0 && (
          <button className="btn" style={{ marginLeft: "auto" }} onClick={aceitarTodas}>
            Aceitar os {comPalpite} palpites do nome
          </button>
        )}
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
                    {p.sugestao_confianca && p.sugestao_produto && (
                      <div className="rotulo">{p.sugestao_confianca}</div>
                    )}
                  </td>
                  <td className="mudo">{TIPO[p.tipo] ?? p.tipo}</td>
                  <td className="n"><b>{num(p.volume)}</b></td>
                  <td className="n">{Number(p.matriculas) > 0 ? num(p.matriculas) : "-"}</td>
                  <td className="mudo num">{dataCurta(p.primeira)} a {dataCurta(p.ultima)}</td>
                  {admin && (
                    <td style={{ minWidth: 200 }}>
                      {p.valor.startsWith("(sem campanha") ? (
                        <span className="mudo">
                          não é uma campanha, é a sobra: negócio que entrou sem campanha nenhuma no CRM
                        </span>
                      ) : apontando === p.tipo + p.valor ? (
                        <Apontar
                          destinos={destinos}
                          indicadores={indicadores}
                          destinoInicial={p.sugestao_produto ? "p:" + p.sugestao_produto : ""}
                          indicadorInicial={p.sugestao_indicador ?? "leads"}
                          aoConfirmar={(d, i) => apontar(p, d, i)}
                          aoCancelar={() => setApontando(null)}
                        />
                      ) : (
                        <div style={{ display: "grid", gap: 6 }}>
                          {p.sugestao_produto && (
                            <button className="btn" onClick={() => aceitarSugestao(p)}>
                              {p.sugestao_produto_nome} ·{" "}
                              {indicadores.find((i) => i.id === p.sugestao_indicador)?.nome ?? p.sugestao_indicador}
                            </button>
                          )}
                          <button className="btn claro" onClick={() => setApontando(p.tipo + p.valor)}>
                            {p.sugestao_produto ? "Outro destino" : "Apontar"}
                          </button>
                        </div>
                      )}
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
      <p className="nota">
        Regra apontada para <b>curso</b> vale para qualquer ano: a data do lead decide a turma e a campanha.
        <Ajuda titulo="Curso, turma ou campanha">
          Apontar para turma ou campanha só faz sentido quando a regra é mesmo daquele ano, como um formulário
          feito para uma campanha específica. Apontada para curso, a regra é escrita uma vez e não precisa ser
          repontada em janeiro.
        </Ajuda>
      </p>
      {!regras ? <p className="rotulo">Carregando</p> : regras.length === 0 ? (
        <p className="mudo">Nenhuma regra cadastrada. O painel está usando só a regra automática pelo nome do curso.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr><th>Aponta para</th><th>Indicador</th><th>Tipo</th><th>O quê</th>{admin && <th />}</tr>
            </thead>
            <tbody>
              {regras.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.turma_id
                      ? destinos.find((d) => d.id === "t:" + r.turma_id)?.nome ?? r.turma_id
                      : r.produto_id
                        ? (destinos.find((d) => d.id === "p:" + r.produto_id)?.nome ?? r.produto_id) + " · qualquer ano"
                        : campanhas.find((c) => c.id === r.campanha_id)?.nome ?? r.campanha_id}
                  </td>
                  <td>{indicadores.find((i) => i.id === r.indicador)?.nome ?? r.indicador}</td>
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

// Dois campos e um botão, em vez de uma lista com campanha vezes indicador.
// Com turma no meio seriam dezenas de opções em um menu só.
function Apontar({
  destinos, indicadores, destinoInicial, indicadorInicial, aoConfirmar, aoCancelar,
}: {
  destinos: Destino[];
  indicadores: Indicador[];
  destinoInicial: string;
  indicadorInicial: string;
  aoConfirmar: (destino: string, indicador: string) => void;
  aoCancelar: () => void;
}) {
  const [destino, setDestino] = useState(destinoInicial);
  const [indicador, setIndicador] = useState(indicadorInicial);
  const grupos = Array.from(new Set(destinos.map((d) => d.grupo)));
  const escolhido = indicadores.find((i) => i.id === indicador);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <select value={destino} onChange={(e) => setDestino(e.target.value)}>
        <option value="">para qual curso</option>
        {grupos.map((g) => (
          <optgroup key={g} label={g}>
            {destinos.filter((d) => d.grupo === g).map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <select value={indicador} onChange={(e) => setIndicador(e.target.value)}>
        {indicadores.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
      </select>
      {escolhido && !escolhido.conta_como_lead && (
        <div className="ids">não entra na conta de leads captados</div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn" disabled={!destino} onClick={() => aoConfirmar(destino, indicador)}>
          Apontar
        </button>
        <button className="btn claro" onClick={aoCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
