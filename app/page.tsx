"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, dataCurta, dataHora } from "@/lib/formato";
import { hojeSP, somaDias } from "@/lib/periodo";

type Resumo = {
  id: string; nome: string; inicio: string; fim: string; meta_ativa: number;
  meta_alunos: number; meta_faturamento: number; alunos: number; faturamento: number; cancelados: number;
  alunos_hoje: number; faturamento_hoje: number; ticket_medio: number | null; ticket_alvo: number | null;
  desconto_medio: number | null; meta_alunos_hoje: number; fase_atual: string | null; preco_atual: number | null;
  fase_fim: string | null; dias_restantes: number; situacao: string; market_share: number | null;
  referencia_ano_anterior: { alunos: number; ticket: number; market_share: number } | null;
  ativa: boolean;
  projecao_alunos: number | null;
};

type Resumo7 = {
  alunos: number; faturamento: number; ticket_medio: number | null;
  leads: number; cancelados: number; dias: number;
  melhor_dia: string | null; melhor_dia_alunos: number | null;
};
type MetaLead = {
  indicador: string; rotulo: string; meta: number; realizado: number;
  atingido: number | null; esperado_hoje: number; situacao: string; identificadores: string[] | null;
  por_crm: number; por_formulario: number; tem_regra: boolean;
};

type Janela = { id: string; nome: string; dias?: number; semana?: boolean };
const JANELAS: Janela[] = [
  { id: "hoje", nome: "Hoje", dias: 1 },
  { id: "semana", nome: "Esta semana", semana: true },
  { id: "7", nome: "7 dias", dias: 7 },
  { id: "14", nome: "14 dias", dias: 14 },
  { id: "30", nome: "30 dias", dias: 30 },
  { id: "60", nome: "60 dias", dias: 60 },
];
function intervalo(j: Janela) {
  const ate = hojeSP();
  if (j.semana) {
    // semana começa na segunda-feira
    const d = new Date(ate + "T12:00:00Z");
    const desvio = (d.getUTCDay() + 6) % 7;
    return { de: somaDias(ate, -desvio), ate };
  }
  return { de: somaDias(ate, -(j.dias! - 1)), ate };
}

type Faixa = "andamento" | "futuras" | "encerradas" | "todas";
const FAIXAS: { id: Faixa; nome: string }[] = [
  { id: "andamento", nome: "Em andamento" },
  { id: "futuras", nome: "Futuras" },
  { id: "encerradas", nome: "Encerradas" },
  { id: "todas", nome: "Todas" },
];
const naFaixa = (c: Resumo, f: Faixa) =>
  f === "todas" ? true
  : f === "futuras" ? c.situacao === "nao_iniciada"
  : f === "encerradas" ? c.situacao === "encerrada"
  : c.situacao !== "nao_iniciada" && c.situacao !== "encerrada";

const SITUACAO: Record<string, string> = {
  no_ritmo: "No ritmo", atencao: "Atenção", atras: "Atrás", nao_iniciada: "Não iniciada", encerrada: "Encerrada",
};

type Projecao = { projecao_alunos: number | null; meta_alunos: number; ref_ano: number };
type Ritmo = {
  campanha_id: string; nome: string; alunos: number; esperado_hoje: number; hoje: number; ontem: number;
  media_7: number; media_28: number; media_campanha: number | null;
  necessario_dia: number | null; falta: number; dias_restantes: number;
  dias_uteis_restantes: number; anteriores: number;
  cobertura: number | null; projecao_restante: number;
};

function Visao() {
  const { volta, em, minutos } = useAtualizacao();
  const [dados, setDados] = useState<Resumo[] | null>(null);
  const [sync, setSync] = useState<string | null>(null);
  const [proj, setProj] = useState<Record<string, Projecao>>({});
  const [ritmo, setRitmo] = useState<Ritmo[] | null>(null);
  const [faixa, setFaixa] = useState<Faixa>("andamento");
  const [janela, setJanela] = useState<Janela>(JANELAS[0]);
  const [periodo, setPeriodo] = useState<Resumo7 | null>(null);
  const [metasLeads, setMetasLeads] = useState<Record<string, MetaLead[]>>({});
  const [metasProntas, setMetasProntas] = useState(false);

  useEffect(() => {
    supabase.from("resumo_campanhas").select("*").order("inicio").then(({ data }) => {
      const lista = (data as Resumo[]) ?? [];
      let respondidas = 0;
      setDados(lista);
      lista.forEach((c) => {
        supabase.rpc("painel_projecao", { p_campanha: c.id }).then(({ data: pr }) => {
          const linha = ((pr as Projecao[]) ?? [])[0];
          if (linha) setProj((atual) => ({ ...atual, [c.id]: linha }));
        });
        supabase.rpc("painel_metas_leads", { p_campanha: c.id }).then(({ data: ml }) => {
          const linhas = (ml as MetaLead[]) ?? [];
          if (linhas.length) setMetasLeads((atual) => ({ ...atual, [c.id]: linhas }));
          respondidas += 1;
          if (respondidas >= lista.length) setMetasProntas(true);
        });
      });
      if (lista.length === 0) setMetasProntas(true);
    });
    supabase.rpc("painel_ritmo").then(({ data }) => setRitmo((data as Ritmo[]) ?? []));
    supabase.from("sincronizacoes").select("terminado_em").eq("status", "ok").like("fonte", "planilha:%")
      .order("terminado_em", { ascending: false }).limit(1).then(({ data }) => setSync(data?.[0]?.terminado_em ?? null));
  }, [volta]);

  useEffect(() => {
    const { de, ate } = intervalo(janela);
    setPeriodo(null);
    supabase.rpc("painel_resumo_periodo", { p_de: de, p_ate: ate })
      .then(({ data }) => setPeriodo(((data as Resumo7[]) ?? [])[0] ?? null));
  }, [janela, volta]);

  if (!dados) return <p className="rotulo">Carregando</p>;

  return (
    <>
      <div className="rotulo">001 · Visão geral</div>
      <h1>Como estamos</h1>

      <div className="filtros" style={{ marginBottom: 8 }}>
        <div className="atalhos">
          {JANELAS.map((j) => (
            <button key={j.id} className={janela.id === j.id ? "ativo" : ""} onClick={() => setJanela(j)}>{j.nome}</button>
          ))}
        </div>
        <span className="mudo num" style={{ marginLeft: "auto" }}>
          {(() => { const { de, ate } = intervalo(janela); return de === ate ? dataCurta(ate) : `${dataCurta(de)} a ${dataCurta(ate)}`; })()}
          {" · sincronizado "}{dataHora(sync)}
          {" · tela de "}{horaCurta(em)}
        </span>
      </div>

      <div className="faixa">
        <div>
          <div className="rotulo">Matrículas</div>
          <div className="valor num">{periodo ? num(periodo.alunos) : "..."}</div>
          {periodo && periodo.dias > 1 && <div className="mudo num">{num((periodo.alunos / periodo.dias).toFixed(1))} por dia</div>}
        </div>
        <div>
          <div className="rotulo">Faturamento</div>
          <div className="valor num">{periodo ? brl(periodo.faturamento) : "..."}</div>
          <div className="mudo num">{periodo?.ticket_medio ? "ticket " + brl(periodo.ticket_medio) : ""}</div>
        </div>
        <div>
          <div className="rotulo">Leads</div>
          <div className="valor num">{periodo ? num(periodo.leads) : "..."}</div>
          {periodo && periodo.alunos > 0 && periodo.leads > 0 && (
            <div className="mudo num">{num(Math.round(periodo.leads / periodo.alunos))} leads por matrícula</div>
          )}
        </div>
        <div>
          <div className="rotulo">Melhor dia</div>
          <div className="valor num">{periodo?.melhor_dia ? num(periodo.melhor_dia_alunos) : "-"}</div>
          <div className="mudo num">{periodo?.melhor_dia ? dataCurta(periodo.melhor_dia) : ""}</div>
        </div>
        <div>
          <div className="rotulo">Cancelamentos</div>
          <div className="valor num">{periodo ? num(periodo.cancelados) : "..."}</div>
          <div className="mudo">fora da conta</div>
        </div>
      </div>

      <h2><span className="idx">002</span> Campanhas</h2>
      <div className="filtros" style={{ marginBottom: 16 }}>
        <div className="atalhos">
          {FAIXAS.map((f) => {
            const quantas = dados.filter((c) => naFaixa(c, f.id)).length;
            return (
              <button key={f.id} className={faixa === f.id ? "ativo" : ""} onClick={() => setFaixa(f.id)} disabled={quantas === 0}>
                {f.nome} ({quantas})
              </button>
            );
          })}
        </div>
      </div>
      <div className="cards">
        {dados.filter((c) => naFaixa(c, faixa)).map((c) => {
          const ating = c.meta_alunos ? c.alunos / c.meta_alunos : 0;
          const esperado = c.meta_alunos ? c.meta_alunos_hoje / c.meta_alunos : 0;
          return (
            <article className="card" key={c.id}>
              <div className="card-top">
                <div>
                  <div className="rotulo">{dataCurta(c.inicio)} a {dataCurta(c.fim)} · Meta {c.meta_ativa}</div>
                  <h3>{c.nome}</h3>
                </div>
                <span className={"selo " + c.situacao}>{SITUACAO[c.situacao] ?? c.situacao}</span>
              </div>

              <div className="grande num">{num(c.alunos)} <small>/ {num(c.meta_alunos)} alunos</small></div>
              <div className="barra" aria-label="Progresso da meta">
                <i style={{ width: `${Math.min(ating, 1) * 100}%` }} />
                <b style={{ left: `${Math.min(esperado, 1) * 100}%` }} title="Meta esperada para hoje" />
              </div>
              <div className="legenda num"><span>{pct(ating)} da meta</span><span>esperado hoje: {num(c.meta_alunos_hoje)}</span></div>

              <div className="grade">
                <div><div className="rotulo">Faturamento</div><div className="v num">{brl(c.faturamento)}</div><div className="mudo num">de {brl(c.meta_faturamento)}</div></div>
                <div><div className="rotulo">Ticket médio</div><div className="v num">{brl(c.ticket_medio)}</div><div className="mudo num">alvo {brl(c.ticket_alvo)}</div></div>
                <div><div className="rotulo">Fase atual</div><div className="v">{c.fase_atual ?? "-"}</div><div className="mudo num">{c.preco_atual ? brl(c.preco_atual, 2) + " até " + dataCurta(c.fase_fim) : ""}</div></div>
                <div><div className="rotulo">Dias restantes</div><div className="v num">{num(c.dias_restantes)}</div><div className="mudo num">share {pct(c.market_share, 2)}</div></div>
                <div>
                  <div className="rotulo">Falta por dia útil</div>
                  {(() => {
                    const r = ritmo?.find((x) => x.campanha_id === c.id);
                    if (!r) return <div className="v num">-</div>;
                    const prec = r.necessario_dia == null ? null : Number(r.necessario_dia);
                    const media = Number(r.media_7);
                    if (prec == null || Number(r.falta) <= 0)
                      return <><div className="v">meta batida</div><div className="mudo">nada a fazer</div></>;
                    return (
                      <>
                        <div className="v num">{num(prec.toFixed(1))}</div>
                        <div className={"mudo num " + (media >= prec ? "ok" : "alerta")}>
                          ritmo {num(media.toFixed(1))} · faltam {num(r.falta)} em {num(r.dias_uteis_restantes ?? r.dias_restantes)} dias úteis
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div>
                  <div className="rotulo">Projeção de fechamento</div>
                  <div className="v num">{proj[c.id]?.projecao_alunos != null ? num(proj[c.id].projecao_alunos) + " alunos" : "-"}</div>
                  <div className="mudo num">
                    {proj[c.id]?.projecao_alunos != null
                      ? (Number(proj[c.id].projecao_alunos) >= c.meta_alunos ? "bate a Meta " + c.meta_ativa : "abaixo da Meta " + c.meta_ativa)
                      : "pela curva do ano anterior"}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {dados.filter((c) => naFaixa(c, faixa)).length === 0 && (
        <p className="mudo">Nenhuma campanha nesta situação.</p>
      )}
      <p className="mudo" style={{ marginTop: 24 }}>Barra preta: realizado. Traço vermelho: onde a meta ativa espera que a campanha esteja hoje.</p>


      <h2><span className="idx">003</span> Metas de captação</h2>
      {!metasProntas ? (
        <p className="rotulo">Carregando</p>
      ) : Object.keys(metasLeads).length === 0 ? (
        <p className="mudo">Nenhuma meta de captação cadastrada.</p>
      ) : (
        <>
          <div className="cards">
            {dados.filter((c) => metasLeads[c.id]?.length).map((c) => (
              <article className="card" key={c.id}>
                <div className="card-top">
                  <div>
                    <div className="rotulo">Marketing</div>
                    <h3>{c.nome}</h3>
                  </div>
                </div>
                {metasLeads[c.id].map((m) => {
                  const ating = m.atingido == null ? 0 : Number(m.atingido);
                  const esperado = m.meta > 0 ? Number(m.esperado_hoje) / m.meta : 0;
                  return (
                    <div key={m.indicador} style={{ marginTop: 16 }}>
                      <div className="legenda">
                        <span><b>{m.rotulo}</b></span>
                        <span className={"selo " + m.situacao} style={{ fontSize: 10 }}>{SITUACAO[m.situacao] ?? m.situacao}</span>
                      </div>
                      <div className="barra">
                        <i style={{ width: `${Math.min(ating, 1) * 100}%` }} />
                        <b style={{ left: `${Math.min(esperado, 1) * 100}%` }} title="Esperado para hoje" />
                      </div>
                      <div className="legenda num">
                        <span>{num(m.realizado)} de {num(m.meta)} · {pct(ating)}</span>
                        <span>esperado hoje: {num(m.esperado_hoje)}</span>
                      </div>
                      {m.tem_regra && Number(m.por_crm) > 0 && Number(m.por_formulario) > 0 ? (
                        <div className="rotulo" style={{ marginTop: 4 }}>
                          {num(m.por_crm)} pelo CRM, por pessoa · {num(m.por_formulario)} conversões no formulário ·
                          vale o do CRM, porque os dois caminhos se cruzam
                        </div>
                      ) : null}
                      {m.identificadores?.length ? (
                        <div className="rotulo" style={{ marginTop: 4, wordBreak: "break-word", lineHeight: 1.5 }}>
                          {m.identificadores.join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
          <p className="mudo" style={{ marginTop: 16 }}>
            Abaixo de cada barra estão as páginas que entraram na conta, para o número poder ser conferido.
            Só entra conversão cujo nome da página casa com o curso da campanha: antes disso as duas campanhas mostravam o mesmo número.
            Leads captados conta todas as conversões do período da campanha. Inscritos nas lives e reservas contam as
            conversões das páginas com esse nome. O traço vermelho é onde a meta espera que o número esteja hoje.
          </p>
        </>
      )}

      <h2><span className="idx">004</span> Ritmo diário de matrículas</h2>
      {!ritmo ? <p className="rotulo">Carregando</p> : ritmo.length === 0 ? (
        <p className="mudo">Nenhuma campanha ativa.</p>
      ) : (
        <>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th className="n">Realizado</th>
                  <th className="n">Esperado hoje</th>
                  <th className="n">Hoje</th>
                  <th className="n">Ontem</th>
                  <th className="n">Anteriores</th>
                  <th className="n">Média 7 dias úteis</th>
                  <th className="n">Precisa por dia útil</th>
                  <th style={{ minWidth: 110 }}>Cobertura</th>
                  <th className="n">Faltam</th>
                  <th className="n">Dias úteis</th>
                  <th>No ritmo das últimas semanas</th>
                </tr>
              </thead>
              <tbody>
                {ritmo.map((r) => {
                  const cob = r.cobertura == null ? null : Number(r.cobertura);
                  const entrega = Number(r.projecao_restante);
                  const cobre = entrega >= r.falta;
                  return (
                    <tr key={r.campanha_id}>
                      <td><b>{r.nome}</b></td>
                      <td className="n"><b>{num(r.alunos)}</b></td>
                      <td className="n">
                        {num(r.esperado_hoje)}
                        <div className="rotulo">{Number(r.alunos) - Number(r.esperado_hoje) >= 0 ? "+" : ""}{num(Number(r.alunos) - Number(r.esperado_hoje))}</div>
                      </td>
                      <td className="n">{num(r.hoje)}</td>
                      <td className="n">{num(r.ontem)}</td>
                      <td className="n">{Number(r.anteriores ?? 0) > 0 ? num(r.anteriores) : "-"}</td>
                      <td className="n"><b>{num(r.media_7)}</b><div className="rotulo">28d: {num(r.media_28)}</div></td>
                      <td className="n">{r.necessario_dia == null ? "-" : num(r.necessario_dia)}</td>
                      <td>
                        <div className="mini"><i style={{ width: `${Math.min(cob ?? 0, 1.5) / 1.5 * 100}%` }} /></div>
                        <div className="rotulo num">{cob == null ? "-" : num(cob) + "x o necessário"}</div>
                      </td>
                      <td className="n"><b>{num(r.falta)}</b></td>
                      <td className="n">{num(r.dias_uteis_restantes ?? r.dias_restantes)}<div className="rotulo">{num(r.dias_restantes)} corridos</div></td>
                      <td>
                        <span className={"selo " + (cobre ? "no_ritmo" : "atras")}>
                          {cobre ? "entrega a meta" : "falta " + num(r.falta - entrega)}
                        </span>
                        <div className="rotulo num">entregaria {num(entrega)} alunos</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="n">{num(ritmo.reduce((s, r) => s + Number(r.alunos), 0))}</td>
                  <td className="n">{num(ritmo.reduce((s, r) => s + Number(r.esperado_hoje), 0))}</td>
                  <td className="n">{num(ritmo.reduce((s, r) => s + Number(r.hoje), 0))}</td>
                  <td className="n">{num(ritmo.reduce((s, r) => s + Number(r.ontem), 0))}</td>
                  <td className="n">{num(ritmo.reduce((s, r) => s + Number(r.anteriores ?? 0), 0))}</td>
                  <td className="n">{num(ritmo.reduce((s, r) => s + Number(r.media_7), 0).toFixed(2))}</td>
                  <td className="n">{num(ritmo.reduce((s, r) => s + Number(r.necessario_dia ?? 0), 0).toFixed(2))}</td>
                  <td />
                  <td className="n">{num(ritmo.reduce((s, r) => s + Number(r.falta), 0))}</td>
                  <td />
                  <td className="n">{num(ritmo.reduce((s, r) => s + Number(r.projecao_restante), 0))} alunos</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mudo" style={{ marginTop: 10 }}>
            Média e ritmo contam só dia útil: sábado e domingo somam pouco mais de três por cento das matrículas e, contados, diluem o que a operação precisa bater por dia. Anteriores são as matrículas lançadas antes do início da campanha, que entram no realizado. O período de venda termina uma semana depois do início das aulas, e é essa data que conta como fim da campanha aqui.
          </p>
          <p className="mudo">
            São três leituras diferentes e elas podem discordar. <b>Esperado hoje</b> vem da escada de fases, então uma campanha que concentra venda no fim aparece adiantada no começo.
            <b> No ritmo das últimas semanas</b> repete a média de 7 dias até o fim, sem considerar sazonalidade. A <b>projeção</b> no card da campanha pesa a curva do ano anterior e costuma ser a mais próxima do resultado final.
          </p>
        </>
      )}
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Visao />}</Shell>;
}
