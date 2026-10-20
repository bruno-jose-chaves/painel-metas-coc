"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import SeletorPeriodo from "@/components/Periodo";
import { ultimosDias, type Periodo } from "@/lib/periodo";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, pct } from "@/lib/formato";

// Qualidade do lead, pelo lado da conversa.
//
// Duas medições com alcances diferentes, e a tela diz isso em vez de fingir que
// é tudo a mesma coisa. Resposta do cliente e tempo de atendimento existem desde
// agosto, porque vêm do próprio registro da conversa. Virou matrícula só vale de
// outubro em diante: o telefone da conversa só passou a ser guardado quando o
// webhook de sessão entrou no ar, e sem telefone não há como cruzar com a
// planilha.
//
// Por isso a conversão aparece sempre com a base ao lado. Taxa sem denominador
// à vista é taxa que engana.

type Linha = {
  canal: string; time_dono: string; quem_comecou: string;
  conversas: number; responderam: number; nunca_responderam: number;
  minutos_ate_atender: number | null; p90_minutos: number | null;
  em_ate_15min: number; em_ate_1h: number; depois_de_1h: number;
  com_telefone: number; viraram_matricula: number; dias_ate_comprar: number | null;
};
type Espera = {
  dia_semana: number; nome_dia: string; faixa_hora: number;
  procuraram: number; mediana_min: number | null; p90_min: number | null;
  em_ate_15min: number; mais_de_1h: number;
};

// Minuto puro fica ilegível acima de uma hora: "2356 min" ninguém lê como
// "quase dois dias".
function tempo(min: number | null | undefined) {
  if (min == null) return "-";
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 60 * 24) return `${(min / 60).toFixed(1).replace(".", ",")} h`;
  return `${(min / 60 / 24).toFixed(1).replace(".", ",")} dias`;
}

export default function Qualidade() {
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(() => ultimosDias(30));
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [espera, setEspera] = useState<Espera[] | null>(null);

  useEffect(() => {
    setLinhas(null);
    supabase.rpc("painel_qualidade_lead", { p_de: periodo.de, p_ate: periodo.ate })
      .then(({ data }) => setLinhas((data as Linha[]) ?? []));
    supabase.rpc("painel_espera_atendimento", { p_de: periodo.de, p_ate: periodo.ate })
      .then(({ data }) => setEspera((data as Espera[]) ?? []));
  }, [periodo, volta]);

  const entrou = useMemo(() => (linhas ?? []).filter((l) => l.quem_comecou === "Cliente procurou"), [linhas]);
  const saiu = useMemo(() => (linhas ?? []).filter((l) => l.quem_comecou !== "Cliente procurou"), [linhas]);
  const soma = (l: Linha[], c: keyof Linha) => l.reduce((s, x) => s + Number(x[c] ?? 0), 0);

  // Por dia da semana, que é onde o buraco de fim de semana aparece.
  const porDia = useMemo(() => {
    const m = new Map<number, { nome: string; n: number; mais1h: number; ate15: number; soma: number }>();
    for (const e of espera ?? []) {
      const a = m.get(e.dia_semana) ?? { nome: e.nome_dia, n: 0, mais1h: 0, ate15: 0, soma: 0 };
      a.n += Number(e.procuraram);
      a.mais1h += Number(e.mais_de_1h);
      a.ate15 += Number(e.em_ate_15min);
      a.soma += Number(e.mediana_min ?? 0) * Number(e.procuraram);
      m.set(e.dia_semana, a);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [espera]);
  const piorDia = porDia.length
    ? porDia.reduce((p, c) => (c[1].n && c[1].mais1h / c[1].n > (p[1].n ? p[1].mais1h / p[1].n : 0) ? c : p))
    : null;

  return (
    <>
      <div className="rotulo">Qualidade do lead</div>
      <h1>Quem chega, quem responde, quanto espera</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <p className="nota">
        A conversa separada por quem deu o primeiro passo, porque lead que procura e lead que foi
        procurado não se comparam.
        <Ajuda titulo="O que cada número mede, e até onde ele vale"
          fontes={["Conversas, quem começou e horário: Pigeon Post (tabela pigeon_conversas)",
                   "Respondeu: a conversa registra a primeira mensagem do cliente",
                   "Tempo até atender: primeira resposta nossa menos o início da conversa",
                   "Virou matrícula: planilha comercial (tabela vendas), cruzando por telefone"]}>
          <b>Respondeu</b> e <b>tempo até atender</b> valem desde agosto, porque vêm do próprio registro
          da conversa. <b>Virou matrícula</b> só vale de outubro em diante: o telefone da conversa só
          passou a ser guardado quando o webhook de sessão entrou no ar, e sem telefone não dá para
          cruzar com a planilha. Por isso a conversão aparece sempre com a base do lado. O tempo até
          atender só é contado em conversa que o cliente começou: quando somos nós que abrimos, a
          primeira resposta é a nossa própria mensagem e a conta mediria o disparo, não o atendimento.
        </Ajuda>
      </p>

      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />

      {!linhas ? <p className="rotulo">Carregando</p> : (
        <>
          <h2><span className="idx">090</span> Procurou contra foi procurado</h2>
          <div className="faixa">
            <div>
              <div className="rotulo">O cliente procurou</div>
              <div className="valor num">{num(soma(entrou, "conversas"))}</div>
              <div className="mudo num">
                {soma(entrou, "com_telefone")
                  ? pct(soma(entrou, "viraram_matricula") / soma(entrou, "com_telefone")) + " viraram matrícula"
                  : ""}
              </div>
            </div>
            <div>
              <div className="rotulo">Nós procuramos</div>
              <div className="valor num">{num(soma(saiu, "conversas"))}</div>
              <div className="mudo num">
                {soma(saiu, "com_telefone")
                  ? pct(soma(saiu, "viraram_matricula") / soma(saiu, "com_telefone")) + " viraram matrícula"
                  : ""}
              </div>
            </div>
            <div>
              <div className="rotulo">Nunca responderam</div>
              <div className="valor num">{num(soma(linhas, "nunca_responderam"))}</div>
              <div className="mudo num">
                {soma(linhas, "conversas")
                  ? pct(soma(linhas, "nunca_responderam") / soma(linhas, "conversas")) + " de tudo que abriu"
                  : ""}
              </div>
            </div>
            <div>
              <div className="rotulo">Atendido em até 15 min</div>
              <div className="valor num">{num(soma(entrou, "em_ate_15min"))}</div>
              <div className="mudo">de quem procurou a gente</div>
            </div>
          </div>

          {soma(entrou, "com_telefone") > 0 && soma(saiu, "com_telefone") > 0 && (
            <p className="aviso-leve">
              Lead que procura converte{" "}
              <b>
                {(
                  (soma(entrou, "viraram_matricula") / soma(entrou, "com_telefone")) /
                  Math.max(1e-9, soma(saiu, "viraram_matricula") / soma(saiu, "com_telefone"))
                ).toFixed(1).replace(".", ",")}x
              </b>{" "}
              mais que lead que a gente foi atrás. A conversão aqui conta só quem tem telefone guardado,
              que é {pct((soma(linhas, "com_telefone")) / Math.max(1, soma(linhas, "conversas")))} do
              período escolhido.
            </p>
          )}

          <h2><span className="idx">091</span> Cada canal por inteiro</h2>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Quem começou</th>
                  <th className="n">Conversas</th>
                  <th className="n">Responderam</th>
                  <th className="n">Nunca responderam</th>
                  <th className="n">Até atender</th>
                  <th className="n">Pior 10%</th>
                  <th className="n">Matrículas</th>
                  <th className="n">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.canal + l.quem_comecou}
                      className={Number(l.minutos_ate_atender ?? 0) > 60 ? "fora" : undefined}>
                    <td>
                      <b>{l.canal}</b>
                      <div className="ids">{l.time_dono}</div>
                    </td>
                    <td>
                      <span className={"selo " + (l.quem_comecou === "Cliente procurou" ? "no_ritmo" : "")}>
                        {l.quem_comecou}
                      </span>
                    </td>
                    <td className="n"><b>{num(l.conversas)}</b></td>
                    <td className="n">
                      {num(l.responderam)}
                      <div className="ids num">
                        {l.conversas ? pct(Number(l.responderam) / Number(l.conversas)) : ""}
                      </div>
                    </td>
                    <td className="n">{num(l.nunca_responderam)}</td>
                    <td className="n num">{tempo(l.minutos_ate_atender)}</td>
                    <td className="n num mudo">{tempo(l.p90_minutos)}</td>
                    <td className="n">{num(l.viraram_matricula)}</td>
                    <td className="n num">
                      {Number(l.com_telefone) > 0
                        ? pct(Number(l.viraram_matricula) / Number(l.com_telefone))
                        : <span className="mudo">sem base</span>}
                      <div className="ids">
                        {Number(l.com_telefone) > 0 ? `de ${num(l.com_telefone)} com telefone` : "telefone não guardado"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2><span className="idx">092</span> Quanto o cliente espera, por dia da semana</h2>
          <p className="nota">
            Só conversa que o cliente começou. É a única em que esperar quer dizer alguma coisa.
            {piorDia && Number(piorDia[1].n) > 0 && (
              <> No período escolhido, <b>{piorDia[1].nome}</b> é o pior dia para quem procura a gente.</>
            )}
          </p>
          {!espera ? <p className="rotulo">Carregando</p> : porDia.length === 0 ? (
            <p className="mudo">Ninguém procurou a gente neste período.</p>
          ) : (
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th className="n">Procuraram</th>
                    <th className="n">Atendidos em até 15 min</th>
                    <th className="n">Esperaram mais de 1 h</th>
                    <th style={{ minWidth: 160 }}>Fatia que esperou demais</th>
                  </tr>
                </thead>
                <tbody>
                  {porDia.map(([d, a]) => {
                    const ruim = a.n ? a.mais1h / a.n : 0;
                    return (
                      <tr key={d} className={ruim > 0.5 ? "fora" : undefined}>
                        <td><b>{a.nome}</b></td>
                        <td className="n">{num(a.n)}</td>
                        <td className="n">{num(a.ate15)}</td>
                        <td className="n">{num(a.mais1h)}</td>
                        <td>
                          <div className="mini"><i style={{ width: `${ruim * 100}%` }} /></div>
                          <div className="ids num">{pct(ruim)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="rodape">
            O horário é o de Brasília. Conversa que o cliente começou e que nunca foi respondida não entra
            na conta de tempo, porque não existe tempo para medir: ela aparece em &quot;nunca
            responderam&quot; na tabela de cima.
          </p>
        </>
      )}
    </>
  );
}
