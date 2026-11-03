"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Detalhe, { type Recorte } from "@/components/Detalhe";
import Pessoas from "@/components/Pessoas";
import Ajuda from "@/components/Ajuda";
import SeletorPeriodo from "@/components/Periodo";
import Curva from "@/components/Curva";
import { useUltima } from "@/lib/consulta";
import { COR } from "@/lib/cores";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, dataCurta } from "@/lib/formato";
import { ultimosDias, type Periodo } from "@/lib/periodo";

// Performance individual do comercial, semana por semana.
//
// Três fontes, porque são três coisas diferentes: quem ele atendeu vem da
// conversa do WhatsApp, a carteira vem do CRM e a venda vem da planilha. A tela
// diz de onde veio cada coluna em vez de empilhar tudo como se fosse um número
// só.
//
// Duas conversões de propósito. A da semana (venda da semana sobre pessoa da
// semana) serve para comparar ritmo entre semanas e é a que o time entende na
// hora. A de coorte (das pessoas que ele abordou naquela semana, quantas
// compraram até hoje) é a conversão real da pessoa, e por isso semana recente
// aparece marcada como ainda em jogo: contar coorte de anteontem é contar
// metade do jogo.
//
// A coorte depende de casar telefone da conversa com telefone da planilha, e
// isso não fecha em 100%. A cobertura aparece no topo, porque taxa sem base à
// vista é taxa que engana.

type Semana = {
  semana: string; vendedor: string; pessoas: number; conversas: number;
  dias_trabalhados: number; responderam: number; taxa_resposta: number | null;
  vendas: number; faturamento: number; ticket_medio: number | null;
  conv_semana: number | null; coorte_compraram: number; conv_coorte: number | null;
  coorte_fechada: boolean;
};
type Agora = {
  vendedor: string; carteira: number; parada_mais_antiga: number | null;
  atendidos_hoje: number; vendas_hoje: number; vendas_mes: number;
  faturamento_mes: number; ticket_mes: number | null; cobertura_whats: number | null;
};

const fimDaSemana = (d: string) => {
  const fim = new Date(d + "T12:00:00");
  fim.setDate(fim.getDate() + 6);
  return fim.toISOString().slice(0, 10);
};
const semanaCurta = (d: string) => dataCurta(d) + " a " + dataCurta(fimDaSemana(d));
const inicioDoMes = () => new Date().toISOString().slice(0, 7) + "-01";

export default function Performance() {
  const ultima = useUltima();
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(56));
  const [semanas, setSemanas] = useState<Semana[] | null>(null);
  const [agora, setAgora] = useState<Agora[] | null>(null);
  const [quem, setQuem] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<{ titulo: string; recorte: Recorte } | null>(null);
  const [gaveta, setGaveta] = useState<
    { titulo: string; rotulo: string; rpc: string; params: Record<string, unknown> } | null
  >(null);

  useEffect(() => {
    supabase.rpc("painel_performance_hoje").then(({ data }) => setAgora((data as Agora[]) ?? []));
  }, [volta]);

  useEffect(() => {
    setSemanas(null);
    ultima("semanas", supabase.rpc("painel_performance_semana", { p_de: periodo.de, p_ate: periodo.ate }),
      ({ data }) => setSemanas((data as Semana[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, volta]);

  const nomes = useMemo(
    () => [...new Set((semanas ?? []).map((s) => s.vendedor))].sort(),
    [semanas]);
  const lista = useMemo(
    () => (semanas ?? []).filter((s) => !quem || s.vendedor === quem),
    [semanas, quem]);
  const cobertura = agora?.[0]?.cobertura_whats ?? null;

  // A curva compara as pessoas do mesmo comercial ao longo das semanas. Uma
  // linha por comercial, uma medida por vez: duas escalas no mesmo eixo
  // mentiriam sobre a proporção.
  const curva = useMemo(() => {
    const ordem = [...new Set((semanas ?? []).map((s) => s.semana))].sort();
    const quais = quem ? [quem] : nomes;
    return {
      rotulos: ordem.map(dataCurta),
      series: quais.slice(0, 4).map((n, i) => ({
        nome: n,
        cor: [COR.tinta, COR.limaEscura, COR.cinza, COR.tinta2][i] ?? COR.cinza,
        pontos: ordem.map((sem) =>
          Number((semanas ?? []).find((s) => s.semana === sem && s.vendedor === n)?.pessoas ?? 0)),
      })),
      datas: ordem,
    };
  }, [semanas, nomes, quem]);

  return (
    <>
      <div className="rotulo">Comercial</div>
      <h1>Performance individual</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <div className="filtros">
        <div className="atalhos">
          <button className={!quem ? "ativo" : ""} onClick={() => setQuem(null)}>Todos</button>
          {nomes.map((n) => (
            <button key={n} className={quem === n ? "ativo" : ""} onClick={() => setQuem(n)}>
              {n.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo}
        atalhos={[{ nome: "8 semanas", dias: 56 }, { nome: "6 meses", dias: 182 }]} />

      <h2><span className="idx" /> A foto de agora</h2>
      <p className="nota">
        Carteira é negociação aberta na mão da pessoa, hoje, segundo o CRM. Clique no número
        para ver quem está lá dentro.
        <Ajuda titulo="O que é carteira parada">
          A coluna ao lado da carteira é há quantos dias está parada a negociação mais antiga
          dela. Carteira grande com venda zero e parada velha é lead estacionado, não trabalho
          em andamento.
        </Ajuda>
      </p>
      {!agora ? <p className="rotulo">Carregando</p> : agora.length === 0 ? (
        <p className="mudo">Nenhuma atividade comercial registrada.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Comercial</th>
                <th className="n">Carteira aberta</th><th className="n">Parada há</th>
                <th className="n">Atendeu hoje</th><th className="n">Vendeu hoje</th>
                <th className="n">Vendas no mês</th><th className="n">Faturamento no mês</th>
                <th className="n">Ticket no mês</th>
              </tr>
            </thead>
            <tbody>
              {agora.map((a) => (
                <tr key={a.vendedor}>
                  <td><b>{a.vendedor}</b></td>
                  {/* Número zerado não vira botão: abrir gaveta vazia é promessa quebrada. */}
                  <td className={"n" + (a.carteira > 0 ? " abre" : "")}
                      onClick={a.carteira > 0 ? () => setGaveta({
                        titulo: "Carteira aberta de " + a.vendedor,
                        rotulo: "pessoas em negociação aberta",
                        rpc: "painel_parados_pessoas",
                        params: { p_de: null, p_ate: null, p_trilha: "comercial", p_limite: 300 },
                      }) : undefined}>
                    {a.carteira > 0 ? <b>{num(a.carteira)}</b> : <span className="mudo num">0</span>}
                  </td>
                  <td className={"n num " + (Number(a.parada_mais_antiga) > 60 ? "alerta" : "mudo")}>
                    {a.parada_mais_antiga == null ? "-" : num(a.parada_mais_antiga) + " d"}
                  </td>
                  <td className="n">{num(a.atendidos_hoje)}</td>
                  <td className="n">{num(a.vendas_hoje)}</td>
                  <td className={"n" + (a.vendas_mes > 0 ? " abre" : "")}
                      onClick={a.vendas_mes > 0 ? () => setDetalhe({
                        titulo: a.vendedor + ", matrículas do mês",
                        recorte: { p_de: inicioDoMes(), p_ate: new Date().toISOString().slice(0, 10), p_vendedor: a.vendedor },
                      }) : undefined}>
                    {a.vendas_mes > 0 ? <b>{num(a.vendas_mes)}</b> : <span className="mudo num">0</span>}
                  </td>
                  <td className="n">{brl(a.faturamento_mes)}</td>
                  <td className="n">{brl(a.ticket_mes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Semana a semana</h2>
      <p className="nota">
        Pessoas é gente diferente atendida no WhatsApp naquela semana. Clique para ver quem.
        {cobertura != null && (
          <> Hoje {pct(cobertura)} das matrículas dão para amarrar numa conversa, e é esse o
          teto da coluna de coorte.</>
        )}
        <Ajuda titulo="As duas conversões">
          <b>Conversão da semana</b> é venda da semana sobre pessoa atendida na semana. Serve
          para comparar ritmo entre semanas, mas mistura gente abordada antes.
          <br /><br />
          <b>Coorte</b> pega as pessoas que aquele comercial abordou naquela semana e pergunta
          quantas compraram até hoje. É a conversão real da pessoa. Semana marcada com "em jogo"
          ainda vai subir, porque a decisão leva semanas.
          <br /><br />
          A coorte conta a pessoa na primeira semana em que aquele comercial falou com ela. Se
          dois comerciais falaram com a mesma pessoa, ela aparece na coorte dos dois.
          O canal de Marketing (Instagram e afins) fica fora da conta: não tem telefone, então
          não dá para amarrar na matrícula.
        </Ajuda>
      </p>
      {!semanas ? <p className="rotulo">Carregando</p> : lista.length === 0 ? (
        <p className="mudo">Sem atendimento registrado no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Semana</th>{!quem && <th>Comercial</th>}
                <th className="n">Pessoas</th><th className="n">Conversas</th>
                <th className="n">Dias trabalhados</th><th className="n">Responderam</th>
                <th className="n">Vendas</th><th className="n">Ticket</th>
                <th className="n">Conv. da semana</th><th className="n">Coorte</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.semana + s.vendedor}>
                  <td>
                    <b>{semanaCurta(s.semana)}</b>
                    {!s.coorte_fechada && <div className="rotulo">coorte em jogo</div>}
                  </td>
                  {!quem && <td>{s.vendedor.split(" ")[0]}</td>}
                  <td className="n abre" onClick={() => setGaveta({
                    titulo: s.vendedor + ", " + semanaCurta(s.semana),
                    rotulo: "pessoas atendidas na semana",
                    rpc: "painel_qualidade_pessoas",
                    params: { p_de: s.semana, p_ate: fimDaSemana(s.semana), p_atendente: s.vendedor.split(" ")[0], p_limite: 300 },
                  })}><b>{num(s.pessoas)}</b></td>
                  <td className="n">{num(s.conversas)}</td>
                  <td className="n num">{num(s.dias_trabalhados)}</td>
                  <td className="n">
                    {num(s.responderam)}
                    <div className="rotulo num">{pct(s.taxa_resposta)}</div>
                  </td>
                  <td className={"n" + (s.vendas > 0 ? " abre" : "")}
                      onClick={s.vendas > 0 ? () => setDetalhe({
                        titulo: s.vendedor + ", " + semanaCurta(s.semana),
                        recorte: { p_de: s.semana, p_ate: fimDaSemana(s.semana), p_vendedor: s.vendedor },
                      }) : undefined}>
                    {s.vendas > 0 ? <b>{num(s.vendas)}</b> : <span className="mudo num">0</span>}
                  </td>
                  <td className="n">{brl(s.ticket_medio)}</td>
                  <td className="n num">{pct(s.conv_semana)}</td>
                  <td className={"n num " + (s.coorte_fechada ? "" : "mudo")}>
                    {pct(s.conv_coorte)}
                    <div className="rotulo num">{num(s.coorte_compraram)} de {num(s.pessoas)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Quantas pessoas cada um atendeu</h2>
      <p className="nota">
        Uma linha por comercial, pessoas diferentes por semana. Mostra constância e divisão de
        volume, que é o que a tabela acima não deixa ver de relance.
      </p>
      {!semanas || curva.series.length === 0 ? <p className="rotulo">Carregando</p> : (
        <Curva rotulos={curva.rotulos} series={curva.series} altura={230} />
      )}

      {detalhe && (
        <Detalhe titulo={detalhe.titulo} recorte={detalhe.recorte} aoFechar={() => setDetalhe(null)} />
      )}
      {gaveta && (
        <Pessoas titulo={gaveta.titulo} rotulo={gaveta.rotulo} rpc={gaveta.rpc}
          params={gaveta.params} aoFechar={() => setGaveta(null)} />
      )}
    </>
  );
}
