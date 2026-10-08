"use client";
import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import Curva from "@/components/Curva";
import { supabase } from "@/lib/supabase";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, dataCurta } from "@/lib/formato";
import { hojeSP } from "@/lib/periodo";

type Resumo = {
  id: string; nome: string; inicio: string; fim: string; meta_ativa: number;
  meta_alunos: number; meta_faturamento: number; alunos: number; faturamento: number;
  cancelados: number; ticket_medio: number | null; ticket_alvo: number | null;
  desconto_medio: number | null; meta_alunos_hoje: number; fase_atual: string | null;
  preco_atual: number | null; fase_fim: string | null; dias_restantes: number;
  situacao: string; market_share: number | null; mercado_candidatos: number | null;
  marcos: { nome: string; data: string; fim?: string }[] | null;
  referencia_ano_anterior: { ano: number; alunos: number; ticket: number; faturamento: number; market_share: number; desconto_medio: number } | null;
};
type Fase = {
  ordem: number; nome: string; inicio: string; fim: string; preco: number; bonus: string | null;
  meta_alunos: number; alunos: number; faturamento: number; ticket_medio: number | null; estado: string;
};
type Ponto = { dia: string; d: number; realizado: number | null; meta: number; anterior: number };
type Projecao = {
  ref_ano: number; ref_alunos: number; ref_ate_hoje: number; fracao: number;
  dia_da_campanha: number; projecao_alunos: number | null; projecao_faturamento: number | null;
  meta_alunos: number; falta_alunos: number; dias_restantes: number;
  ritmo_necessario: number | null; ritmo_atual: number | null;
};
type Funil = {
  matriculas: number; cruzadas: number; cobertura: number | null;
  por_email: number; por_telefone: number; por_nome: number;
  dias_medio: number | null; dias_mediana: number | null; dias_max: number | null;
};
type Origem = {
  origem: string; negocios: number; matriculas: number; matriculas_unicas: number; conversao: number | null;
  faturamento: number; ticket_medio: number | null; dias_medio: number | null;
};
type Recompra = {
  indicador: string; rotulo: string; pessoas: number; base: number;
  taxa: number | null; faturamento: number | null;
};
type UpsellOrigem = {
  curso_origem: string; produto_origem: string | null; pessoas: number;
  faturamento: number; dias_medio: number | null;
};
type Cenario = {
  nivel: number; ativa: boolean; alunos: number; faturamento: number;
  atingido: number | null; falta: number; ritmo_dia: number | null;
};

const SITUACAO: Record<string, string> = {
  no_ritmo: "No ritmo", atencao: "Atenção", atras: "Atrás",
  nao_iniciada: "Não iniciada", encerrada: "Encerrada",
};
const ESTADO: Record<string, string> = { atual: "Em curso", encerrada: "Encerrada", futura: "A seguir" };

function Tela() {
  const { volta, em, minutos } = useAtualizacao();
  const [campanhas, setCampanhas] = useState<Resumo[] | null>(null);
  const [id, setId] = useState<string>("");
  const [fases, setFases] = useState<Fase[] | null>(null);
  const [pontos, setPontos] = useState<Ponto[] | null>(null);
  const [proj, setProj] = useState<Projecao | null>(null);
  const [cenarios, setCenarios] = useState<Cenario[] | null>(null);
  const [funil, setFunil] = useState<Funil | null>(null);
  const [origens, setOrigens] = useState<Origem[] | null>(null);
  const [porOrigem, setPorOrigem] = useState<"campanha" | "fonte">("campanha");
  const [recompra, setRecompra] = useState<Recompra[] | null>(null);
  const [origemUpsell, setOrigemUpsell] = useState<UpsellOrigem[] | null>(null);

  useEffect(() => {
    supabase.from("resumo_campanhas").select("*").order("inicio").then(({ data }) => {
      const lista = (data as Resumo[]) ?? [];
      setCampanhas(lista);
      if (lista.length) setId(lista[0].id);
    });
  }, [volta]);

  useEffect(() => {
    if (!id) return;
    setFases(null); setPontos(null); setProj(null); setCenarios(null); setFunil(null); setOrigens(null); setRecompra(null); setOrigemUpsell(null);
    const p = { p_campanha: id };
    supabase.rpc("painel_fases", p).then(({ data }) => setFases((data as Fase[]) ?? []));
    supabase.rpc("painel_curva", p).then(({ data }) => setPontos((data as Ponto[]) ?? []));
    supabase.rpc("painel_projecao", p).then(({ data }) => setProj(((data as Projecao[]) ?? [])[0] ?? null));
    supabase.rpc("painel_cenarios", p).then(({ data }) => setCenarios((data as Cenario[]) ?? []));
    supabase.rpc("painel_funil", p).then(({ data }) => setFunil(((data as Funil[]) ?? [])[0] ?? null));
    supabase.rpc("painel_recompra", p).then(({ data }) => setRecompra((data as Recompra[]) ?? []));
    supabase.rpc("painel_upsell_origem", p).then(({ data }) => setOrigemUpsell((data as UpsellOrigem[]) ?? []));
  }, [id, volta]);

  useEffect(() => {
    if (!id) return;
    setOrigens(null);
    supabase.rpc("painel_origem_matriculas", { p_campanha: id, p_por: porOrigem })
      .then(({ data }) => setOrigens((data as Origem[]) ?? []));
  }, [id, porOrigem, volta]);

  const c = campanhas?.find((x) => x.id === id);

  const curva = useMemo(() => {
    if (!pontos || pontos.length === 0) return null;
    return {
      rotulos: pontos.map((x) => dataCurta(x.dia)),
      real: pontos.map((x) => (x.realizado == null ? null : Number(x.realizado))),
      meta: pontos.map((x) => Number(x.meta)),
      anterior: pontos.map((x) => Number(x.anterior)),
    };
  }, [pontos, volta]);

  if (!campanhas) return <p className="rotulo">Carregando</p>;
  if (!c) return <p className="mudo">Nenhuma campanha ativa cadastrada.</p>;

  const ating = c.meta_alunos ? c.alunos / c.meta_alunos : 0;
  const ref = c.referencia_ano_anterior;
  const hoje = hojeSP();

  return (
    <>
      <div className="rotulo">001 · Campanha</div>
      <h1>{c.nome}</h1>
      <p className="mudo num" style={{ marginTop: -8, marginBottom: 16 }}>
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <div className="filtros">
        <label>
          <span className="rotulo">Campanha</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {campanhas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <span className={"selo " + c.situacao}>{SITUACAO[c.situacao] ?? c.situacao}</span>
          <span className="mudo num">Vendas de {dataCurta(c.inicio)} a {dataCurta(c.fim)} · faltam {num(c.dias_restantes)} dias</span>
        </div>
      </div>

      <div className="faixa">
        <div>
          <div className="rotulo">Alunos</div>
          <div className="valor num">{num(c.alunos)}</div>
          <div className="mudo num">meta {num(c.meta_alunos)} · {pct(ating)}</div>
        </div>
        <div>
          <div className="rotulo">Esperado hoje</div>
          <div className="valor num">{num(c.meta_alunos_hoje)}</div>
          <div className="mudo num">
            {c.alunos - Number(c.meta_alunos_hoje) >= 0 ? "+" : ""}{num(c.alunos - Number(c.meta_alunos_hoje))} contra o ritmo
          </div>
        </div>
        <div>
          <div className="rotulo">Faturamento</div>
          <div className="valor num">{brl(c.faturamento)}</div>
          <div className="mudo num">meta {brl(c.meta_faturamento)}</div>
        </div>
        <div>
          <div className="rotulo">Ticket médio</div>
          <div className="valor num">{brl(c.ticket_medio)}</div>
          <div className="mudo num">alvo {brl(c.ticket_alvo)}</div>
        </div>
        <div>
          <div className="rotulo">Desconto médio</div>
          <div className="valor num">{pct(c.desconto_medio)}</div>
          <div className="mudo num">{ref ? `${ref.ano}: ${pct(ref.desconto_medio)}` : ""}</div>
        </div>
        <div>
          <div className="rotulo">Cancelados</div>
          <div className="valor num">{num(c.cancelados)}</div>
          <div className="mudo">fora da conta</div>
        </div>
      </div>


      <h2><span className="idx">002</span> Projeção de fechamento</h2>
      {!proj ? <p className="rotulo">Carregando</p> : proj.projecao_alunos == null ? (
        <p className="mudo">Sem histórico do ano anterior para projetar esta campanha.</p>
      ) : (
        <>
          <div className="cards">
            <article className="card">
              <div className="card-top">
                <div>
                  <div className="rotulo">Onde a campanha deve terminar</div>
                  <h3>Projeção</h3>
                </div>
                <span className={"selo " + (Number(proj.projecao_alunos) >= proj.meta_alunos ? "no_ritmo" : Number(proj.projecao_alunos) >= proj.meta_alunos * 0.9 ? "atencao" : "atras")}>
                  {Number(proj.projecao_alunos) >= proj.meta_alunos ? "Bate a Meta " + c.meta_ativa : "Abaixo da Meta " + c.meta_ativa}
                </span>
              </div>
              <div className="grande num">{num(proj.projecao_alunos)} <small>alunos no fim</small></div>
              <div className="legenda num">
                <span>{brl(proj.projecao_faturamento)} de faturamento</span>
                <span>
                  {Number(proj.projecao_alunos) - proj.meta_alunos >= 0 ? "+" : ""}
                  {num(Number(proj.projecao_alunos) - proj.meta_alunos)} contra a meta
                </span>
              </div>
              <div className="grade" style={{ gridTemplateColumns: "1fr" }}>
                <div>
                  <div className="rotulo">Como chegamos nesse número</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6 }}>
                    Hoje é o dia <b>{num(proj.dia_da_campanha)}</b> desta campanha e já temos <b>{num(c.alunos)}</b> alunos.
                    No dia {num(proj.dia_da_campanha)} de {proj.ref_ano}, <b>{num(proj.ref_ate_hoje)}</b> dos <b>{num(proj.ref_alunos)}</b> alunos
                    daquele ano já tinham comprado, ou seja <b>{pct(Number(proj.fracao))}</b> do total.
                    Se a venda se distribuir do mesmo jeito, os {num(c.alunos)} de hoje são {pct(Number(proj.fracao))} do resultado final,
                    o que dá <b>{num(proj.projecao_alunos)}</b> alunos.
                  </div>
                </div>
              </div>
            </article>

            <article className="card">
              <div className="card-top">
                <div>
                  <div className="rotulo">Quanto precisa entrar por dia</div>
                  <h3>Ritmo</h3>
                </div>
              </div>
              <div className="grande num">{num(proj.ritmo_necessario)} <small>alunos por dia</small></div>
              <div className="legenda num">
                <span>hoje está em {num(proj.ritmo_atual)} por dia</span>
                <span>{num(proj.dias_restantes)} dias de venda</span>
              </div>
              <div className="grade">
                <div>
                  <div className="rotulo">Falta para a meta</div>
                  <div className="v num">{num(proj.falta_alunos)} alunos</div>
                </div>
                <div>
                  <div className="rotulo">Atenção</div>
                  <div className="v" style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.45 }}>
                    {Number(proj.fracao) >= 0.5
                      ? "O ritmo por dia parece confortável, mas " + pct(Number(proj.fracao)) + " da curva já passou. O que sobra de campanha rende bem menos do que a média sugere."
                      : "A campanha ainda está no começo da curva, então a projeção vai se firmar nas próximas semanas."}
                  </div>
                </div>
              </div>
            </article>
          </div>
          {Number(proj.fracao) < 0.35 && (
            <p className="aviso">
              Projeção ainda instável: só {pct(Number(proj.fracao))} da curva de {proj.ref_ano} passou. Use como direção, não como número fechado.
            </p>
          )}
        </>
      )}

      <h2><span className="idx">003</span> Ritmo da campanha</h2>
      {curva ? (
        <Curva
          rotulos={curva.rotulos}
          series={[
            { nome: "Alunos acumulados", cor: "#0A0A0A", pontos: curva.real },
            { nome: `Ritmo da Meta ${c.meta_ativa}`, cor: "#C0341D", tracejada: true, pontos: curva.meta },
            { nome: `Mesmo dia em ${proj?.ref_ano ?? "ano anterior"}`, cor: "#6B6A66", tracejada: true, pontos: curva.anterior },
          ]}
        />
      ) : <p className="rotulo">Carregando</p>}

      <h2><span className="idx">004</span> Escada de preço por fase</h2>
      {!fases ? <p className="rotulo">Carregando</p> : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Fase</th><th>Período</th><th className="n">Preço</th>
                <th className="n">Meta</th><th className="n">Alunos</th><th className="n">Atingido</th>
                <th className="n">Faturamento</th><th className="n">Ticket</th><th>Bônus</th>
              </tr>
            </thead>
            <tbody>
              {fases.map((f) => (
                <tr key={f.ordem} className={f.estado === "atual" ? "destaque" : undefined}>
                  <td>
                    <b>{f.nome}</b>
                    <div className="rotulo">{ESTADO[f.estado] ?? f.estado}</div>
                  </td>
                  <td className="num">{dataCurta(f.inicio)} a {dataCurta(f.fim)}</td>
                  <td className="n">{brl(f.preco, 2)}</td>
                  <td className="n">{num(f.meta_alunos)}</td>
                  <td className="n">{num(f.alunos)}</td>
                  <td className="n">{f.meta_alunos ? pct(f.alunos / f.meta_alunos) : "-"}</td>
                  <td className="n">{brl(f.faturamento)}</td>
                  <td className="n">{brl(f.ticket_medio)}</td>
                  <td className="mudo">{f.bonus ?? "-"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td className="n">{num(fases.reduce((s, f) => s + f.meta_alunos, 0))}</td>
                <td className="n">{num(fases.reduce((s, f) => s + Number(f.alunos), 0))}</td>
                <td className="n" />
                <td className="n">{brl(fases.reduce((s, f) => s + Number(f.faturamento), 0))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}


      <h2><span className="idx">005</span> Cenários das metas</h2>
      {!cenarios ? <p className="rotulo">Carregando</p> : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Meta</th><th className="n">Alunos</th><th className="n">Faturamento</th>
                <th className="n">Atingido</th><th style={{ minWidth: 120 }} />
                <th className="n">Falta</th><th className="n">Por dia</th><th>Projeção alcança</th>
              </tr>
            </thead>
            <tbody>
              {cenarios.map((x) => {
                const alcanca = proj?.projecao_alunos != null ? Number(proj.projecao_alunos) >= x.alunos : null;
                return (
                  <tr key={x.nivel} className={x.ativa ? "destaque" : undefined}>
                    <td>
                      <b>Meta {x.nivel}</b>
                      {x.ativa && <div className="rotulo">Ativa</div>}
                    </td>
                    <td className="n">{num(x.alunos)}</td>
                    <td className="n">{brl(x.faturamento)}</td>
                    <td className="n">{pct(x.atingido == null ? null : Number(x.atingido))}</td>
                    <td><div className="mini"><i style={{ width: `${Math.min(Number(x.atingido ?? 0), 1) * 100}%` }} /></div></td>
                    <td className="n">{num(x.falta)}</td>
                    <td className="n">{x.ritmo_dia == null ? "-" : num(x.ritmo_dia)}</td>
                    <td>{alcanca == null ? "-" : alcanca ? <span className="selo no_ritmo">Sim</span> : <span className="selo atras">Não</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}


      <h2><span className="idx">006</span> Da origem à matrícula</h2>
      <div className="filtros" style={{ marginBottom: 16 }}>
        <div className="atalhos">
          <button className={porOrigem === "campanha" ? "ativo" : ""} onClick={() => setPorOrigem("campanha")}>
            Por campanha do CRM
          </button>
          <button className={porOrigem === "fonte" ? "ativo" : ""} onClick={() => setPorOrigem("fonte")}>
            Por fonte
          </button>
        </div>
      </div>
      {!funil ? <p className="rotulo">Carregando</p> : (
        <>
          <div className="faixa">
            <div>
              <div className="rotulo">Matrículas ligadas ao CRM</div>
              <div className="valor num">{num(funil.cruzadas)}</div>
              <div className="mudo num">{pct(funil.cobertura == null ? null : Number(funil.cobertura))} de {num(funil.matriculas)}</div>
            </div>
            <div>
              <div className="rotulo">Tempo até a matrícula</div>
              <div className="valor num">{num(funil.dias_mediana)} dias</div>
              <div className="mudo num">mediana · média {num(funil.dias_medio)}</div>
            </div>
            <div>
              <div className="rotulo">Lead mais antigo convertido</div>
              <div className="valor num">{num(funil.dias_max)} dias</div>
            </div>
            <div>
              <div className="rotulo">Como foram ligadas</div>
              <div className="valor num" style={{ fontSize: 20 }}>
                {num(funil.por_email)} e-mail · {num(funil.por_telefone)} telefone
              </div>
              <div className="mudo num">{num(funil.por_nome)} por nome, para conferir</div>
            </div>
          </div>

          {!origens ? <p className="rotulo">Carregando</p> : origens.length === 0 ? (
            <p className="mudo">Sem negócios no período da campanha.</p>
          ) : (
            <div className="rolar" style={{ marginTop: 16 }}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>{porOrigem === "campanha" ? "Campanha no CRM" : "Fonte"}</th><th className="n">Negócios</th><th className="n">Matrículas</th><th className="n">Só desta peça</th>
                    <th className="n">Conversão</th><th style={{ minWidth: 110 }} />
                    <th className="n">Faturamento</th><th className="n">Ticket</th><th className="n">Dias até fechar</th>
                  </tr>
                </thead>
                <tbody>
                  {origens.map((o) => (
                    <tr key={o.origem}>
                      <td style={{ maxWidth: 320, wordBreak: "break-word" }}>{o.origem}</td>
                      <td className="n">{num(o.negocios)}</td>
                      <td className="n"><b>{num(o.matriculas)}</b></td>
                      <td className="n">{num(o.matriculas_unicas)}</td>
                      <td className="n">{pct(o.conversao == null ? null : Number(o.conversao))}</td>
                      <td><div className="mini"><i style={{ width: `${Math.min(Number(o.conversao ?? 0) / 0.2, 1) * 100}%` }} /></div></td>
                      <td className="n">{brl(o.faturamento)}</td>
                      <td className="n">{brl(o.ticket_medio)}</td>
                      <td className="n">{o.dias_medio == null ? "-" : num(o.dias_medio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mudo" style={{ marginTop: 10 }}>
            Cada matrícula da planilha é ligada à negociação do CRM que deu origem a ela, cruzando por e-mail, telefone e, em último caso, nome. A barra de conversão usa 20% como referência de topo.
            A leitura por campanha mostra qual peça trouxe o lead, que é o que permite decidir onde investir. A fonte diz só o canal, e fica como segunda visão.
            A matrícula só conta para a peça quando aconteceu depois da conversão nela e dentro de sessenta dias, senão a peça levaria crédito por venda que veio antes dela.
            <b> Só desta peça</b> são as matrículas de quem converteu nela e em mais nenhuma outra no período, ou seja o que ela fecha sozinha.
          </p>
        </>
      )}

      <h2><span className="idx">007</span> Quem já era da casa</h2>
      {!recompra ? <p className="rotulo">Carregando</p> : recompra.length === 0 ? (
        <p className="mudo">Sem matrícula nesta campanha ainda.</p>
      ) : (
        <>
          <div className="faixa">
            {recompra.map((r) => (
              <div key={r.indicador}>
                <div className="rotulo">{r.rotulo}</div>
                <div className="valor num">{num(r.pessoas)}</div>
                <div className="mudo num">
                  {r.taxa == null ? "" : pct(Number(r.taxa), 1) + " das matrículas"}
                  {r.indicador === "rematricula" && r.base ? ` · base de ${num(r.base)}` : ""}
                </div>
              </div>
            ))}
          </div>
          <p className="mudo" style={{ marginTop: 10 }}>
            Rematrícula é quem fez o mesmo curso na edição anterior e voltou. As outras linhas olham se a pessoa também
            tem curso longo ou o outro intensivo. A mesma pessoa é reconhecida por e-mail, telefone ou nome.
            As faixas se sobrepõem de propósito: alguém pode ser rematrícula e ter curso longo ao mesmo tempo.
          </p>
        </>
      )}

      {origemUpsell && origemUpsell.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, margin: "28px 0 8px" }}>De onde essas pessoas vieram</h3>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr><th>Curso anterior</th><th className="n">Pessoas</th><th style={{ minWidth: 120 }} />
                  <th className="n">Faturamento aqui</th><th className="n">Dias até voltar</th></tr>
              </thead>
              <tbody>
                {origemUpsell.map((o, i) => {
                  const maior = Math.max(1, ...origemUpsell.map((x) => Number(x.pessoas)));
                  return (
                    <tr key={o.curso_origem}>
                      <td style={{ maxWidth: 320, wordBreak: "break-word" }}>
                        {i < 3 ? <b>{o.curso_origem}</b> : o.curso_origem}
                      </td>
                      <td className="n"><b>{num(o.pessoas)}</b></td>
                      <td><div className="mini"><i style={{ width: `${(Number(o.pessoas) / maior) * 100}%` }} /></div></td>
                      <td className="n">{brl(o.faturamento)}</td>
                      <td className="n">{o.dias_medio == null ? "-" : num(o.dias_medio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mudo" style={{ marginTop: 10 }}>
            Os três primeiros são de onde mais vem gente. Dias até voltar é quanto tempo passou entre a compra
            anterior e esta, o que indica em que momento vale disparar a oferta para a turma daquele curso.
          </p>
        </>
      )}

      <h2><span className="idx">008</span> Marcos</h2>
      {c.marcos?.length ? (
        <div className="marcos">
          {c.marcos.map((m) => {
            const passou = (m.fim ?? m.data) < hoje;
            return (
              <div key={m.nome} className={passou ? "passou" : undefined}>
                <span className="quando">{dataCurta(m.data)}{m.fim ? ` a ${dataCurta(m.fim)}` : ""}</span>
                <span>{m.nome}</span>
                {!passou && (m.data <= hoje) && <span className="selo no_ritmo">Agora</span>}
              </div>
            );
          })}
        </div>
      ) : <p className="mudo">Nenhum marco cadastrado.</p>}

      {ref && (
        <>
          <h2><span className="idx">009</span> Contra {ref.ano}</h2>
          <div className="faixa">
            <div>
              <div className="rotulo">Alunos {ref.ano}</div>
              <div className="valor num">{num(ref.alunos)}</div>
              <div className="mudo num">hoje: {num(c.alunos)} · {pct(c.alunos / ref.alunos - 1)}</div>
            </div>
            <div>
              <div className="rotulo">Ticket {ref.ano}</div>
              <div className="valor num">{brl(ref.ticket)}</div>
              <div className="mudo num">
                hoje: {brl(c.ticket_medio)}{c.ticket_medio ? ` · ${pct(Number(c.ticket_medio) / ref.ticket - 1)}` : ""}
              </div>
            </div>
            <div>
              <div className="rotulo">Faturamento {ref.ano}</div>
              <div className="valor num">{brl(ref.faturamento)}</div>
              <div className="mudo num">hoje: {brl(c.faturamento)} · {pct(Number(c.faturamento) / ref.faturamento - 1)}</div>
            </div>
            <div>
              <div className="rotulo">Share do mercado</div>
              <div className="valor num">{pct(c.market_share, 2)}</div>
              <div className="mudo num">{ref.ano}: {pct(ref.market_share, 2)} · base {num(c.mercado_candidatos)}</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Tela />}</Shell>;
}
