"use client";
import { useEffect, useState } from "react";
import Curva from "@/components/Curva";
import SeletorPeriodo from "@/components/Periodo";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import { COR } from "@/lib/cores";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, pct, dataCurta } from "@/lib/formato";
import { ultimosDias, type Periodo } from "@/lib/periodo";
import { useIndicadores, useDestinos, partirDestino, type Indicador, type Destino } from "@/lib/indicadores";

type Linha = {
  identificador: string; conversoes: number; campanhas: string[] | null; pessoas_crm: number;
  taxa: number | null; situacao: string; primeira: string; ultima: string;
  diagnostico: string; sugestao: string | null;
};
type Dia = { dia: string; conversoes: number; negocios: number; razao: number | null };

const SITUACAO: Record<string, string> = {
  alerta: "Não está passando", atencao: "Passando em parte", ok: "Saudável", sem_fluxo: "Sem fluxo apontado",
};
const CLASSE: Record<string, string> = {
  alerta: "atras", atencao: "atencao", ok: "no_ritmo", sem_fluxo: "encerrada",
};

export default function Passagem({ admin }: { admin: boolean }) {
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(60));
  const [lista, setLista] = useState<Linha[] | null>(null);
  const [dias, setDias] = useState<Dia[] | null>(null);
  const [apontando, setApontando] = useState<string | null>(null);
  const indicadores = useIndicadores();
  const destinos = useDestinos();
  const [aviso, setAviso] = useState("");

  function carregar() {
    supabase.rpc("painel_passagem_crm", { p_desde: periodo.de, p_ate: periodo.ate })
      .then(({ data }) => setLista((data as Linha[]) ?? []));
    supabase.rpc("painel_passagem_dia", { p_de: periodo.de, p_ate: periodo.ate })
      .then(({ data }) => setDias((data as Dia[]) ?? []));
  }

  useEffect(() => { setLista(null); setDias(null); carregar(); }, [periodo, volta]);

  // Aponta de uma vez o formulário e a campanha do CRM que ele alimenta: é esse
  // par que permite conferir a passagem.
  async function apontar(l: Linha, destino: string, indicador: string, campanhaCrm: string) {
    const alvo = partirDestino(destino);
    const { error } = await supabase.from("captacao_regras").insert([
      { ...alvo, indicador, tipo: "formulario", valor: l.identificador },
      { ...alvo, indicador, tipo: "campanha_crm", valor: campanhaCrm },
    ]);
    setAviso(error ? error.message : `"${l.identificador}" ligado a "${campanhaCrm}".`);
    setApontando(null);
    if (!error) carregar();
  }

  const alertas = lista?.filter((l) => l.situacao === "alerta").length ?? 0;
  const semFluxo = lista?.filter((l) => l.situacao === "sem_fluxo").length ?? 0;
  const conferiveis = lista?.filter((l) => l.situacao !== "sem_fluxo") ?? [];
  const totalConv = conferiveis.reduce((s, l) => s + Number(l.conversoes), 0);
  const totalCrm = conferiveis.reduce((s, l) => s + Number(l.pessoas_crm), 0);

  return (
    <>
      <div className="rotulo">Passagem</div>
      <h1>Do marketing para o comercial</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} atalhos={[{ nome: "60 dias", dias: 60 }]} />

      <div className="faixa">
        <div>
          <div className="rotulo">Não estão passando</div>
          <div className={"valor num " + (alertas > 0 ? "alerta" : "")}>{lista ? num(alertas) : "..."}</div>
          <div className="mudo">formulários captando sem chegar no CRM</div>
        </div>
        <div>
          <div className="rotulo">Sem fluxo apontado</div>
          <div className="valor num">{lista ? num(semFluxo) : "..."}</div>
          <div className="mudo">não dá para conferir ainda</div>
        </div>
        <div>
          <div className="rotulo">Passagem no que dá para conferir</div>
          <div className="valor num">{lista && totalConv ? pct(totalCrm / totalConv) : "-"}</div>
          <div className="mudo num">{lista ? `${num(totalCrm)} de ${num(totalConv)}` : ""}</div>
        </div>
      </div>

      <h2><span className="idx">035</span> Formulário por formulário</h2>
      <p className="nota">
        Ter formulário não faz o lead chegar no comercial: é preciso um fluxo no RD Marketing criando a negociação.
        <Ajuda titulo="O que esta conta compara"
          fontes={["Conversões do formulário: RD Station Marketing (tabela rd_conversoes_diarias)",
                   "Pessoas no CRM: RD Station CRM (tabela rd_negociacoes), pela campanha ligada ao formulário",
                   "A ligação entre os dois é apontada à mão, na tabela captacao_regras"]}>
          O nome desse fluxo é o que o comercial vê como campanha. Quando alguém publica um formulário e esquece
          o fluxo, a captação aparece no marketing e ninguém recebe o lead. Aqui a conta é direta: quanto o
          formulário converteu contra quantas pessoas entraram no CRM pela campanha ligada a ele.
        </Ajuda>
      </p>

      {!lista ? <p className="rotulo">Carregando</p> : lista.length === 0 ? (
        <p className="mudo">Nenhum formulário com conversão no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Formulário</th><th className="n">Conversões</th><th className="n">Pessoas no CRM</th>
                <th className="n">Passagem</th><th>Situação</th><th>O que isso quer dizer</th>
                {admin && <th>Ligar ao fluxo</th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.identificador}>
                  <td style={{ maxWidth: 260, wordBreak: "break-word" }}>
                    <b>{l.identificador}</b>
                    {l.campanhas?.length ? (
                      <div className="ids">{l.campanhas.join(" · ")}</div>
                    ) : null}
                    <div className="rotulo" style={{ marginTop: 3 }}>
                      {dataCurta(l.primeira)} a {dataCurta(l.ultima)}
                    </div>
                  </td>
                  <td className="n"><b>{num(l.conversoes)}</b></td>
                  <td className="n">{l.situacao === "sem_fluxo" ? "-" : num(l.pessoas_crm)}</td>
                  <td className="n">{l.taxa == null ? "-" : pct(l.taxa)}</td>
                  <td><span className={"selo " + (CLASSE[l.situacao] ?? "")}>{SITUACAO[l.situacao] ?? l.situacao}</span></td>
                  <td className="mudo" style={{ maxWidth: 300 }}>{l.diagnostico}</td>
                  {admin && (
                    <td style={{ minWidth: 190 }}>
                      {l.situacao !== "sem_fluxo" ? (
                        <span className="mudo">já ligado</span>
                      ) : apontando === l.identificador ? (
                        <Apontar
                          linha={l}
                          destinos={destinos}
                          indicadores={indicadores}
                          aoConfirmar={apontar}
                          aoCancelar={() => setApontando(null)}
                        />
                      ) : (
                        <>
                          {l.sugestao && <div className="ids" style={{ marginBottom: 4 }}>parece {l.sugestao}</div>}
                          <button className="btn claro" onClick={() => setApontando(l.identificador)}>Ligar</button>
                        </>
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

      <h2><span className="idx">036</span> Captação e entrada no CRM, dia a dia</h2>
      <p className="nota">
        Esta leitura não depende de fluxo apontado nenhum.
        <Ajuda titulo="Como ler as duas linhas"
          fontes={["Conversões: RD Station Marketing (tabela rd_conversoes_diarias)",
                   "Negociações criadas: RD Station CRM (tabela rd_negociacoes), fora do funil SDR"]}>
          É tudo que o marketing captou contra tudo que entrou como negociação. As duas linhas não precisam se
          encostar, porque nem toda conversão vira negociação e quem já está no CRM não entra de novo. O que
          importa é a distância entre elas mudar de repente, que é o sinal de fluxo quebrado.
        </Ajuda>
      </p>
      {!dias ? <p className="rotulo">Carregando</p> : dias.length === 0 ? (
        <p className="mudo">Sem dados no período.</p>
      ) : (
        <Curva
          rotulos={dias.map((d) => dataCurta(d.dia))}
          series={[
            { nome: "Conversões no marketing", cor: COR.tinta, pontos: dias.map((d) => Number(d.conversoes)) },
            { nome: "Negociações criadas no CRM", cor: COR.cinza, tracejada: true, pontos: dias.map((d) => Number(d.negocios)) },
          ]}
          altura={240}
        />
      )}
    </>
  );
}

function Apontar({
  linha, destinos, indicadores, aoConfirmar, aoCancelar,
}: {
  linha: Linha;
  destinos: Destino[];
  indicadores: Indicador[];
  aoConfirmar: (l: Linha, destino: string, indicador: string, campanhaCrm: string) => void;
  aoCancelar: () => void;
}) {
  const [destino, setDestino] = useState("");
  const [indicador, setIndicador] = useState("leads");
  const [campanhaCrm, setCampanhaCrm] = useState(linha.sugestao ?? "");
  const grupos = Array.from(new Set(destinos.map((d) => d.grupo)));

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
      <input
        value={campanhaCrm}
        placeholder="nome da campanha no CRM"
        onChange={(e) => setCampanhaCrm(e.target.value)}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          className="btn"
          disabled={!destino || !campanhaCrm.trim()}
          onClick={() => aoConfirmar(linha, destino, indicador, campanhaCrm.trim())}
        >
          Ligar
        </button>
        <button className="btn claro" onClick={aoCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
