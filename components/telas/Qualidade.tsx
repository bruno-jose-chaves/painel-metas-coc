"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUltima } from "@/lib/consulta";
import Ajuda from "@/components/Ajuda";
import SeletorPeriodo from "@/components/Periodo";
import Chave from "@/components/Chave";
import { ultimosDias, type Periodo } from "@/lib/periodo";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, pct, duracao } from "@/lib/formato";

// Qualidade do lead, pelo lado da conversa.
//
// Duas medições com alcances diferentes, e a tela diz isso em vez de fingir que
// é tudo a mesma coisa. Resposta do cliente e tempo de atendimento vêm do
// próprio registro da conversa e valem desde agosto. Virou matrícula depende de
// cruzar o telefone com a planilha, e o telefone só é conhecido em parte das
// conversas antigas. Por isso a conversão aparece sempre com a base do lado:
// taxa sem denominador à vista é taxa que engana.
//
// Fim de semana e madrugada entram ou saem por escolha, não por regra fixa. O
// comercial não é cobrado por atender sábado, então deixar sábado dentro da
// média estraga a média. Mas sumir com o sábado esconderia que gente procurou a
// COC e ficou esperando até segunda. Os dois recortes precisam existir, e por
// isso o bloco por dia da semana ignora os filtros e mostra sempre a semana
// inteira.

type Linha = {
  canal: string; time_dono: string; quem_comecou: string;
  conversas: number; responderam: number; nunca_responderam: number;
  minutos_ate_atender: number | null; p90_minutos: number | null;
  em_ate_15min: number; em_ate_1h: number; depois_de_1h: number;
  com_telefone: number; viraram_matricula: number; dias_ate_comprar: number | null;
};
type Espera = {
  dia_semana: number; nome_dia: string; fim_de_semana: boolean; faixa_hora: number;
  procuraram: number; mediana_min: number | null; p90_min: number | null;
  em_ate_15min: number; mais_de_1h: number; nunca_respondida: number;
};
type Filtro = { tipo: string; valor: string; rotulo: string; quantos: number };

export default function Qualidade() {
  const ultima = useUltima();
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(() => ultimosDias(30));
  const [atendente, setAtendente] = useState<string>("");
  const [turma, setTurma] = useState<string>("");
  const [soDiaUtil, setSoDiaUtil] = useState(true);
  const [soComercial, setSoComercial] = useState(true);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [espera, setEspera] = useState<Espera[] | null>(null);
  const [filtros, setFiltros] = useState<Filtro[]>([]);

  useEffect(() => {
    setLinhas(null);
    ultima("linhas", supabase.rpc("painel_qualidade_lead", {
      p_de: periodo.de, p_ate: periodo.ate,
      p_atendente: atendente || null, p_turma: turma || null,
      p_so_dia_util: soDiaUtil, p_so_horario_comercial: soComercial,
    }), ({ data }) => setLinhas((data as Linha[]) ?? []));
  }, [periodo, atendente, turma, soDiaUtil, soComercial, volta]);

  useEffect(() => {
    // O bloco por dia da semana não recebe os filtros de dia útil e horário:
    // seria esconder justamente o que ele existe para mostrar.
    ultima("espera", supabase.rpc("painel_espera_atendimento", {
      p_de: periodo.de, p_ate: periodo.ate,
      p_atendente: atendente || null, p_turma: turma || null,
    }), ({ data }) => setEspera((data as Espera[]) ?? []));
    supabase.rpc("painel_filtros_conversa", { p_de: periodo.de, p_ate: periodo.ate })
      .then(({ data }) => setFiltros((data as Filtro[]) ?? []));
  }, [periodo, atendente, turma, volta]);

  const entrou = useMemo(() => (linhas ?? []).filter((l) => l.quem_comecou === "Cliente procurou"), [linhas]);
  const saiu = useMemo(() => (linhas ?? []).filter((l) => l.quem_comecou !== "Cliente procurou"), [linhas]);
  const soma = (l: Linha[], c: keyof Linha) => l.reduce((s, x) => s + Number(x[c] ?? 0), 0);
  const taxa = (l: Linha[]) => {
    const base = soma(l, "com_telefone");
    return base ? soma(l, "viraram_matricula") / base : null;
  };

  const porDia = useMemo(() => {
    const m = new Map<number, { nome: string; fds: boolean; n: number; mais1h: number; ate15: number; mudo: number }>();
    for (const e of espera ?? []) {
      const a = m.get(e.dia_semana) ?? { nome: e.nome_dia, fds: e.fim_de_semana, n: 0, mais1h: 0, ate15: 0, mudo: 0 };
      a.n += Number(e.procuraram);
      a.mais1h += Number(e.mais_de_1h);
      a.ate15 += Number(e.em_ate_15min);
      a.mudo += Number(e.nunca_respondida);
      m.set(e.dia_semana, a);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [espera]);

  const fds = porDia.filter(([, a]) => a.fds).reduce((s, [, a]) => s + a.n, 0);
  const fdsRuim = porDia.filter(([, a]) => a.fds).reduce((s, [, a]) => s + a.mais1h, 0);
  const mudos = porDia.reduce((s, [, a]) => s + a.mudo, 0);

  const atendentes = filtros.filter((f) => f.tipo === "atendente");
  const turmas = filtros.filter((f) => f.tipo === "turma");
  const taxaEntrou = taxa(entrou);
  const taxaSaiu = taxa(saiu);

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
          fontes={["Conversas, quem começou e horário: Pigeon Post",
                   "Respondeu: a conversa registra a primeira mensagem do cliente",
                   "Tempo até atender: nossa primeira resposta menos o começo da conversa",
                   "Virou matrícula: planilha comercial de vendas, pelo telefone"]}>
          <b>Respondeu</b> e <b>tempo até atender</b> valem desde agosto, porque vêm do próprio
          registro da conversa. <b>Virou matrícula</b> depende de conhecer o telefone de quem
          conversou, e em conversa antiga o telefone nem sempre ficou guardado: por isso a conversão
          aparece sempre com a base do lado. O tempo até atender só é contado em conversa que o cliente
          começou. Quando somos nós que abrimos, a primeira resposta é a nossa própria mensagem e a
          conta mediria o disparo, não o atendimento.
        </Ajuda>
      </p>

      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />

      <div className="filtros" style={{ flexWrap: "wrap" }}>
        <label>
          <span className="rotulo">Quem atendeu</span>
          <select value={atendente} onChange={(e) => setAtendente(e.target.value)}>
            <option value="">Todo mundo</option>
            {atendentes.map((a) => (
              <option key={a.valor} value={a.valor}>{a.rotulo} ({num(a.quantos)})</option>
            ))}
          </select>
        </label>
        <label>
          <span className="rotulo">Interesse</span>
          <select value={turma} onChange={(e) => setTurma(e.target.value)}>
            <option value="">Todos os cursos</option>
            {turmas.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo} ({num(t.quantos)})</option>
            ))}
          </select>
        </label>
        <div className="chaves-filtro">
          <Chave ligada={soDiaUtil} aoMudar={setSoDiaUtil}
                 ajuda="Ligado, tira sábado e domingo da conta. O bloco por dia da semana continua mostrando a semana inteira.">
            Tirar sábado e domingo
          </Chave>
          <Chave ligada={soComercial} aoMudar={setSoComercial}
                 ajuda="Ligado, conta só conversa aberta entre 8h e 18h, para madrugada não estragar a média.">
            Só das 8h às 18h
          </Chave>
        </div>
      </div>

      {turmas.length > 0 && (
        <p className="nota" style={{ marginTop: 0 }}>
          O interesse vem da etiqueta que o time coloca no contato, e nem todo contato tem etiqueta.
          Filtrar por curso mostra só quem já foi etiquetado.
        </p>
      )}

      {!linhas ? <p className="rotulo">Carregando</p> : (
        <>
          <h2><span className="idx" /> Procurou contra foi procurado</h2>
          <div className="faixa">
            <div>
              <div className="rotulo">O cliente procurou</div>
              <div className="valor num">{num(soma(entrou, "conversas"))}</div>
              <div className="mudo num">
                {taxaEntrou != null ? pct(taxaEntrou) + " viraram matrícula" : "sem base para conversão"}
              </div>
            </div>
            <div>
              <div className="rotulo">Nós procuramos</div>
              <div className="valor num">{num(soma(saiu, "conversas"))}</div>
              <div className="mudo num">
                {taxaSaiu != null ? pct(taxaSaiu) + " viraram matrícula" : "sem base para conversão"}
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
              <div className="mudo num">
                {soma(entrou, "conversas")
                  ? pct(soma(entrou, "em_ate_15min") / soma(entrou, "conversas")) + " de quem procurou"
                  : ""}
              </div>
            </div>
          </div>

          {taxaEntrou != null && taxaSaiu != null && taxaSaiu > 0 && (
            <p className="aviso-leve">
              Lead que procura converte <b>{(taxaEntrou / taxaSaiu).toFixed(1).replace(".", ",")}x</b> mais
              que lead que a gente foi atrás.{" "}
              <b>O que fazer:</b> quem chega sozinho merece resposta rápida antes de qualquer disparo
              novo, porque é o lead mais caro de perder.
            </p>
          )}

          <h2><span className="idx" /> Cada canal por inteiro</h2>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Quem começou</th>
                  <th className="n">Conversas</th>
                  <th className="n">Responderam</th>
                  <th className="n">Até atender</th>
                  <th className="n">Pior 10%</th>
                  <th className="n">Viraram matrícula</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const lento = Number(l.minutos_ate_atender ?? 0) > 60;
                  return (
                    <tr key={l.canal + l.quem_comecou} className={lento ? "fora" : undefined}>
                      <td>
                        <b>{l.canal}</b>
                        <div className="ids">{l.time_dono}</div>
                        {lento && <span className="selo atras">demora mais de 1 h</span>}
                      </td>
                      <td>
                        <span className={"selo " + (l.quem_comecou === "Cliente procurou" ? "no_ritmo" : "neutro")}>
                          {l.quem_comecou}
                        </span>
                      </td>
                      <td className="n"><b>{num(l.conversas)}</b></td>
                      <td className="n">
                        <b>{num(l.responderam)}</b>
                        <div className="ids num">
                          {l.conversas ? pct(Number(l.responderam) / Number(l.conversas)) : ""}
                          {Number(l.nunca_responderam) > 0
                            ? ` · ${num(l.nunca_responderam)} nunca` : ""}
                        </div>
                      </td>
                      <td className="n num">{duracao(l.minutos_ate_atender)}</td>
                      <td className="n num mudo">{duracao(l.p90_minutos)}</td>
                      <td className="n num">
                        {Number(l.com_telefone) > 0
                          ? <b>{pct(Number(l.viraram_matricula) / Number(l.com_telefone))}</b>
                          : <span className="mudo">sem base</span>}
                        <div className="ids">
                          {Number(l.com_telefone) > 0
                            ? `${num(l.viraram_matricula)} de ${num(l.com_telefone)} com telefone`
                            : "telefone não guardado"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="rodape">
            <b>Até atender</b> é a espera do cliente do meio: metade esperou menos que isso, metade
            esperou mais. <b>Pior 10%</b> é a espera dos 10% mais azarados. A conversão conta só quem
            tem telefone guardado, porque sem telefone não dá para cruzar com a planilha.
          </p>

          <h2><span className="idx" /> Quanto o cliente espera, por dia da semana</h2>
          <p className="nota">
            Só conversa que o cliente começou, e aqui a semana aparece inteira, sem os filtros de cima.
            <Ajuda titulo="Por que o fim de semana continua aqui">
              O comercial não é cobrado por atender sábado e domingo, então esses dias ficam fora das
              médias lá de cima, senão estragariam a conta. Mas tirá-los do painel esconderia que gente
              procurou a COC e ficou esperando até segunda. Quem quiser a média limpa usa os botões de
              cima; quem quiser saber o tamanho do fim de semana olha aqui.
            </Ajuda>
          </p>
          {!espera ? <p className="rotulo">Carregando</p> : porDia.length === 0 ? (
            <p className="mudo">Ninguém procurou a gente neste período.</p>
          ) : (
            <>
              <div className="rolar">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th className="n">Procuraram</th>
                      <th className="n">Atendidos em até 15 min</th>
                      <th className="n">Esperaram mais de 1 h</th>
                      <th className="n">Sem resposta nenhuma</th>
                      <th style={{ minWidth: 140 }}>Fatia que esperou demais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porDia.map(([d, a]) => {
                      const ruim = a.n ? a.mais1h / a.n : 0;
                      return (
                        <tr key={d} className={ruim > 0.5 ? "fora" : undefined}>
                          <td>
                            <b>{a.nome}</b>
                            {a.fds && <div className="ids">fim de semana</div>}
                          </td>
                          <td className="n">{num(a.n)}</td>
                          <td className="n">{num(a.ate15)}</td>
                          <td className="n">{num(a.mais1h)}</td>
                          <td className="n">{num(a.mudo)}</td>
                          <td>
                            <div className="mini"><i style={{ width: `${ruim * 100}%` }} /></div>
                            <div className="ids num">
                              {pct(ruim)}{ruim > 0.5 ? " · mais da metade" : ""}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {fds > 0 && (
                <p className="aviso-leve">
                  {num(fds)} {fds > 1 ? "pessoas procuraram" : "pessoa procurou"} a COC no fim de semana
                  no período, e {num(fdsRuim)} {fdsRuim > 1 ? "esperaram" : "esperou"} mais de uma hora.{" "}
                  <b>O que fazer:</b> ou alguém de plantão, ou uma resposta automática dizendo quando a
                  gente volta. Hoje a pessoa manda mensagem no sábado e fica no vácuo.
                </p>
              )}
              {mudos > 0 && (
                <p className="aviso-leve ruim">
                  {num(mudos)} conversa{mudos > 1 ? "s" : ""} que o cliente começou nunca recebeu
                  resposta nenhuma, em dia nenhum. Essas não entram na conta de tempo porque não existe
                  tempo para medir.
                </p>
              )}
            </>
          )}
          <p className="rodape">O horário é o de Brasília.</p>
        </>
      )}
    </>
  );
}
