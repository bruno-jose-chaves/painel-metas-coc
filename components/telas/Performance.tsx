"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Detalhe, { type Recorte } from "@/components/Detalhe";
import Pessoas from "@/components/Pessoas";
import Ajuda from "@/components/Ajuda";
import Chave from "@/components/Chave";
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
  vendas: number; vendas_atendidas: number; faturamento: number; ticket_medio: number | null;
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
type Resposta = {
  vendedor: string; procuraram: number; mediana_min: number | null; p90_min: number | null;
  mediana_corrida: number | null; ate_15min: number; ate_1h: number; mais_de_1h: number;
  sem_resposta: number; fora_do_horario: number;
};
type Mix = {
  vendedor: string; produto_id: string | null; produto: string; vendas: number;
  faturamento: number; ticket: number | null; fatia: number;
};
type Carteira = {
  vendedor: string; abertas: number; ate_7: number; d8_15: number; d16_30: number;
  d31_60: number; mais_60: number; dias_mediana: number | null;
};
type Perda = { vendedor: string; motivo: string; grupo: string; perdidas: number; fatia_no_grupo: number };
type Comissao = {
  vendedor: string; mes: string; produto: string; matriculas: number;
  faturamento: number; percentual: number; comissao: number;
};
type Periodo361 = {
  vendedor: string; pessoas: number; conversas: number; dias_com_atendimento: number;
  responderam: number; taxa_resposta: number | null; vendas: number; vendas_atendidas: number;
  faturamento: number; ticket_medio: number | null; conversao: number | null; dias_no_periodo: number;
};

const MEDIDAS: { id: MEDIDA; nome: string }[] = [
  { id: "pessoas", nome: "Pessoas atendidas" },
  { id: "vendas", nome: "Matrículas" },
  { id: "conv", nome: "Conversão" },
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
    oque: "Hora em que o CRM marcou a venda. A planilha guarda só a data, então a hora vem daqui, e por isso o total aqui não bate com o de matrículas: o CRM marcou 449 ganhas onde a planilha tem 391 matrículas em 90 dias." },
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
  const [resposta, setResposta] = useState<Resposta[] | null>(null);
  const [mix, setMix] = useState<Mix[] | null>(null);
  const [carteira, setCarteira] = useState<Carteira[] | null>(null);
  const [perdas, setPerdas] = useState<Perda[] | null>(null);
  const [total, setTotal] = useState<Periodo361[] | null>(null);
  const [comissao, setComissao] = useState<Comissao[] | null>(null);
  const [soDiaUtil, setSoDiaUtil] = useState(false);
  const [soComercial, setSoComercial] = useState(false);
  const [relogio, setRelogio] = useState<"util" | "corrido">("util");

  // Em período curto a semana some: sobra um ponto ou dois, e dois pontos não
  // formam leitura. Abaixo de três semanas a tela passa a falar em dia.
  const dias = Math.round(
    (new Date(periodo.ate).getTime() - new Date(periodo.de).getTime()) / 86400000) + 1;
  const passo: "dia" | "semana" = dias <= 21 ? "dia" : "semana";
  const nomePasso = passo === "dia" ? "Dia" : "Semana";
  const [detalhe, setDetalhe] = useState<{ titulo: string; recorte: Recorte } | null>(null);
  const [gaveta, setGaveta] = useState<
    { titulo: string; rotulo: string; rpc: string; params: Record<string, unknown> } | null
  >(null);

  useEffect(() => {
    supabase.rpc("painel_performance_hoje").then(({ data }) => setAgora((data as Agora[]) ?? []));
    supabase.rpc("painel_performance_carteira").then(({ data }) => setCarteira((data as Carteira[]) ?? []));
  }, [volta]);

  useEffect(() => {
    setSemanas(null);
    ultima("semanas", supabase.rpc("painel_performance_semana",
      { p_de: periodo.de, p_ate: periodo.ate, p_passo: passo }),
      ({ data }) => setSemanas((data as Semana[]) ?? []));
    setResposta(null); setMix(null); setPerdas(null); setTotal(null);
    ultima("periodo", supabase.rpc("painel_performance_periodo", { p_de: periodo.de, p_ate: periodo.ate }),
      ({ data }) => setTotal((data as Periodo361[]) ?? []));
    setComissao(null);
    ultima("comissao", supabase.rpc("painel_comissao", { p_de: periodo.de, p_ate: periodo.ate }),
      ({ data }) => setComissao((data as Comissao[]) ?? []));
    ultima("resposta", supabase.rpc("painel_performance_resposta", {
      p_de: periodo.de, p_ate: periodo.ate, p_relogio: relogio,
      p_so_dia_util: soDiaUtil, p_so_horario_comercial: soComercial,
    }), ({ data }) => setResposta((data as Resposta[]) ?? []));
    ultima("mix", supabase.rpc("painel_performance_mix", { p_de: periodo.de, p_ate: periodo.ate }),
      ({ data }) => setMix((data as Mix[]) ?? []));
    ultima("perdas", supabase.rpc("painel_performance_perdas", { p_de: periodo.de, p_ate: periodo.ate }),
      ({ data }) => setPerdas((data as Perda[]) ?? []));
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
    () => [...new Set((total ?? []).map((t) => t.vendedor))].sort(), [total]);
  const lista = useMemo(
    () => (semanas ?? []).filter((s) => !quem || s.vendedor === quem), [semanas, quem]);

  // O total do período sai da soma das semanas, e não de uma segunda consulta:
  // duas contas para o mesmo número é como tela passa a mentir devagar.
  const porPessoa = useMemo(
    () => (total ?? []).filter((t) => !quem || t.vendedor === quem), [total, quem]);

  const agoraFiltrado = useMemo(
    () => (agora ?? []).filter((a) => !quem || a.vendedor === quem), [agora, quem]);
  const cobertura = agora?.[0]?.cobertura_whats ?? null;
  const maior = (f: (p: Periodo361) => number) => Math.max(1, ...porPessoa.map(f));

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
          <span className="rotulo">Quem atendeu</span>
          <select value={quem} onChange={(e) => setQuem(e.target.value)}>
            <option value="">Todo mundo</option>
            {nomes.map((n) => {
              const p = (total ?? []).find((x) => x.vendedor === n);
              return <option key={n} value={n}>{n}{p ? ` (${num(p.pessoas)})` : ""}</option>;
            })}
          </select>
        </label>
        <div className="chaves-filtro">
          <Chave ligada={soDiaUtil} aoMudar={setSoDiaUtil}
                 ajuda="Ligado, tira do tempo de resposta a conversa que chegou no sábado ou domingo.">
            Tirar sábado e domingo
          </Chave>
          <Chave ligada={soComercial} aoMudar={setSoComercial}
                 ajuda="Ligado, conta só a conversa que chegou entre 8h e 18h, para madrugada não estragar a média.">
            Só das 8h às 18h
          </Chave>
        </div>
      </div>

      <h2><span className="idx" /> Lado a lado no período</h2>
      <p className="nota">
        A linha de cada comercial no período, para gestão individual de performance: volume, carteira,
        atendimento e conversão na mesma leitura. Tudo aqui respeita o período e o comercial escolhidos
        acima, e clicar num número abre quem está por trás dele.
        <Ajuda titulo="O que é cada coluna"
          fontes={["Matrículas, faturamento e ticket: planilha comercial, pelo vendedor da linha",
                   "Pessoas, dias com atendimento e tempo de resposta: Pigeon Post, pelo atendente da conversa",
                   "Leads, carteira e perdas: RD Station CRM, pelo responsável do negócio",
                   "Quem é comercial: cadastro de pessoas em Ajustes, papel comercial",
                   "A regra de matrícula é a mesma do Ranking: venda não cancelada, material avulso fora"]}>
          <b>Pessoas</b> é gente diferente que aquele comercial atendeu no WhatsApp no período.
          A mesma pessoa em três conversas conta uma vez.
          <br /><br />
          <b>Dias com atendimento</b> conta os dias do período em que aquela pessoa falou com
          pelo menos um cliente no WhatsApp. "13 de 64" quer dizer: o período tem 64 dias, e
          em 13 deles ela atendeu alguém. Os outros 51 ela não abriu nenhuma conversa.
          <br /><br />
          Não é controle de ponto nem jornada: é frequência de atendimento. Serve para ler o
          resto da linha direito. 20 matrículas feitas em 18 dias de atendimento e 20 feitas
          em 6 dias são performances bem diferentes, e sem essa coluna as duas aparecem
          iguais. Também é o jeito mais rápido de ver férias, afastamento ou alguém que
          simplesmente parou de abrir conversa.
          <br /><br />
          <b>Conversão</b> divide as matrículas <i>de gente que ele atendeu no WhatsApp</i>
          pelas pessoas que ele atendeu. Só 60% das matrículas têm conversa com o mesmo
          vendedor: o resto fechou por telefone, presencial ou com outra pessoa do time. Se a
          conta usasse o total de matrículas em cima de um universo menor de pessoas, a
          conversão sairia inflada, e por isso o número de baixo mostra as duas pontas.
          <br /><br />
          <b>Matrículas</b> segue a mesma regra do Ranking (312) e do resumo diário: fora
          cancelada, fora o que não é matrícula (material avulso) e só quem tem papel
          comercial. Os dois números batem.
        </Ajuda>
      </p>
      {!total || !agora ? <p className="rotulo">Carregando</p> : porPessoa.length === 0 ? (
        <p className="mudo">Sem atendimento registrado no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Comercial</th>
                <th className="n">Pessoas</th><th style={{ minWidth: 70 }} />
                <th className="n">Dias com atendimento</th><th className="n">Responderam</th>
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
                      rpc: "painel_performance_pessoas",
                      params: { p_de: periodo.de, p_ate: periodo.ate, p_vendedor: p.vendedor, p_limite: 300 },
                    })}><b>{num(p.pessoas)}</b></td>
                    <td><div className="mini"><i style={{ width: `${(p.pessoas / maior((x) => x.pessoas)) * 100}%` }} /></div></td>
                    <td className="n num">
                      {num(p.dias_com_atendimento)}
                      <div className="rotulo num">de {num(p.dias_no_periodo)}</div>
                    </td>
                    <td className="n">
                      {num(p.responderam)}
                      <div className="rotulo num">{pct(p.taxa_resposta)}</div>
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
                    <td className="n">{brl(p.ticket_medio)}</td>
                    <td className="n num">
                      {pct(p.conversao)}
                      <div className="rotulo num">{num(p.vendas_atendidas)} de {num(p.pessoas)}</div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Hoje e o que está na mão de cada um</h2>
      <p className="nota">
        A foto de agora, que não depende do período escolhido acima. Carteira é negociação
        aberta na mão da pessoa hoje, segundo o CRM, quebrada por quanto tempo cada uma está
        sem receber nenhuma mexida.
        <Ajuda titulo="Por que quebrar a carteira por tempo"
          fontes={["Carteira, etapa e tempo parado: RD Station CRM, pelo responsável do negócio",
                   "Matrículas e conversas de hoje: planilha comercial e Pigeon Post",
                   "Tempo parado: desde a última mexida registrada no negócio"]}>
          Carteira grande não é sinal de trabalho: pode ser lead estacionado. Quem tem 400
          negociações com metade parada há menos de uma semana está trabalhando; quem tem 1.300
          com quase tudo parado há mais de dois meses está só segurando nome que já esfriou.
          <br /><br />
          As duas últimas faixas vêm em vermelho de propósito. Acima de 30 dias sem contato, a
          chance de a pessoa lembrar da gente é baixa, e o certo é devolver para o funil ou
          encerrar, não deixar envelhecendo na mão de alguém.
        </Ajuda>
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
                <th className="n">Até 7 d</th><th className="n">8 a 15</th>
                <th className="n">16 a 30</th><th className="n">31 a 60</th><th className="n">+ de 60</th>
                <th className="n">Atendeu hoje</th><th className="n">Vendeu hoje</th>
                <th className="n">Matrículas no mês</th>
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
                  {(() => {
                    const f = (carteira ?? []).find((c) => c.vendedor === a.vendedor);
                    const cel = (v: number | undefined, alerta = false) => (
                      <td className={"n num " + (v ? (alerta ? "alerta" : "") : "mudo")}>{num(v ?? 0)}</td>
                    );
                    return (
                      <>
                        {cel(f?.ate_7)}{cel(f?.d8_15)}{cel(f?.d16_30)}
                        {cel(f?.d31_60, true)}{cel(f?.mais_60, true)}
                      </>
                    );
                  })()}
                  <td className="n">{num(a.atendidos_hoje)}</td>
                  <td className="n">{num(a.vendas_hoje)}</td>
                  <td className="n">{num(a.vendas_mes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> {passo === "dia" ? "Dia a dia" : "Semana a semana"}</h2>
      <p className="nota">
        A mesma leitura, quebrada por {passo === "dia" ? "dia" : "semana"}, para ver constância
        em vez de média.
        {cobertura != null && (
          <> Hoje {pct(cobertura)} das matrículas dão para amarrar numa conversa de WhatsApp,
          e é esse o teto da última coluna: o que não casa por telefone não entra lá.</>
        )}
        <Ajuda titulo="A diferença entre as duas últimas colunas"
          fontes={["Pessoas atendidas: Pigeon Post, gente diferente por semana ou por dia",
                   "Matrículas: planilha comercial, pelo vendedor e pela data da compra",
                   "Cobertura: fatia das matrículas que dá para amarrar a uma conversa pelo telefone"]}>
          <b>Fechou no período</b> divide as matrículas de gente que ele atendeu no WhatsApp
          pelas pessoas atendidas naquela linha. As duas pontas são do mesmo universo, mas não
          são exatamente as mesmas pessoas: quem comprou segunda pode ter sido abordado duas
          semanas antes.
          <br /><br />
          <b>Converteu até hoje</b> faz a pergunta certa: das pessoas que essa pessoa abordou
          naquela semana, quantas compraram, em qualquer momento depois. Acompanha as mesmas
          pessoas do começo ao fim, e por isso é a conversão de verdade.
          <br /><br />
          A linha marcada com <b>ainda pode subir</b> é recente demais para fechar essa conta.
          A decisão de matrícula leva semanas, então gente abordada anteontem ainda está
          decidindo: aquele número só vai crescer.
          <br /><br />
          Uma pessoa entra na conta uma vez só, na primeira vez que aquele comercial falou com
          ela. Se dois comerciais falaram com a mesma pessoa, ela conta para os dois. O canal de
          Marketing (Instagram e afins) fica de fora: não tem telefone, então não dá para
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
                <th>{nomePasso}</th>{!quem && <th>Comercial</th>}
                <th className="n">Pessoas</th><th className="n">Conversas</th>
                {passo === "semana" && <th className="n">Dias com atendimento</th>}
                <th className="n">Responderam</th>
                <th className="n">Matrículas</th><th className="n">Ticket</th>
                <th className="n">Fechou no período</th><th className="n">Converteu até hoje</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.semana + s.vendedor}>
                  <td>
                    <b>{passo === "dia" ? dataCurta(s.semana) : semanaCurta(s.semana)}</b>
                    {!s.coorte_fechada && <div className="rotulo">ainda pode subir</div>}
                  </td>
                  {!quem && <td>{primeiro(s.vendedor)}</td>}
                  <td className="n abre" onClick={() => setGaveta({
                    titulo: s.vendedor + ", " + (passo === "dia" ? dataCurta(s.semana) : semanaCurta(s.semana)),
                    rotulo: "pessoas atendidas no período",
                    rpc: "painel_qualidade_pessoas",
                    params: { p_de: s.semana, p_ate: passo === "dia" ? s.semana : fimDaSemana(s.semana), p_atendente: primeiro(s.vendedor), p_limite: 300 },
                  })}><b>{num(s.pessoas)}</b></td>
                  <td className="n">{num(s.conversas)}</td>
                  {passo === "semana" && <td className="n num">{num(s.dias_trabalhados)} de 7</td>}
                  <td className="n">
                    {num(s.responderam)}
                    <div className="rotulo num">{pct(s.taxa_resposta)}</div>
                  </td>
                  <td className={"n" + (s.vendas > 0 ? " abre" : "")}
                      onClick={s.vendas > 0 ? () => setDetalhe({
                        titulo: s.vendedor + ", " + (passo === "dia" ? dataCurta(s.semana) : semanaCurta(s.semana)),
                        recorte: { p_de: s.semana, p_ate: passo === "dia" ? s.semana : fimDaSemana(s.semana), p_vendedor: s.vendedor },
                      }) : undefined}>
                    {s.vendas > 0 ? <b>{num(s.vendas)}</b> : <span className="mudo num">0</span>}
                  </td>
                  <td className="n">{brl(s.ticket_medio)}</td>
                  <td className="n num">
                    {pct(s.conv_semana)}
                    <div className="rotulo num">{num(s.vendas_atendidas)} de {num(s.pessoas)}</div>
                  </td>
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
        A mesma informação do bloco acima em desenho, uma linha por comercial, para enxergar constância
        e cruzamento em vez de total. Um ponto por {passo === "dia" ? "dia" : "semana"}, seguindo o
        período escolhido: até três semanas a curva vai por dia, acima disso por semana. Uma medida por
        vez, porque duas escalas no mesmo eixo mentem sobre a proporção.
        <Ajuda titulo="Como escolher a medida"
          fontes={["Matrículas e faturamento: planilha comercial, pelo vendedor da linha",
                   "Pessoas atendidas e tempo de resposta: Pigeon Post, pelo atendente da conversa",
                   "O passo da curva segue o tamanho do período, não uma escolha manual"]}>
          Linha subindo junto em todos quer dizer campanha ou sazonalidade; linha de um só descolando quer
          dizer pessoa. Nas medidas de tempo de resposta, para baixo é melhor, ao contrário das outras.
          Curva com buraco no meio não é dado faltando: é semana sem atendimento daquela pessoa, e o bloco
          <b> Lado a lado</b> mostra isso na coluna de dias com atendimento.
        </Ajuda>
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
        A semana do time em hora e dia: cada quadradinho é uma faixa de uma hora, e quanto mais escuro,
        maior o número ali. Serve para casar escala de equipe com a hora em que o cliente aparece.
        {" "}{CALORES.find((c) => c.id === calor)?.oque} Respeita o período e o comercial escolhidos lá
        em cima.
        <Ajuda titulo="Para que serve o quadro"
          fontes={["Mensagens, conversas e espera: Pigeon Post, pela hora de cada mensagem",
                   "Matrículas: planilha comercial, pela data da compra",
                   "Fuso: tudo convertido para o horário de São Paulo"]}>
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

      <h2><span className="idx" /> Quanto o cliente espera por cada um</h2>
      <p className="nota">
        Quanto o cliente espera pela primeira resposta de cada comercial, nos dois relógios. Conta só
        conversa que o cliente começou, porque quando somos nós que abrimos, a primeira mensagem é a
        nossa e a conta mediria o disparo e não o atendimento.
        <Ajuda titulo="Os dois relógios, e por que o número muda tanto"
          fontes={["Mensagens recebidas e enviadas: Pigeon Post, com data e hora de cada uma",
                   "Relógio comercial: só minutos de dia útil entre 8h e 18h",
                   "Sem resposta: nenhuma mensagem nossa depois da primeira do cliente"]}>
          <b>Relógio comercial</b> conta só os minutos que caíram em dia útil entre 8h e 18h.
          Mensagem que chega sábado às 22h e é respondida segunda às 8h05 conta como 5 minutos,
          porque não tinha ninguém para atender no meio. É o que mede o time.
          <br /><br />
          <b>Relógio corrido</b> conta tudo, do minuto em que a mensagem chegou ao minuto da
          resposta. Nesse mesmo caso dá 34 horas. É o que o cliente sentiu.
          <br /><br />
          Os dois estão certos e respondem perguntas diferentes: um diz se o time demora, o
          outro diz se a pessoa esperou. A diferença entre eles é o tamanho do que acontece
          fora do expediente, e a coluna "Chegou fora do horário" mostra isso direto.
        </Ajuda>
        <br />
        <b>Mediana</b> é o caso do meio: metade foi atendida em menos que isso. Média aqui
        enganaria, porque uma conversa respondida três dias depois puxa o mês inteiro.
      </p>
      <div className="filtros">
        <div className="atalhos">
          <button className={relogio === "util" ? "ativo" : ""} onClick={() => setRelogio("util")}>
            Relógio comercial
          </button>
          <button className={relogio === "corrido" ? "ativo" : ""} onClick={() => setRelogio("corrido")}>
            Relógio corrido
          </button>
        </div>
        <span className="mudo" style={{ marginLeft: "auto", alignSelf: "center" }}>
          {relogio === "util" ? "Conta só dia útil, das 8h às 18h" : "Conta do minuto que chegou ao minuto da resposta"}
        </span>
      </div>
      {!resposta ? <p className="rotulo">Carregando</p> : resposta.length === 0 ? (
        <p className="mudo">Ninguém procurou a gente no período, com estes filtros.</p>
      ) : (
        <>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Comercial</th><th className="n">Procuraram</th>
                  <th className="n">Mediana</th><th className="n">90% esperaram até</th>
                  <th className="n">Até 15 min</th><th className="n">15 min a 1 h</th>
                  <th className="n">Mais de 1 h</th><th className="n">Sem resposta</th>
                  <th className="n">Chegou fora do horário</th>
                </tr>
              </thead>
              <tbody>
                {resposta.filter((r) => !quem || r.vendedor === quem).map((r) => (
                  <tr key={r.vendedor}>
                    <td><b>{r.vendedor}</b></td>
                    <td className="n">{num(r.procuraram)}</td>
                    <td className="n num">
                      <b>{duracao(r.mediana_min)}</b>
                      {relogio === "util" && r.mediana_corrida != null && (
                        <div className="rotulo num">corrido: {duracao(r.mediana_corrida)}</div>
                      )}
                    </td>
                    <td className="n num">{duracao(r.p90_min)}</td>
                    <td className="n">
                      {num(r.ate_15min)}
                      <div className="rotulo num">{pct(r.procuraram ? r.ate_15min / r.procuraram : null)}</div>
                    </td>
                    <td className="n">{num(r.ate_1h)}</td>
                    <td className={"n" + (r.mais_de_1h > 0 ? " alerta" : "")}>
                      {num(r.mais_de_1h)}
                      <div className="rotulo num">{pct(r.procuraram ? r.mais_de_1h / r.procuraram : null)}</div>
                    </td>
                    <td className={"n" + (r.sem_resposta > 0 ? " alerta" : "")}>
                      {num(r.sem_resposta)}
                      <div className="rotulo num">{pct(r.procuraram ? r.sem_resposta / r.procuraram : null)}</div>
                    </td>
                    <td className="n num mudo">
                      {num(r.fora_do_horario)}
                      <div className="rotulo num">{pct(r.procuraram ? r.fora_do_horario / r.procuraram : null)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota" style={{ marginTop: 10 }}>
            <b>Sem resposta</b> é conversa sem nenhuma mensagem nossa registrada, nem carimbo de
            primeira resposta. O Pigeon não carimba todas: quando falta o carimbo mas existe
            mensagem nossa, o tempo vem da primeira mensagem que mandamos, e a conversa não
            entra aqui.
          </p>
        </>
      )}

      <h2><span className="idx" /> O que cada um vende</h2>
      <p className="nota">
        O mix de cada comercial: quanto de cada produto ele vendeu e quanto aquilo pesa no faturamento
        dele. Serve para ler o ticket médio sem se enganar, porque ticket sozinho engana: intensivo e
        extensivo têm ticket dez vezes diferente, e uma venda de Semi muda o ticket do mês inteiro.
        <Ajuda titulo="O que cada coluna significa"
          fontes={["Matrículas, valor e desconto: planilha comercial, pelo vendedor da linha",
                   "Produto de cada venda: o curso da planilha, apontado para produto em Ajustes, Cursos",
                   "Material avulso e matrícula cancelada ficam fora, como no resto do painel"]}>
          <b>Matrículas</b> é linha de venda, não pessoa. <b>Fatia</b> é quanto aquele produto representa
          das matrículas daquela pessoa, e é ela que explica diferença de ticket entre dois comerciais
          melhor que qualquer outra coluna. <b>Ticket</b> se mexe com desconto dado e com fase de preço,
          não só com o produto. <b>Faturamento</b> é o valor cheio da matrícula no dia em que foi lançada.
        </Ajuda>
      </p>
      {!mix ? <p className="rotulo">Carregando</p> : mix.length === 0 ? (
        <p className="mudo">Sem matrícula no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Comercial</th><th>Produto</th><th className="n">Matrículas</th>
                <th style={{ minWidth: 90 }}>Fatia do que ele vendeu</th>
                <th className="n">Ticket</th><th className="n">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {mix.filter((m) => !quem || m.vendedor === quem).map((m, i, arr) => (
                <tr key={m.vendedor + m.produto}>
                  <td>{i === 0 || arr[i - 1].vendedor !== m.vendedor ? <b>{m.vendedor}</b> : ""}</td>
                  <td>{m.produto}</td>
                  <td className="n">{num(m.vendas)}</td>
                  <td>
                    <div className="mini"><i style={{ width: `${Number(m.fatia) * 100}%` }} /></div>
                    <div className="rotulo num">{pct(m.fatia)}</div>
                  </td>
                  <td className="n">{brl(m.ticket)}</td>
                  <td className="n">{brl(m.faturamento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Quanto cada um ganhou</h2>
      <p className="nota">
        Comissão fixa por venda, pela regra em vigor: 3% em Semi e Extensivo, 5% nos demais.
        Fica aqui e na tela de cada comercial, não no ranking do time.
        <Ajuda titulo="Por que este número é o teto"
          fontes={["Vendas e valor: planilha comercial, pelo vendedor da linha",
                   "Percentual de cada produto: tabela comissao_regras, em Ajustes",
                   "Regra da casa: Premiações 2026 v3"]}>
          A regra paga sobre a <b>parcela paga</b>, não sobre o valor da matrícula. O painel
          recebe a venda fechada, não o pagamento de cada parcela, então isto é o que a pessoa
          recebe se o aluno pagar tudo. Serve para acompanhar, não para fechar folha.
          <br /><br />
          O <b>bônus por meta</b> não entra: depende do quadro de colaboradores ativos no
          período, com peso de CLT e MEI, que é informação de fora do painel.
          <br /><br />
          Os percentuais ficam em uma tabela no banco (comissao_regras), produto a produto, e
          mudam sem mexer em código.
        </Ajuda>
      </p>
      {!comissao ? <p className="rotulo">Carregando</p> : (() => {
        const lista = comissao.filter((c) => !quem || c.vendedor === quem);
        if (lista.length === 0) return <p className="mudo">Sem venda com comissão no período.</p>;
        const porPessoa = new Map<string, { matriculas: number; faturamento: number; comissao: number }>();
        for (const c of lista) {
          const a = porPessoa.get(c.vendedor) ?? { matriculas: 0, faturamento: 0, comissao: 0 };
          a.matriculas += Number(c.matriculas); a.faturamento += Number(c.faturamento);
          a.comissao += Number(c.comissao);
          porPessoa.set(c.vendedor, a);
        }
        const linhas = [...porPessoa.entries()].sort((a, b) => b[1].comissao - a[1].comissao);
        const maiorC = Math.max(1, ...linhas.map(([, a]) => a.comissao));
        return (
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Comercial</th><th className="n">Matrículas</th>
                  <th className="n">Faturamento</th><th className="n">Comissão</th>
                  <th style={{ minWidth: 90 }} /><th className="n">Sobre o faturamento</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(([nome, a]) => (
                  <tr key={nome}>
                    <td><b>{nome}</b></td>
                    <td className="n">{num(a.matriculas)}</td>
                    <td className="n">{brl(a.faturamento)}</td>
                    <td className="n"><b>{brl(a.comissao, 2)}</b></td>
                    <td><div className="mini"><i style={{ width: `${(a.comissao / maiorC) * 100}%` }} /></div></td>
                    <td className="n num mudo">
                      {pct(a.faturamento ? a.comissao / a.faturamento : null, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      <h2><span className="idx" /> Por que cada um perde</h2>
      <p className="nota">
        Por que cada comercial perde, nos mesmos dois grupos do bloco 314: sumiço de um lado, perda
        comercial do outro. Serve para a conversa individual, porque quem perde por preço e quem perde
        por público errado precisam de orientação diferente.
        <Ajuda titulo="Como ler a fatia dentro do grupo"
          fontes={["Negociações perdidas no período: RD Station CRM, pelo motivo escrito lá",
                   "Grupo: sumiço contra motivo comercial, a mesma separação do bloco 314",
                   "Responsável: o dono do negócio no CRM no momento da perda"]}>
          A fatia é calculada <b>dentro do grupo daquela pessoa</b>, não sobre todas as perdas dela: é
          assim porque sumiço é a maioria esmagadora e, no total, afogaria os motivos comerciais que
          ensinam alguma coisa. Então leia as duas listas como duas conversas: na de sumiço o que importa
          é o tamanho comparado ao time, e na comercial o que importa é qual motivo aparece.
        </Ajuda>
      </p>
      {!perdas ? <p className="rotulo">Carregando</p> : perdas.length === 0 ? (
        <p className="mudo">Nenhuma perda registrada no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Comercial</th><th>Motivo</th><th>Grupo</th>
                <th className="n">Perdidas</th>
                <th style={{ minWidth: 90 }}>Fatia dentro do grupo</th>
              </tr>
            </thead>
            <tbody>
              {perdas.filter((x) => !quem || x.vendedor === quem).map((x, i, arr) => (
                <tr key={x.vendedor + x.motivo}>
                  <td>{i === 0 || arr[i - 1].vendedor !== x.vendedor ? <b>{x.vendedor}</b> : ""}</td>
                  <td>{x.motivo}</td>
                  <td className="mudo">{x.grupo === "sumico" ? "Sumiço" : "Comercial"}</td>
                  <td className="n">{num(x.perdidas)}</td>
                  <td>
                    <div className="mini"><i style={{ width: `${Number(x.fatia_no_grupo) * 100}%` }} /></div>
                    <div className="rotulo num">{pct(x.fatia_no_grupo)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
