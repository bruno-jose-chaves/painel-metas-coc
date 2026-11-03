"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Detalhe, { type Recorte } from "@/components/Detalhe";
import Pessoas from "@/components/Pessoas";
import Ajuda from "@/components/Ajuda";
import SeletorPeriodo from "@/components/Periodo";
import Curva from "@/components/Curva";
import MapaCalor, { type Celula } from "@/components/MapaCalor";
import { useUltima } from "@/lib/consulta";
import { COR } from "@/lib/cores";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, dataCurta, duracao } from "@/lib/formato";
import { ultimosDias, type Periodo } from "@/lib/periodo";

// Performance individual do comercial.
//
// Três fontes, porque são três coisas diferentes: quem ele atendeu vem da
// conversa do WhatsApp, a carteira vem do CRM e a venda vem da planilha. A tela
// diz de onde veio cada coluna em vez de empilhar tudo como se fosse um número
// só.
//
// A comparação entre pessoas é o ponto da tela, então ela acontece em tabela
// com barra, e não em gráfico com uma linha por pessoa: barra na mesma linha se
// compara de relance, linha sobreposta não.
//
// Duas conversões de propósito. A do período (venda sobre pessoa atendida) serve
// para comparar ritmo. A de coorte (das pessoas abordadas naquela semana,
// quantas compraram até hoje) é a conversão real da pessoa, e por isso semana
// recente aparece marcada como ainda em jogo: contar coorte de anteontem é
// contar metade do jogo. A coorte depende de casar telefone da conversa com
// telefone da planilha, e isso não fecha em 100%: a cobertura aparece ao lado,
// porque taxa sem base à vista é taxa que engana.

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
type MEDIDA = "pessoas" | "vendas" | "conv" | "ticket";
type CALOR = "enviadas" | "recebidas" | "chamadas" | "procuraram" | "ganhas" | "espera";

const MEDIDAS: { id: MEDIDA; nome: string }[] = [
  { id: "pessoas", nome: "Pessoas atendidas" },
  { id: "vendas", nome: "Matrículas" },
  { id: "conv", nome: "Conversão da semana" },
  { id: "ticket", nome: "Ticket médio" },
];

// Seis leituras do mesmo quadro de horário. Esforço do time, disponibilidade
// do cliente e resultado são coisas diferentes e não cabem na mesma cor ao
// mesmo tempo, então é uma por vez.
const CALORES: { id: CALOR; nome: string; oque: string; unidade: string }[] = [
  { id: "enviadas", nome: "Mensagens enviadas", unidade: "mensagens",
    oque: "Quando o time manda mensagem. É o esforço, não o resultado." },
  { id: "recebidas", nome: "Mensagens recebidas", unidade: "mensagens",
    oque: "Quando o cliente responde. É o horário em que vale a pena estar de plantão." },
  { id: "chamadas", nome: "Pessoas que nós chamamos", unidade: "conversas",
    oque: "Conversa aberta por nós, uma por pessoa. Mostra quando o time sai para cima do lead." },
  { id: "procuraram", nome: "Pessoas que nos procuraram", unidade: "conversas",
    oque: "Conversa aberta pelo cliente. É a demanda espontânea, hora a hora." },
  { id: "ganhas", nome: "Negociações ganhas", unidade: "ganhas",
    oque: "Hora em que o CRM marcou a venda. A planilha guarda só a data, então a hora vem daqui." },
  { id: "espera", nome: "Quanto o cliente espera", unidade: "min de espera",
    oque: "Média de minutos até a primeira resposta, só em conversa que o cliente começou." },
];

const fimDaSemana = (d: string) => {
  const fim = new Date(d + "T12:00:00");
  fim.setDate(fim.getDate() + 6);
  return fim.toISOString().slice(0, 10);
};
const semanaCurta = (d: string) => dataCurta(d) + " a " + dataCurta(fimDaSemana(d));
const primeiro = (n: string) => n.split(" ")[0];

export default function Performance() {
  const ultima = useUltima();
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(90));
  const [semanas, setSemanas] = useState<Semana[] | null>(null);
  const [agora, setAgora] = useState<Agora[] | null>(null);
  const [quem, setQuem] = useState<string>("");
  const [medida, setMedida] = useState<MEDIDA>("pessoas");
  const [calor, setCalor] = useState<CALOR>("enviadas");
  const [grade, setGrade] = useState<Celula[] | null>(null);
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

  useEffect(() => {
    setGrade(null);
    ultima("calor", supabase.rpc("painel_mapa_calor", {
      p_de: periodo.de, p_ate: periodo.ate, p_medida: calor, p_vendedor: quem || null,
    }), ({ data }) => setGrade((data as Celula[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, calor, quem, volta]);

  const nomes = useMemo(
    () => [...new Set((semanas ?? []).map((s) => s.vendedor))].sort(), [semanas]);
  const lista = useMemo(
    () => (semanas ?? []).filter((s) => !quem || s.vendedor === quem), [semanas, quem]);

  // O total do período sai da soma das semanas, e não de uma segunda consulta:
  // duas contas para o mesmo número é como tela passa a mentir devagar.
  const porPessoa = useMemo(() => {
    const m = new Map<string, {
      vendedor: string; pessoas: number; conversas: number; dias: number; responderam: number;
      vendas: number; faturamento: number; coorte: number;
    }>();
    for (const s of lista) {
      const a = m.get(s.vendedor) ?? {
        vendedor: s.vendedor, pessoas: 0, conversas: 0, dias: 0, responderam: 0,
        vendas: 0, faturamento: 0, coorte: 0,
      };
      a.pessoas += Number(s.pessoas); a.conversas += Number(s.conversas);
      a.dias += Number(s.dias_trabalhados); a.responderam += Number(s.responderam);
      a.vendas += Number(s.vendas); a.faturamento += Number(s.faturamento);
      a.coorte += Number(s.coorte_compraram);
      m.set(s.vendedor, a);
    }
    return [...m.values()].sort((a, b) => b.vendas - a.vendas || b.pessoas - a.pessoas);
  }, [lista]);

  const agoraFiltrado = useMemo(
    () => (agora ?? []).filter((a) => !quem || a.vendedor === quem), [agora, quem]);
  const cobertura = agora?.[0]?.cobertura_whats ?? null;
  const maior = (f: (p: (typeof porPessoa)[number]) => number) =>
    Math.max(1, ...porPessoa.map(f));

  const curva = useMemo(() => {
    const ordem = [...new Set((semanas ?? []).map((s) => s.semana))].sort();
    const quais = quem ? [quem] : nomes;
    const valor = (s: Semana | undefined) => {
      if (!s) return 0;
      if (medida === "pessoas") return Number(s.pessoas);
      if (medida === "vendas") return Number(s.vendas);
      if (medida === "ticket") return Number(s.ticket_medio ?? 0);
      return Number(s.conv_semana ?? 0) * 100;
    };
    return {
      rotulos: ordem.map(dataCurta),
      series: quais.slice(0, 4).map((n, i) => ({
        nome: n,
        cor: [COR.tinta, COR.limaEscura, COR.cinza, COR.tinta2][i] ?? COR.cinza,
        pontos: ordem.map((sem) => valor((semanas ?? []).find((s) => s.semana === sem && s.vendedor === n))),
      })),
    };
  }, [semanas, nomes, quem, medida]);

  return (
    <>
      <div className="rotulo">Comercial</div>
      <h1>Performance individual</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />

      <div className="filtros" style={{ flexWrap: "wrap" }}>
        <label>
          <span className="rotulo">Comercial</span>
          <select value={quem} onChange={(e) => setQuem(e.target.value)}>
            <option value="">Todo mundo</option>
            {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="mudo" style={{ marginLeft: "auto", alignSelf: "center" }}>
          {quem ? quem + ", " + dataCurta(periodo.de) + " a " + dataCurta(periodo.ate)
                : nomes.length + " comerciais no período"}
        </span>
      </div>

      <h2><span className="idx" /> Lado a lado no período</h2>
      <p className="nota">
        Tudo aqui respeita o período e o comercial escolhidos acima. Clique num número para
        ver quem está por trás dele.
        <Ajuda titulo="O que é cada coluna">
          <b>Pessoas</b> é gente diferente que aquele comercial atendeu no WhatsApp no período.
          A mesma pessoa em três conversas conta uma vez.
          <br /><br />
          <b>Dias trabalhados</b> é em quantos dias do período ele atendeu pelo menos uma
          pessoa. Serve para separar quem produziu pouco de quem produziu pouco porque esteve
          fora: 20 matrículas em 18 dias e 20 matrículas em 6 dias são performances bem
          diferentes.
          <br /><br />
          <b>Carteira</b> é negociação aberta na mão dele hoje, segundo o CRM, e a coluna ao
          lado é há quantos dias está parada a mais antiga. Carteira grande com venda baixa e
          parada velha é lead estacionado, não trabalho em andamento.
        </Ajuda>
      </p>
      {!semanas || !agora ? <p className="rotulo">Carregando</p> : porPessoa.length === 0 ? (
        <p className="mudo">Sem atendimento registrado no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Comercial</th>
                <th className="n">Pessoas</th><th style={{ minWidth: 70 }} />
                <th className="n">Dias trabalhados</th><th className="n">Responderam</th>
                <th className="n">Matrículas</th><th style={{ minWidth: 70 }} />
                <th className="n">Faturamento</th><th className="n">Ticket</th>
                <th className="n">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {porPessoa.map((p) => (
                  <tr key={p.vendedor}>
                    <td><b>{p.vendedor}</b></td>
                    <td className="n abre" onClick={() => setGaveta({
                      titulo: p.vendedor + ", " + dataCurta(periodo.de) + " a " + dataCurta(periodo.ate),
                      rotulo: "pessoas atendidas no período",
                      rpc: "painel_qualidade_pessoas",
                      params: { p_de: periodo.de, p_ate: periodo.ate, p_atendente: primeiro(p.vendedor), p_limite: 300 },
                    })}><b>{num(p.pessoas)}</b></td>
                    <td><div className="mini"><i style={{ width: `${(p.pessoas / maior((x) => x.pessoas)) * 100}%` }} /></div></td>
                    <td className="n num">{num(p.dias)}</td>
                    <td className="n">
                      {num(p.responderam)}
                      <div className="rotulo num">{pct(p.conversas ? p.responderam / p.conversas : null)}</div>
                    </td>
                    <td className={"n" + (p.vendas > 0 ? " abre" : "")}
                        onClick={p.vendas > 0 ? () => setDetalhe({
                          titulo: p.vendedor + ", " + dataCurta(periodo.de) + " a " + dataCurta(periodo.ate),
                          recorte: { p_de: periodo.de, p_ate: periodo.ate, p_vendedor: p.vendedor },
                        }) : undefined}>
                      {p.vendas > 0 ? <b>{num(p.vendas)}</b> : <span className="mudo num">0</span>}
                    </td>
                    <td><div className="mini"><i style={{ width: `${(p.vendas / maior((x) => x.vendas)) * 100}%` }} /></div></td>
                    <td className="n">{brl(p.faturamento)}</td>
                    <td className="n">{brl(p.vendas ? p.faturamento / p.vendas : null)}</td>
                    <td className="n num">{pct(p.pessoas ? p.vendas / p.pessoas : null)}</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Hoje e o que está na mão de cada um</h2>
      <p className="nota">
        A foto de agora, que não depende do período escolhido acima. Carteira é negociação
        aberta na mão da pessoa hoje, segundo o CRM, e a coluna ao lado é há quantos dias está
        parada a mais antiga delas.
      </p>
      {!agora ? <p className="rotulo">Carregando</p> : agoraFiltrado.length === 0 ? (
        <p className="mudo">Nenhuma atividade comercial hoje.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Comercial</th>
                <th className="n">Carteira aberta</th><th style={{ minWidth: 70 }} />
                <th className="n">Parada há</th>
                <th className="n">Atendeu hoje</th><th className="n">Vendeu hoje</th>
                <th className="n">Matrículas no mês</th><th className="n">Faturamento no mês</th>
              </tr>
            </thead>
            <tbody>
              {agoraFiltrado.map((a) => (
                <tr key={a.vendedor}>
                  <td><b>{a.vendedor}</b></td>
                  {/* Sem link por enquanto: a lista de parados ainda não filtra por dono,
                      e abrir a carteira de todo mundo no nome de uma pessoa seria mentira. */}
                  <td className="n num">{num(a.carteira)}</td>
                  <td>
                    <div className="mini">
                      <i style={{ width: `${(a.carteira / Math.max(1, ...agoraFiltrado.map((x) => x.carteira))) * 100}%` }} />
                    </div>
                  </td>
                  <td className={"n num " + (Number(a.parada_mais_antiga) > 60 ? "alerta" : "mudo")}>
                    {a.parada_mais_antiga == null ? "-" : num(a.parada_mais_antiga) + " d"}
                  </td>
                  <td className="n">{num(a.atendidos_hoje)}</td>
                  <td className="n">{num(a.vendas_hoje)}</td>
                  <td className="n">{num(a.vendas_mes)}</td>
                  <td className="n">{brl(a.faturamento_mes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Semana a semana</h2>
      <p className="nota">
        A mesma leitura, quebrada por semana, para ver constância em vez de média.
        {cobertura != null && (
          <> Hoje {pct(cobertura)} das matrículas dão para amarrar numa conversa, e é esse o
          teto da coluna de coorte.</>
        )}
        <Ajuda titulo="As duas conversões">
          <b>Conversão da semana</b> é matrícula da semana sobre pessoa atendida na semana.
          Serve para comparar ritmo entre semanas, mas mistura gente abordada antes.
          <br /><br />
          <b>Coorte</b> pega as pessoas que aquele comercial abordou naquela semana e pergunta
          quantas compraram até hoje. É a conversão real da pessoa. Semana marcada com "em jogo"
          ainda vai subir, porque a decisão leva semanas.
          <br /><br />
          A coorte conta a pessoa na primeira semana em que aquele comercial falou com ela. Se
          dois comerciais falaram com a mesma pessoa, ela aparece na coorte dos dois. O canal de
          Marketing (Instagram e afins) fica fora da conta: não tem telefone, então não dá para
          amarrar na matrícula.
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
                <th className="n">Matrículas</th><th className="n">Ticket</th>
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
                  {!quem && <td>{primeiro(s.vendedor)}</td>}
                  <td className="n abre" onClick={() => setGaveta({
                    titulo: s.vendedor + ", " + semanaCurta(s.semana),
                    rotulo: "pessoas atendidas na semana",
                    rpc: "painel_qualidade_pessoas",
                    params: { p_de: s.semana, p_ate: fimDaSemana(s.semana), p_atendente: primeiro(s.vendedor), p_limite: 300 },
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

      <h2><span className="idx" /> A curva de cada um</h2>
      <p className="nota">
        Uma medida por vez, porque duas escalas no mesmo eixo mentem sobre a proporção. Troque
        a medida no botão para comparar outra coisa.
      </p>
      <div className="filtros">
        <div className="atalhos">
          {MEDIDAS.map((m) => (
            <button key={m.id} className={medida === m.id ? "ativo" : ""} onClick={() => setMedida(m.id)}>
              {m.nome}
            </button>
          ))}
        </div>
      </div>
      {!semanas || curva.series.length === 0 ? <p className="rotulo">Carregando</p> : (
        <Curva rotulos={curva.rotulos} series={curva.series} altura={230} />
      )}

      <h2><span className="idx" /> O quadro de horário</h2>
      <p className="nota">
        {CALORES.find((c) => c.id === calor)?.oque} Respeita o período e o comercial escolhidos
        lá em cima.
        <Ajuda titulo="Para que serve o quadro">
          Comparar duas medidas aqui é o ponto. Se as mensagens enviadas estão concentradas às
          9h e as recebidas às 19h, o time está falando quando o aluno não está ouvindo. Se a
          espera cresce justo na hora em que o cliente mais procura, falta gente naquele
          horário, não falta esforço.
          <br /><br />
          Mensagens recebidas só existem desde 07/10, que é quando o Pigeon passou a avisar o
          painel na hora. As outras cinco medidas pegam o período inteiro.
        </Ajuda>
      </p>
      <div className="filtros">
        <div className="atalhos">
          {CALORES.map((c) => (
            <button key={c.id} className={calor === c.id ? "ativo" : ""} onClick={() => setCalor(c.id)}>
              {c.nome}
            </button>
          ))}
        </div>
      </div>
      {!grade ? <p className="rotulo">Carregando</p> : grade.length === 0 ? (
        <p className="mudo">Sem registro desta medida no período.</p>
      ) : (
        <MapaCalor
          dados={grade}
          rotuloValor={CALORES.find((c) => c.id === calor)?.unidade ?? ""}
          formatar={(v) => calor === "espera" ? duracao(v) : num(Math.round(v))}
        />
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
