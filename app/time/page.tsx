"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import FiltroCampanha, { type Campanha } from "@/components/FiltroCampanha";
import { supabase } from "@/lib/supabase";
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
type PreVenda = {
  captados: number; contatados: number; sem_contato: number;
  entregues: number; ganhos: number; ganhos_de_antes: number; parados_7d: number; parados_30d: number;
};

function Tela() {
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(30));
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [campanha, setCampanha] = useState<string | null>(null);
  const [time, setTime] = useState<Linha[] | null>(null);
  const [parados, setParados] = useState<Parado[] | null>(null);
  const [motivos, setMotivos] = useState<Motivo[] | null>(null);
  const [apv, setApv] = useState<PreVenda | null>(null);

  useEffect(() => {
    supabase.from("resumo_campanhas").select("id,nome,inicio,fim,produto_id").order("inicio")
      .then(({ data }) => setCampanhas((data as Campanha[]) ?? []));
  }, []);

  const produto = campanhas.find((c) => c.id === campanha)?.produto_id ?? null;

  useEffect(() => {
    const p = { p_de: periodo.de, p_ate: periodo.ate };
    setTime(null); setParados(null); setMotivos(null); setApv(null);
    supabase.rpc("painel_time_comercial", { ...p, p_produto: produto })
      .then(({ data }) => setTime((data as Linha[]) ?? []));
    supabase.rpc("painel_parados", { ...p, p_trilha: "comercial", p_produto: produto })
      .then(({ data }) => setParados((data as Parado[]) ?? []));
    supabase.rpc("painel_motivos_perda", { ...p, p_produto: produto })
      .then(({ data }) => setMotivos((data as Motivo[]) ?? []));
    supabase.rpc("painel_pre_venda", p).then(({ data }) => setApv(((data as PreVenda[]) ?? [])[0] ?? null));
  }, [periodo, produto]);

  const totalFat = time?.reduce((s, l) => s + Number(l.faturamento), 0) ?? 0;
  const maiorFat = Math.max(1, ...(time ?? []).map((l) => Number(l.faturamento)));

  return (
    <>
      <div className="rotulo">008 · Time comercial</div>
      <h1>Quem está entregando</h1>

      <FiltroCampanha
        campanhas={campanhas}
        campanha={campanha}
        aoMudarCampanha={setCampanha}
        periodo={periodo}
        aoMudarPeriodo={setPeriodo}
      />
      <p className="mudo" style={{ marginBottom: 24 }}>
        Período em análise: {dataCurta(periodo.de)} a {dataCurta(periodo.ate)}
        {campanha ? ", só " + (campanhas.find((c) => c.id === campanha)?.nome ?? "") : ", todos os cursos"}.
      </p>
      <p className="mudo" style={{ marginBottom: 24 }}>
        <b>Alunos</b> é a planilha comercial, que é a fonte firme: a venda entra no dia em que aconteceu.
        <b> Ganhas no CRM</b> é outra contagem, do RD, e costuma ficar atrás porque o negócio às vezes é
        fechado no dia seguinte, e porque nem toda venda tem negócio correspondente. Para cobrança de meta,
        vale a coluna Alunos.
      </p>

      <h2><span className="idx">009</span> Ranking de vendas</h2>
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
                <tr key={l.responsavel}>
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
      <p className="mudo" style={{ marginTop: 10 }}>
        Conversão é ganhas sobre o funil inteiro do período: ganhas mais perdidas mais o que ainda está em aberto. Contar só o que já foi decidido inflava o número, porque a maior parte do funil ainda não decidiu.
        Venda automática é a matrícula fechada sem vendedor na planilha, ou seja a compra que o aluno fez sozinho pelo site. Ela entra no faturamento, mas fica fora do ranking.
      </p>

      <h2><span className="idx">010</span> Negócios em aberto e tempo parado</h2>
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
                      <td className="n">{num(p.abertas)}</td>
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

      <h2><span className="idx">011</span> Motivos de perda</h2>
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
                  <td className="n">{num(m.perdidas)}</td>
                  <td><div className="mini"><i style={{ width: `${Number(m.fatia) * 100}%` }} /></div></td>
                  <td className="n">{pct(Number(m.fatia))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx">012</span> Agente de Pré-vendas (APV)</h2>
      {!apv ? <p className="rotulo">Carregando</p> : (
        <>
          <div className="faixa">
            <div>
              <div className="rotulo">Leads captados</div>
              <div className="valor num">{num(apv.captados)}</div>
              <div className="mudo">material rico</div>
            </div>
            <div>
              <div className="rotulo">Entregues ao comercial</div>
              <div className="valor num">{num(apv.entregues)}</div>
              <div className="mudo num">
                {apv.captados ? pct(Number(apv.entregues) / Number(apv.captados), 1) + " do captado" : ""}
              </div>
            </div>
            <div>
              <div className="rotulo">Viraram matrícula</div>
              <div className="valor num">{num(apv.ganhos)}</div>
              <div className="mudo num">
                {Number(apv.ganhos_de_antes) > 0
                  ? num(apv.ganhos_de_antes) + " vieram de antes do período"
                  : "todas captadas no período"}
              </div>
            </div>
            <div>
              <div className="rotulo">Trabalhados pelo agente</div>
              <div className="valor num">{num(apv.contatados)}</div>
              <div className="mudo">saíram de Sem contato</div>
            </div>
            <div>
              <div className="rotulo">Parados +7 dias</div>
              <div className="valor num">{num(apv.parados_7d)}</div>
            </div>
            <div>
              <div className="rotulo">Parados +30 dias</div>
              <div className="valor num">{num(apv.parados_30d)}</div>
            </div>
          </div>
          <p className="mudo" style={{ marginTop: 10 }}>
            O APV é o agente de IA de pré-vendas. Ele captura o lead de material rico no funil SDR e o time comercial abre a negociação no funil principal.
            Entregue significa que o mesmo contato virou negócio no funil comercial depois de entrar no SDR, que é a leitura confiável da passagem de bastão.
            Captação e resultado têm janelas diferentes de propósito: captado é quem entrou no SDR dentro do período,
            e matrícula é a venda fechada dentro do período, mesmo que o agente tenha trabalhado o lead antes, como acontece com reserva de campanha anterior.
            Sem essa separação a entrega do agente aparecia muito menor do que é.
          </p>
        </>
      )}
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Tela />}</Shell>;
}
