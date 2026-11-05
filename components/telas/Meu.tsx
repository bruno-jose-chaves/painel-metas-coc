"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Detalhe, { type Recorte } from "@/components/Detalhe";
import Ajuda from "@/components/Ajuda";
import SeletorPeriodo from "@/components/Periodo";
import Chave from "@/components/Chave";
import MapaCalor, { type Celula } from "@/components/MapaCalor";
import { useUltima } from "@/lib/consulta";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, duracao, dataCurta } from "@/lib/formato";
import { ultimosDias, hojeSP, type Periodo } from "@/lib/periodo";

// A tela do vendedor.
//
// O painel inteiro foi feito para quem olha o time de cima. Quem vende precisa
// de outra coisa: o que é meu, o que está na minha mão agora e se eu estou bem
// ou mal. Até aqui ele tinha que procurar o próprio nome dentro de uma tabela
// de todo mundo, o que é lento e desconfortável.
//
// A comparação é contra a média do time, sem nome de ninguém. Comparação com
// nome vira ranking público e muda o comportamento de quem está embaixo; a
// média dá a referência sem expor colega. O melhor do time aparece como
// número, também sem nome, para existir um teto visível.

type Resumo = {
  vendedor: string; hoje: number; semana: number; mes: number; faturamento_mes: number;
  ticket_mes: number | null; carteira: number; parados: number; sem_resposta: number;
  atendidos_hoje: number; posicao: number; no_time: number;
};
type Linha = {
  indicador: string; rotulo: string; unidade: string; meu: number | null;
  media_time: number | null; melhor_do_time: number | null; maior_e_melhor: boolean; oque: string;
};
type Resposta = {
  vendedor: string; procuraram: number; mediana_min: number | null; p90_min: number | null;
  mediana_corrida: number | null; ate_15min: number; ate_1h: number; mais_de_1h: number;
  sem_resposta: number; fora_do_horario: number;
};
type Mix = {
  vendedor: string; produto_id: string | null; produto: string; vendas: number;
  faturamento: number; ticket: number | null; fatia: number;
};
type Comissao = {
  vendedor: string; mes: string; produto: string; matriculas: number;
  faturamento: number; percentual: number; comissao: number;
};
type CALOR = "enviadas" | "recebidas" | "chamadas" | "procuraram" | "ganhas" | "espera";
const CALORES: { id: CALOR; nome: string; oque: string; unidade: string }[] = [
  { id: "enviadas", nome: "Mensagens que você mandou", unidade: "mensagens",
    oque: "A hora em que você trabalha. É esforço, não resultado." },
  { id: "recebidas", nome: "Mensagens que você recebeu", unidade: "mensagens",
    oque: "A hora em que o seu cliente responde. É a hora que vale estar disponível." },
  { id: "chamadas", nome: "Pessoas que você chamou", unidade: "conversas",
    oque: "Conversa aberta por você, uma por pessoa." },
  { id: "procuraram", nome: "Pessoas que te procuraram", unidade: "conversas",
    oque: "Conversa aberta pelo cliente, hora a hora." },
  { id: "ganhas", nome: "Vendas fechadas", unidade: "ganhas",
    oque: "A hora em que o CRM marcou a venda." },
  { id: "espera", nome: "Espera média, hora a hora", unidade: "min de espera",
    oque: "Em cada faixa de hora, quantos minutos em média o cliente esperou pela sua primeira resposta. Aqui o quadrado escuro é ruim, não bom: é a hora em que você demora mais." },
];
type Fila = {
  tipo: string; prioridade: number; pessoa: string; telefone: string | null; onde: string;
  dias: number; desde: string; ja_e_aluno: boolean; o_que_fazer: string;
};

const mesCurto = (d: string) => {
  const [a, m] = d.slice(0, 7).split("-");
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1]
    + "/" + a.slice(2);
};

const resumoNome = (r: Resumo | null | "nenhum", quem: string) =>
  quem || (r && r !== "nenhum" ? r.vendedor : "");

const mostrar = (v: number | null, unidade: string) => {
  if (v == null) return "-";
  if (unidade === "brl") return brl(v);
  if (unidade === "pct") return pct(v);
  if (unidade === "min") return duracao(v);
  return num(Math.round(v * 10) / 10);
};

export default function Meu({ admin }: { admin?: boolean }) {
  const ultima = useUltima();
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(30));
  const [resumo, setResumo] = useState<Resumo | null | "nenhum">(null);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [fila, setFila] = useState<Fila[] | null>(null);
  const [quem, setQuem] = useState<string>("");
  const [nomes, setNomes] = useState<string[]>([]);
  const [detalhe, setDetalhe] = useState<{ titulo: string; recorte: Recorte } | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [mix, setMix] = useState<Mix[] | null>(null);
  const [comissao, setComissao] = useState<Comissao[] | null>(null);
  const [grade, setGrade] = useState<Celula[] | null>(null);
  const [calor, setCalor] = useState<CALOR>("recebidas");
  const [relogio, setRelogio] = useState<"util" | "corrido">("util");
  const [soDiaUtil, setSoDiaUtil] = useState(false);
  const [soComercial, setSoComercial] = useState(false);

  useEffect(() => {
    if (!admin) return;
    supabase.rpc("painel_cursos").then(() => {});
    supabase.from("vendedores").select("nome").eq("papel", "comercial").eq("ativo", true)
      .order("nome").then(({ data }) => setNomes(((data as { nome: string }[]) ?? []).map((v) => v.nome)));
  }, [admin]);

  useEffect(() => {
    setResumo(null); setFila(null);
    const p = quem ? { p_vendedor: quem } : {};
    supabase.rpc("painel_meu_resumo", p).then(({ data }) => {
      const l = (data as Resumo[]) ?? [];
      setResumo(l.length ? l[0] : "nenhum");
    });
    supabase.rpc("painel_minha_fila", { ...p, p_limite: 60 })
      .then(({ data }) => setFila((data as Fila[]) ?? []));
  }, [quem, volta]);

  useEffect(() => {
    setLinhas(null);
    ultima("contra", supabase.rpc("painel_meu_contra_time", {
      p_de: periodo.de, p_ate: periodo.ate, ...(quem ? { p_vendedor: quem } : {}),
    }), ({ data }) => setLinhas((data as Linha[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, quem, volta]);

  // Tempo de resposta e quadro de horário, do jeito que a tela de performance
  // mostra para o gestor: aqui filtrados na pessoa, porque é a leitura que ela
  // pode mudar amanhã.
  const euMesmo = resumoNome(resumo, quem);

  // Mix e comissao pedem o nome no parametro, nao filtram depois de receber o
  // time todo: valor de comissao e informacao de folha, e o banco agora so
  // devolve a propria linha para quem nao e diretoria.
  useEffect(() => {
    if (!euMesmo) return;
    setMix(null); setComissao(null);
    ultima("mix", supabase.rpc("painel_performance_mix", {
      p_de: periodo.de, p_ate: periodo.ate, p_vendedor: euMesmo,
    }), ({ data }) => setMix((data as Mix[]) ?? []));
    ultima("comissao", supabase.rpc("painel_comissao", {
      p_de: periodo.de, p_ate: periodo.ate, p_vendedor: euMesmo,
    }), ({ data }) => setComissao((data as Comissao[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, euMesmo, volta]);

  useEffect(() => {
    if (!euMesmo) return;
    setResposta(null);
    ultima("resp", supabase.rpc("painel_performance_resposta", {
      p_de: periodo.de, p_ate: periodo.ate, p_relogio: relogio,
      p_so_dia_util: soDiaUtil, p_so_horario_comercial: soComercial, p_vendedor: euMesmo,
    }), ({ data }) => setResposta(((data as Resposta[]) ?? [])[0] ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, relogio, soDiaUtil, soComercial, euMesmo, volta]);

  useEffect(() => {
    if (!euMesmo) return;
    setGrade(null);
    ultima("calor", supabase.rpc("painel_mapa_calor", {
      p_de: periodo.de, p_ate: periodo.ate, p_medida: calor, p_vendedor: euMesmo,
    }), ({ data }) => setGrade((data as Celula[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, calor, euMesmo, volta]);

  if (resumo === "nenhum") {
    return (
      <>
        <div className="rotulo">Comercial</div>
        <h1>Meu painel</h1>
        <p className="aviso-leve">
          Seu login ainda não está ligado a um vendedor do cadastro, então não dá para montar a
          sua visão. Quem resolve isso é o admin, em Ajustes, ligando o seu e-mail ao seu nome.
          {admin && nomes.length > 0 && (
            <> Como admin, você pode escolher um comercial no seletor abaixo para ver a tela dele.</>
          )}
        </p>
        {admin && nomes.length > 0 && (
          <div className="filtros">
            <label>
              <span className="rotulo">Ver a tela de</span>
              <select value={quem} onChange={(e) => setQuem(e.target.value)}>
                <option value="">Ninguém</option>
                {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="rotulo">Comercial</div>
      <h1>{quem ? quem : "Meu painel"}</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      {admin && nomes.length > 0 && (
        <div className="filtros">
          <label>
            <span className="rotulo">Ver a tela de</span>
            <select value={quem} onChange={(e) => setQuem(e.target.value)}>
              <option value="">Eu mesmo</option>
              {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="mudo" style={{ marginLeft: "auto", alignSelf: "center" }}>
            Só você vê este seletor. Cada comercial entra e vê a própria tela.
          </span>
        </div>
      )}

      <h2><span className="idx" /> O seu dia</h2>
      <p className="nota">
        O que é seu hoje, para abrir a tela e já saber onde está: matrícula fechada, conversa tocada e
        negociação na sua mão. É contagem do dia, não acumulado do mês.
        <Ajuda titulo="De onde sai cada número"
          fontes={["Matrículas: planilha comercial, pelo vendedor da linha e pela data da compra",
                   "Conversas: Pigeon Post, pelo atendente da conversa",
                   "Negociações em aberto: RD Station CRM, pelo responsável do negócio"]}>
          O vendedor da matrícula é o nome que está na coluna Vendedor da planilha, então venda lançada
          sem vendedor não aparece para ninguém. <b>Conversas</b> conta conversa tocada, não mensagem: dez
          mensagens na mesma conversa são uma. Clicando nas matrículas abre a lista nome por nome.
        </Ajuda>
      </p>
      {!resumo ? <p className="rotulo">Carregando</p> : (
        <>
          <div className="faixa">
            <div className="abre" onClick={() => setDetalhe({
              titulo: "Minhas matrículas de hoje",
              recorte: { p_de: hojeSP(), p_ate: hojeSP(), p_vendedor: resumo.vendedor },
            })}>
              <div className="rotulo">Matrículas hoje</div>
              <div className="valor num">{num(resumo.hoje)}</div>
              <div className="mudo num">{num(resumo.atendidos_hoje)} pessoas atendidas</div>
            </div>
            <div>
              <div className="rotulo">Na semana</div>
              <div className="valor num">{num(resumo.semana)}</div>
            </div>
            <div className="abre" onClick={() => setDetalhe({
              titulo: "Minhas matrículas do mês",
              recorte: { p_de: hojeSP().slice(0, 7) + "-01", p_ate: hojeSP(), p_vendedor: resumo.vendedor },
            })}>
              <div className="rotulo">No mês</div>
              <div className="valor num">{num(resumo.mes)}</div>
              <div className="mudo num">{brl(resumo.faturamento_mes)}</div>
            </div>
            <div>
              <div className="rotulo">Ticket do mês</div>
              <div className="valor num">{brl(resumo.ticket_mes)}</div>
            </div>
            <div>
              <div className="rotulo">Na sua mão</div>
              <div className="valor num">{num(resumo.carteira)}</div>
              <div className={"mudo num " + (resumo.parados > 0 ? "alerta" : "")}>
                {num(resumo.parados)} parad{resumo.parados === 1 ? "a" : "as"} há mais de 15 dias
              </div>
            </div>
          </div>
          {resumo.sem_resposta > 0 && (
            <p className="aviso-leve">
              <b>{num(resumo.sem_resposta)}</b> pessoas falaram com você nos últimos 14 dias e
              nunca responderam. Vale uma segunda mensagem antes de dar como perdida.
            </p>
          )}
        </>
      )}

      <h2><span className="idx" /> Quanto você ganhou</h2>
      <p className="nota">
        Quanto a comissão fixa das suas vendas do período soma, pela regra em vigor: 3% em Semi e
        Extensivo, 5% nos demais. Serve para acompanhar, não para fechar folha.
        <Ajuda titulo="Por que este número é o teto, e não o contracheque"
          fontes={["Vendas e valor: planilha comercial, pelo vendedor da linha",
                   "Percentual de cada produto: tabela de regras de comissão, em Ajustes",
                   "Regra da casa: Premiações 2026 v3"]}>
          A regra da casa paga sobre a <b>parcela paga</b>, não sobre o valor da matrícula. O
          painel recebe a venda fechada, não o pagamento de cada parcela, então o que aparece
          aqui é quanto você recebe <b>se o aluno pagar tudo</b>. Se ele parar de pagar, a
          comissão para junto.
          <br /><br />
          O <b>bônus por meta</b> não entra nesta conta: ele depende do quadro de colaboradores
          ativos no período, com peso de CLT e MEI, que é informação que não vive aqui.
          <br /><br />
          Serve para acompanhar, não para fechar folha.
        </Ajuda>
      </p>
      {!comissao ? <p className="rotulo">Carregando</p> : (() => {
        const meu = comissao.filter((c) => c.vendedor === euMesmo);
        if (meu.length === 0) return (
          <p className="mudo">
            Nenhuma venda com comissão no período {euMesmo ? "para " + euMesmo : ""}. Entram aqui só
            matrícula não cancelada, com valor lançado na planilha e com o nome do vendedor preenchido.
          </p>
        );
        const total = meu.reduce((s, c) => s + Number(c.comissao), 0);
        const porMes = new Map<string, number>();
        for (const c of meu) porMes.set(c.mes, (porMes.get(c.mes) ?? 0) + Number(c.comissao));
        const meses = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0]));
        return (
          <>
            <div className="faixa">
              <div>
                <div className="rotulo">No período escolhido</div>
                <div className="valor num">{brl(total)}</div>
                <div className="mudo num">
                  {num(meu.reduce((s, c) => s + Number(c.matriculas), 0))} matrículas
                </div>
              </div>
              {meses.slice(0, 4).map(([mes, v]) => (
                <div key={mes}>
                  <div className="rotulo">{mesCurto(mes)}</div>
                  <div className="valor num">{brl(v)}</div>
                </div>
              ))}
            </div>
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Mês</th><th>Produto</th><th className="n">Matrículas</th>
                    <th className="n">Faturamento</th><th className="n">%</th><th className="n">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {meu.map((c, i) => (
                    <tr key={c.mes + c.produto}>
                      <td>{i === 0 || meu[i - 1].mes !== c.mes ? <b>{mesCurto(c.mes)}</b> : ""}</td>
                      <td>{c.produto}</td>
                      <td className="n">{num(c.matriculas)}</td>
                      <td className="n">{brl(c.faturamento)}</td>
                      <td className="n num mudo">{pct(c.percentual, 0)}</td>
                      <td className="n"><b>{brl(c.comissao, 2)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      <h2><span className="idx" /> Você contra a média do time</h2>
      <p className="nota">
        Onde você está em relação ao time nos indicadores que você controla. Sem nome de ninguém, de
        propósito: a média serve de referência e o melhor do time serve de teto, e saber quem é não muda
        o que você faz amanhã.
        <Ajuda titulo="Como ler esta tabela"
          fontes={["Matrículas, ticket e faturamento: planilha comercial, pelo vendedor da linha",
                   "Pessoas atendidas e tempo de resposta: Pigeon Post, pelo atendente da conversa",
                   "Média e melhor do time: só quem tem papel comercial, no mesmo período"]}>
          A barra mostra onde você está entre a média e o melhor do time. Nos dois últimos
          indicadores, menor é melhor: tempo até responder e fatia de gente que nunca recebeu
          resposta.
          <br /><br />
          Nenhum destes números é meta individual. O COC não premia volume individual, e isso
          não mudou: a tabela existe para você saber onde está, não para ser cobrado por ela.
        </Ajuda>
      </p>
      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />
      {!linhas ? <p className="rotulo">Carregando</p> : linhas.length === 0 ? (
        <p className="mudo">Sem dado no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Indicador</th><th className="n">Você</th><th className="n">Média do time</th>
                <th style={{ minWidth: 120 }} /><th className="n">Melhor do time</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const meu = l.meu == null ? null : Number(l.meu);
                const media = l.media_time == null ? null : Number(l.media_time);
                const melhor = l.melhor_do_time == null ? null : Number(l.melhor_do_time);
                const bom = meu != null && media != null
                  && (l.maior_e_melhor ? meu >= media : meu <= media);
                const fatia = meu != null && melhor ? Math.min(1, Math.max(0,
                  l.maior_e_melhor ? meu / melhor : melhor / Math.max(meu, 0.0001))) : 0;
                return (
                  <tr key={l.indicador}>
                    <td>
                      <b>{l.rotulo}</b>
                      <div className="rotulo">{l.oque}</div>
                    </td>
                    <td className={"n num " + (bom ? "ok" : "alerta")}>
                      <b>{mostrar(meu, l.unidade)}</b>
                    </td>
                    <td className="n num mudo">{mostrar(media, l.unidade)}</td>
                    <td><div className="mini"><i style={{ width: `${fatia * 100}%` }} /></div></td>
                    <td className="n num mudo">{mostrar(melhor, l.unidade)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Quanto esperam por você</h2>
      <p className="nota">
        Quanto tempo o cliente espera pela sua primeira resposta. Conta só conversa que o cliente
        começou, porque quando é você que abre, a primeira mensagem é a sua e a conta mediria o disparo
        e não o atendimento.
        <Ajuda titulo="Os dois relógios"
          fontes={["Mensagens recebidas e enviadas: Pigeon Post, com data e hora de cada uma",
                   "Relógio comercial: só minutos de dia útil entre 8h e 18h",
                   "Conversa sem resposta: nenhuma mensagem nossa depois da primeira do cliente"]}>
          <b>Relógio comercial</b> conta só os minutos de dia útil entre 8h e 18h. Mensagem que
          chega sábado às 22h e você responde segunda às 8h05 conta como 5 minutos, porque não
          tinha ninguém para atender no meio. É o que mede você.
          <br /><br />
          <b>Relógio corrido</b> conta tudo, do minuto em que a mensagem chegou ao minuto da
          resposta. No mesmo caso dá 34 horas. É o que o cliente sentiu.
          <br /><br />
          <b>Mediana</b> é o caso do meio: metade foi atendida em menos que isso.
        </Ajuda>
      </p>
      <div className="filtros" style={{ flexWrap: "wrap" }}>
        <div className="atalhos">
          <button className={relogio === "util" ? "ativo" : ""} onClick={() => setRelogio("util")}>
            Relógio comercial
          </button>
          <button className={relogio === "corrido" ? "ativo" : ""} onClick={() => setRelogio("corrido")}>
            Relógio corrido
          </button>
        </div>
        <div className="chaves-filtro">
          <Chave ligada={soDiaUtil} aoMudar={setSoDiaUtil}
                 ajuda="Ligado, tira da conta a conversa que chegou no sábado ou domingo.">
            Tirar sábado e domingo
          </Chave>
          <Chave ligada={soComercial} aoMudar={setSoComercial}
                 ajuda="Ligado, conta só a conversa que chegou entre 8h e 18h.">
            Só das 8h às 18h
          </Chave>
        </div>
      </div>
      {!resposta ? <p className="mudo">Ninguém te procurou no período, com estes filtros.</p> : (
        <div className="faixa">
          <div>
            <div className="rotulo">Te procuraram</div>
            <div className="valor num">{num(resposta.procuraram)}</div>
          </div>
          <div>
            <div className="rotulo">Mediana</div>
            <div className="valor num">{duracao(resposta.mediana_min)}</div>
            {relogio === "util" && resposta.mediana_corrida != null && (
              <div className="mudo num">corrido: {duracao(resposta.mediana_corrida)}</div>
            )}
          </div>
          <div>
            <div className="rotulo">90% esperaram até</div>
            <div className="valor num">{duracao(resposta.p90_min)}</div>
          </div>
          <div>
            <div className="rotulo">Atendidos em 15 min</div>
            <div className="valor num">{pct(resposta.procuraram ? resposta.ate_15min / resposta.procuraram : null)}</div>
            <div className="mudo num">{num(resposta.ate_15min)} pessoas</div>
          </div>
          <div>
            <div className="rotulo">Sem resposta nenhuma</div>
            <div className={"valor num " + (resposta.sem_resposta > 0 ? "alerta" : "")}>
              {num(resposta.sem_resposta)}
            </div>
            <div className="mudo num">{pct(resposta.procuraram ? resposta.sem_resposta / resposta.procuraram : null)}</div>
          </div>
          <div>
            <div className="rotulo">Chegou fora do horário</div>
            <div className="valor num">{num(resposta.fora_do_horario)}</div>
            <div className="mudo num">{pct(resposta.procuraram ? resposta.fora_do_horario / resposta.procuraram : null)}</div>
          </div>
        </div>
      )}

      <h2><span className="idx" /> O seu quadro de horário</h2>
      <p className="nota">
        A sua semana em hora e dia: cada quadradinho é uma faixa de uma hora, e quanto mais escuro,
        maior o número naquela faixa. Serve para descobrir se o seu esforço está no horário em que o
        cliente aparece. {CALORES.find((c) => c.id === calor)?.oque}
        <Ajuda titulo="Como ler o quadro"
          fontes={["Mensagens, conversas e tempo de espera: Pigeon Post, pela hora de cada mensagem",
                   "Matrículas: planilha comercial, pela data da compra",
                   "Fuso: tudo convertido para o horário de São Paulo"]}>
          A escala é relativa a você e ao período escolhido, não ao time: o quadrado mais escuro é o seu
          pico, qualquer que seja o número. Troque a medida nos botões e compare duas: se as suas
          mensagens saem às 9h e as do cliente chegam às 19h, o esforço está no horário errado. Se a
          espera cresce justo na faixa em que mais gente te procura, falta tempo ali, não falta vontade.
          A medida de matrícula usa a data da compra, que é quando a venda foi lançada e não
          necessariamente a hora da conversa que fechou.
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

      <h2><span className="idx" /> O que você vende</h2>
      <p className="nota">
        O seu mix: quanto de cada produto você vendeu no período e quanto cada um pesa no seu
        faturamento. Serve para ler o seu ticket médio sem se enganar, porque ticket sozinho não diz
        nada: intensivo e extensivo têm ticket dez vezes diferente, e uma venda de Semi muda o seu
        ticket do mês inteiro.
        <Ajuda titulo="O que cada coluna significa"
          fontes={["Matrículas, valor e desconto: planilha comercial, pelo vendedor da linha",
                   "Produto de cada venda: o curso da planilha, apontado para produto em Ajustes, Cursos"]}>
          <b>Matrículas</b> é linha de venda, não pessoa. <b>Fatia</b> é quanto aquele produto representa
          das suas matrículas no período. <b>Ticket</b> é o faturamento daquele produto dividido pelas
          matrículas dele, então ele se mexe com desconto dado e com fase de preço, não só com o produto.
          <b> Faturamento</b> é o valor cheio da matrícula no dia em que foi lançada, não a parcela paga.
        </Ajuda>
      </p>
      {!mix ? <p className="rotulo">Carregando</p> : (() => {
        const meu = mix.filter((m) => m.vendedor === euMesmo);
        if (meu.length === 0) return <p className="mudo">Sem matrícula no período.</p>;
        return (
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th><th className="n">Matrículas</th>
                  <th style={{ minWidth: 100 }}>Fatia do que você vendeu</th>
                  <th className="n">Ticket</th><th className="n">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {meu.map((m) => (
                  <tr key={m.produto}>
                    <td><b>{m.produto}</b></td>
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
        );
      })()}

      <h2><span className="idx" /> O que está na sua mão agora</h2>
      <p className="nota">
        A sua fila do momento: negociação parada, conversa sem resposta e lead sem primeiro contato,
        em ordem do que mais aperta e não do mais antigo. É a única parte desta tela que pede ação hoje.
        <Ajuda titulo="Como a ordem é decidida"
          fontes={["Negociações em aberto e tempo parado: RD Station CRM, pelo responsável do negócio",
                   "Conversa sem resposta: Pigeon Post, pelo atendente da conversa",
                   "É a mesma fila da tela Marketing, O que está escapando, filtrada em você"]}>
          <b>Parada há</b> conta desde a última mexida registrada, não desde a criação. A ordem pesa o
          tipo de buraco e o tempo junto: cliente que mandou mensagem e não foi respondido vem antes de
          negociação antiga esquecida, porque no primeiro caso a pessoa está esperando agora.
          <b> O que fazer</b> é a ação sugerida para aquele tipo de buraco, não tarefa atribuída.
        </Ajuda>
      </p>
      {!fila ? <p className="rotulo">Carregando</p> : fila.length === 0 ? (
        <p className="mudo">Nada parado na sua mão. É uma boa notícia.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Pessoa</th><th>Situação</th><th className="n">Parada há</th><th>O que fazer</th>
              </tr>
            </thead>
            <tbody>
              {fila.map((f, i) => (
                <tr key={f.pessoa + i}>
                  <td>
                    <b>{f.pessoa}</b>
                    {f.ja_e_aluno && <div className="rotulo">já é aluno</div>}
                    {f.telefone && <div className="rotulo num">{f.telefone}</div>}
                  </td>
                  <td>
                    {f.tipo}
                    <div className="rotulo">{f.onde}</div>
                  </td>
                  <td className={"n num " + (f.dias > 30 ? "alerta" : "")}>
                    {num(f.dias)} d
                    <div className="rotulo num">desde {dataCurta(f.desde)}</div>
                  </td>
                  <td className="mudo">{f.o_que_fazer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && (
        <Detalhe titulo={detalhe.titulo} recorte={detalhe.recorte} aoFechar={() => setDetalhe(null)} />
      )}
    </>
  );
}
