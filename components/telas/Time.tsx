"use client";
import { useEffect, useState } from "react";
import FiltroCampanha, { type Campanha } from "@/components/FiltroCampanha";
import Curva from "@/components/Curva";
import Detalhe, { type Recorte } from "@/components/Detalhe";
import Pessoas from "@/components/Pessoas";
import Ajuda from "@/components/Ajuda";
import { supabase } from "@/lib/supabase";
import { useUltima } from "@/lib/consulta";
import { COR } from "@/lib/cores";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, dataCurta } from "@/lib/formato";
import { ultimosDias, type Periodo } from "@/lib/periodo";

type Linha = {
  responsavel: string; recebidas: number; ganhas: number; perdidas: number; abertas: number;
  conversao: number | null; alunos: number; faturamento: number; ticket_medio: number | null;
};
type Parado = {
  funil: string; etapa: string; etapa_ordem: number; abertas: number;
  ate_3d: number; d4_7: number; d8_15: number; d16_30: number; mais_30: number; dias_medio: number;
};
type Motivo = { motivo: string; perdidas: number; fatia: number };
type DiaVenda = {
  dia: string; alunos: number; faturamento: number; acumulado: number;
  dia_comp: string | null; alunos_comp: number | null; acumulado_comp: number | null;
  rotulo_comp: string | null;
};
const COMPARACOES = [
  { id: "", nome: "Sem comparação" },
  { id: "anterior", nome: "Período anterior" },
  { id: "ano", nome: "Ano passado, mesmas datas" },
  // Só faz sentido com um curso escolhido, porque é turma contra turma:
  // Método/2 com Método/2, Semi/1 com Semi/1.
  { id: "turma", nome: "Mesma turma do ano passado", soComCurso: true },
] as const;

export default function Time() {
  const ultima = useUltima();
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(30));
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [campanha, setCampanha] = useState<string | null>(null);
  const [time, setTime] = useState<Linha[] | null>(null);
  const [parados, setParados] = useState<Parado[] | null>(null);
  const [motivos, setMotivos] = useState<Motivo[] | null>(null);
  const [diasVenda, setDiasVenda] = useState<DiaVenda[] | null>(null);
  const [vista, setVista] = useState<"dia" | "acumulado">("dia");
  const [comparar, setComparar] = useState<string>("anterior");
  const [detalhe, setDetalhe] = useState<{ titulo: string; recorte: Recorte } | null>(null);
  // Gaveta de gente: todo número desta tela abre quem está por trás dele.
  const [gaveta, setGaveta] = useState<
    { titulo: string; rotulo: string; rpc: string; params: Record<string, unknown> } | null
  >(null);

  useEffect(() => {
    supabase.from("resumo_campanhas").select("id,nome,inicio,fim,produto_id").order("inicio")
      .then(({ data }) => setCampanhas((data as Campanha[]) ?? []));
  }, [volta]);

  const produto = campanhas.find((c) => c.id === campanha)?.produto_id ?? null;

  useEffect(() => {
    const p = { p_de: periodo.de, p_ate: periodo.ate };
    setTime(null); setParados(null); setMotivos(null); setDiasVenda(null);
    ultima("time", supabase.rpc("painel_time_comercial", { ...p, p_produto: produto }),
      ({ data }) => setTime((data as Linha[]) ?? []));
    ultima("parados", supabase.rpc("painel_parados", { ...p, p_trilha: "comercial", p_produto: produto }),
      ({ data }) => setParados((data as Parado[]) ?? []));
    ultima("motivos", supabase.rpc("painel_motivos_perda", { ...p, p_produto: produto }),
      ({ data }) => setMotivos((data as Motivo[]) ?? []));
    // O bloco do pré-vendas também respeita o curso escolhido. Antes ele era o
    // único da tela que ignorava o filtro, e quem lia achava que o número era
    // daquele curso.
    ultima("dias", supabase.rpc("painel_vendas_periodo", { ...p, p_produto: produto, p_comparar: comparar || null }),
      ({ data }) => setDiasVenda((data as DiaVenda[]) ?? []));
  }, [periodo, produto, comparar, volta]);

  // Tirar o curso do filtro tira o sentido da comparação por turma. Em vez de
  // deixar o gráfico sem linha de comparação e sem explicação, volta para a
  // comparação que continua valendo.
  useEffect(() => {
    if (!produto && comparar === "turma") setComparar("anterior");
  }, [produto, comparar]);

  const totalFat = time?.reduce((s, l) => s + Number(l.faturamento), 0) ?? 0;
  const maiorFat = Math.max(1, ...(time ?? []).map((l) => Number(l.faturamento)));

  return (
    <>
      <div className="rotulo">Time comercial</div>
      <h1>Quem está entregando</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <FiltroCampanha
        campanhas={campanhas}
        campanha={campanha}
        aoMudarCampanha={setCampanha}
        periodo={periodo}
        aoMudarPeriodo={setPeriodo}
      />
      <p className="nota">
        Período em análise: {dataCurta(periodo.de)} a {dataCurta(periodo.ate)}
        {campanha ? ", só " + (campanhas.find((c) => c.id === campanha)?.nome ?? "") : ", todos os cursos"}.
      </p>
      <p className="nota">
        Para cobrança de meta vale a coluna <b>Alunos</b>, não a de ganhas no CRM.
        <Ajuda titulo="Por que duas contagens"
          fontes={["Alunos: planilha comercial",
                   "Ganhas no CRM: negociação marcada como ganha no RD Station CRM",
                   "As duas se ligam por e-mail, telefone ou nome"]}>
          Alunos é a planilha comercial, que é a fonte firme: a venda entra no dia em que aconteceu.
          Ganhas no CRM é outra contagem, do RD, e costuma ficar atrás porque o negócio às vezes é fechado no
          dia seguinte, e porque nem toda venda tem negócio correspondente.
        </Ajuda>
      </p>

      <div className="secao-topo">
        <h2><span className="idx" /> Vendas dia a dia</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="atalhos">
            <button className={vista === "dia" ? "ativo" : ""} onClick={() => setVista("dia")}>Por dia</button>
            <button className={vista === "acumulado" ? "ativo" : ""} onClick={() => setVista("acumulado")}>Acumulado</button>
          </div>
          <select value={comparar} onChange={(e) => setComparar(e.target.value)} aria-label="Comparar com">
            {COMPARACOES.filter((c) => !("soComCurso" in c) || produto).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="nota">
        Matrícula por dia no período e no curso escolhidos acima, com uma linha de comparação ao lado.
        <Ajuda titulo="Como ler"
          fontes={["Planilha comercial, pela data da venda",
                   "Cancelada não entra",
                   "Período anterior: a mesma quantidade de dias imediatamente antes",
                   "Ano passado: as mesmas datas, um ano atrás",
                   "Mesma turma: pela janela de venda cadastrada para cada turma"]}>
          <b>Por dia</b> mostra o que entrou em cada data, que é onde se vê pico e buraco.
          <b> Acumulado</b> mostra o total somado, que é onde se vê aceleração ou freio.
          A comparação é alinhada por posição no período, dia 1 contra dia 1, não por data do calendário.
          <b> Mesma turma do ano passado</b> aparece quando há um curso escolhido e compara com a turma
          equivalente: Método/2 com Método/2, Semi/1 com Semi/1, alinhado pelo ponto da turma e não pela
          data. Turma que abriu mais cedo ou mais tarde que a do ano anterior deixa de atrapalhar a conta.
          Clique em um ponto para ver as matrículas daquele dia.
        </Ajuda>
      </p>
      {!diasVenda ? <p className="rotulo">Carregando</p> : diasVenda.length === 0 ? (
        <p className="mudo">Sem venda no período.</p>
      ) : (
        <>
          <div className="faixa" style={{ marginBottom: 16 }}>
            <div>
              <div className="rotulo">Matrículas no período</div>
              <div className="valor num">{num(diasVenda.reduce((s, d) => s + Number(d.alunos), 0))}</div>
              {comparar && diasVenda[0]?.rotulo_comp ? (() => {
                const agora = diasVenda.reduce((s, d) => s + Number(d.alunos), 0);
                const antes = diasVenda.reduce((s, d) => s + Number(d.alunos_comp ?? 0), 0);
                const dif = antes > 0 ? agora / antes - 1 : null;
                return (
                  <div className={"mudo num " + (dif == null ? "" : dif >= 0 ? "ok" : "alerta")}>
                    contra {num(antes)} ({diasVenda[0].rotulo_comp})
                    {dif == null ? "" : ` · ${dif >= 0 ? "+" : ""}${pct(dif)}`}
                  </div>
                );
              })() : null}
            </div>
            <div>
              <div className="rotulo">Faturamento</div>
              <div className="valor num">{brl(diasVenda.reduce((s, d) => s + Number(d.faturamento), 0))}</div>
            </div>
            <div>
              <div className="rotulo">Média por dia</div>
              <div className="valor num">
                {(diasVenda.reduce((s, d) => s + Number(d.alunos), 0) / Math.max(1, diasVenda.length))
                  .toFixed(1).replace(".", ",")}
              </div>
            </div>
            <div>
              <div className="rotulo">Melhor dia</div>
              <div className="valor num">
                {num(Math.max(0, ...diasVenda.map((d) => Number(d.alunos))))}
              </div>
              <div className="mudo num">
                {dataCurta(diasVenda.reduce((m, d) => (Number(d.alunos) > Number(m.alunos) ? d : m), diasVenda[0]).dia)}
              </div>
            </div>
          </div>
          {/* Um gráfico só, com botão para trocar a leitura. Os dois juntos na
              tela competiam pela atenção e nenhum era lido direito. */}
          <Curva
            rotulos={diasVenda.map((d) => dataCurta(d.dia))}
            series={[
              {
                nome: vista === "dia" ? "Matrículas no dia" : "Acumulado no período",
                cor: COR.tinta,
                pontos: diasVenda.map((d) => Number(vista === "dia" ? d.alunos : d.acumulado)),
              },
              ...(comparar && diasVenda[0]?.rotulo_comp ? [{
                nome: diasVenda[0].rotulo_comp as string,
                cor: COR.cinza,
                tracejada: true,
                pontos: diasVenda.map((d) =>
                  Number(vista === "dia" ? d.alunos_comp ?? 0 : d.acumulado_comp ?? 0)),
                rotulos: diasVenda.map((d) =>
                  `${num(Number(vista === "dia" ? d.alunos_comp ?? 0 : d.acumulado_comp ?? 0))}` +
                  (d.dia_comp ? ` (${dataCurta(d.dia_comp)})` : "")),
              }] : []),
            ]}
            altura={230}
            aoClicar={(i) => setDetalhe({
              titulo: "Matrículas de " + dataCurta(diasVenda[i].dia),
              recorte: { p_de: diasVenda[i].dia, p_ate: diasVenda[i].dia, p_produto: produto },
            })}
          />
        </>
      )}

      <h2><span className="idx" /> Ranking de vendas</h2>
      <p className="nota">Clique na linha de um vendedor para ver as matrículas dele no período.</p>
      {!time ? <p className="rotulo">Carregando</p> : time.length === 0 ? (
        <p className="mudo">Nenhuma atividade comercial no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>#</th><th>Vendedor</th><th className="n">Alunos</th><th className="n">Faturamento</th>
                <th style={{ minWidth: 90 }} /><th className="n">Ticket</th><th className="n">Leads recebidos</th>
                <th className="n">Ganhas no CRM</th><th className="n">Perdidas</th><th className="n">Conversão</th><th className="n">Em aberto</th>
              </tr>
            </thead>
            <tbody>
              {time.map((l, i) => (
                <tr
                  key={l.responsavel}
                  className="abre"
                  onClick={() => setDetalhe({
                    titulo: l.responsavel + ", " + dataCurta(periodo.de) + " a " + dataCurta(periodo.ate),
                    recorte: { p_de: periodo.de, p_ate: periodo.ate, p_produto: produto, p_vendedor: l.responsavel },
                  })}
                >
                  <td className="num mudo">{l.responsavel === "Venda automática" ? "" : i + 1}</td>
                  <td>
                    <b>{l.responsavel}</b>
                    {l.responsavel === "Venda automática" && <div className="rotulo">sem vendedor na planilha</div>}
                  </td>
                  <td className="n">{num(l.alunos)}</td>
                  <td className="n">{brl(l.faturamento)}</td>
                  <td><div className="mini"><i style={{ width: `${(Number(l.faturamento) / maiorFat) * 100}%` }} /></div></td>
                  <td className="n">{brl(l.ticket_medio)}</td>
                  <td className="n">{num(l.recebidas)}</td>
                  <td className="n">{num(l.ganhas)}</td>
                  <td className="n">{num(l.perdidas)}</td>
                  <td className="n">{pct(l.conversao == null ? null : Number(l.conversao))}</td>
                  <td className="n">{num(l.abertas)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="n">{num(time.reduce((s, l) => s + Number(l.alunos), 0))}</td>
                <td className="n">{brl(totalFat)}</td>
                <td colSpan={2} />
                <td className="n">{num(time.reduce((s, l) => s + Number(l.recebidas), 0))}</td>
                <td className="n">{num(time.reduce((s, l) => s + Number(l.ganhas), 0))}</td>
                <td className="n">{num(time.reduce((s, l) => s + Number(l.perdidas), 0))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="rodape">
        <b>Conversão</b> é ganhas sobre o funil inteiro do período, não só sobre o que já foi decidido.
        <Ajuda titulo="Por que contar o funil inteiro"
          fontes={["Negociações: RD Station CRM",
                   "Alunos e faturamento: planilha comercial"]}>
          Ganhas mais perdidas mais o que ainda está em aberto. Contar só o que já foi decidido inflava o
          número, porque a maior parte do funil ainda não decidiu. Venda automática é a matrícula fechada sem
          vendedor na planilha, ou seja a compra que o aluno fez sozinho pelo site: ela entra no faturamento mas
          fica fora do ranking. O ranking conta só a venda lançada dentro do período acima, então campanha com
          reserva vendida antes do início aparece menor aqui do que no cartão da campanha.
        </Ajuda>
      </p>

      <h2><span className="idx" /> Negócios em aberto e tempo parado</h2>
      {!parados ? <p className="rotulo">Carregando</p> : parados.length === 0 ? (
        <p className="mudo">Nenhum negócio em aberto no período.</p>
      ) : (
        <>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Etapa</th><th className="n">Em aberto</th><th style={{ minWidth: 140 }}>Distribuição do tempo</th>
                  <th className="n">Até 3d</th><th className="n">4 a 7d</th><th className="n">8 a 15d</th>
                  <th className="n">16 a 30d</th><th className="n">+30d</th><th className="n">Média</th>
                </tr>
              </thead>
              <tbody>
                {parados.map((p) => {
                  const t = Math.max(1, Number(p.abertas));
                  const faixas = [p.ate_3d, p.d4_7, p.d8_15, p.d16_30, p.mais_30].map((v) => (Number(v) / t) * 100);
                  return (
                    <tr key={p.funil + p.etapa}>
                      <td><b>{p.etapa}</b><div className="rotulo">{p.funil}</div></td>
                      <td className="n abre" title="Ver quem está parado nesta etapa"
                          onClick={() => setGaveta({
                            titulo: p.etapa,
                            rotulo: "Quem está parado nesta etapa",
                            rpc: "painel_parados_pessoas",
                            params: { p_de: periodo.de, p_ate: periodo.ate, p_etapa: p.etapa,
                                      p_trilha: "comercial", p_produto: produto },
                          })}><b>{num(p.abertas)}</b></td>
                      <td><div className="pilha">{faixas.map((f, i) => <i key={i} style={{ width: `${f}%` }} />)}</div></td>
                      <td className="n">{num(p.ate_3d)}</td>
                      <td className="n">{num(p.d4_7)}</td>
                      <td className="n">{num(p.d8_15)}</td>
                      <td className="n">{num(p.d16_30)}</td>
                      <td className="n"><b>{num(p.mais_30)}</b></td>
                      <td className="n">{num(p.dias_medio)}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="chaves">
            <span>Até 3 dias</span><span>4 a 7</span><span>8 a 15</span><span>16 a 30</span><span>Mais de 30</span>
          </div>
        </>
      )}

      <h2><span className="idx" /> Motivos de perda</h2>
      {!motivos ? <p className="rotulo">Carregando</p> : motivos.length === 0 ? (
        <p className="mudo">Nenhuma perda registrada no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead><tr><th>Motivo</th><th className="n">Perdas</th><th style={{ minWidth: 140 }} /><th className="n">Fatia</th></tr></thead>
            <tbody>
              {motivos.map((m) => (
                <tr key={m.motivo}>
                  <td>{m.motivo}</td>
                  <td className="n abre" title="Ver quem foi perdido por este motivo"
                      onClick={() => setGaveta({
                        titulo: m.motivo,
                        rotulo: "Quem foi perdido por este motivo",
                        rpc: "painel_perdas_pessoas",
                        params: { p_de: periodo.de, p_ate: periodo.ate, p_motivo: m.motivo, p_produto: produto },
                      })}><b>{num(m.perdidas)}</b></td>
                  <td><div className="mini"><i style={{ width: `${Number(m.fatia) * 100}%` }} /></div></td>
                  <td className="n">{pct(Number(m.fatia))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* O bloco do APV saiu daqui e foi para Comercial > Agente de Pré-vendas,
          junto com a medição pelo lado da conversa. Eram duas telas contando a
          mesma coisa por caminhos diferentes, e dava para as duas discordarem
          sem ninguém perceber. */}
      <p className="rodape">
        O Agente de Pré-vendas tem tela própria, em <a href="/comercial/?v=agente">Comercial, Agente de
        Pré-vendas</a>: entrega no CRM, resposta do cliente e o que virou matrícula.
      </p>

      {detalhe && (
        <Detalhe titulo={detalhe.titulo} recorte={detalhe.recorte} aoFechar={() => setDetalhe(null)} />
      )}
      {gaveta && (
        <Pessoas
          titulo={gaveta.titulo}
          rotulo={gaveta.rotulo}
          rpc={gaveta.rpc}
          params={gaveta.params}
          aoFechar={() => setGaveta(null)}
        />
      )}
    </>
  );
}