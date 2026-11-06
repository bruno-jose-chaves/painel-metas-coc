"use client";
import { useEffect, useState } from "react";
import SeletorPeriodo from "@/components/Periodo";
import Curva from "@/components/Curva";
import { supabase } from "@/lib/supabase";
import { useUltima } from "@/lib/consulta";
import Ajuda from "@/components/Ajuda";
import { COR } from "@/lib/cores";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, pct, dataCurta } from "@/lib/formato";
import { hojeSP, somaDias, ultimosDias, type Periodo } from "@/lib/periodo";

type Linha = { indicador: string; rotulo: string; valor: number; detalhe: string | null };
type Dia = { dia: string; conversas_novas: number; requentados: number; leads_novos: number };

export default function Gestao() {
  const ultima = useUltima();
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(7));
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [dias, setDias] = useState<Dia[] | null>(null);

  useEffect(() => {
    const p = { p_de: periodo.de, p_ate: periodo.ate };
    setLinhas(null); setDias(null);
    ultima("linhas", supabase.rpc("painel_gestao", p), ({ data }) => setLinhas((data as Linha[]) ?? []));
    ultima("dias", supabase.rpc("painel_gestao_dia", p), ({ data }) => setDias((data as Dia[]) ?? []));
  }, [periodo, volta]);

  const v = (id: string) => Number(linhas?.find((l) => l.indicador === id)?.valor ?? 0);
  const d = (id: string) => linhas?.find((l) => l.indicador === id)?.detalhe ?? "";

  const novos = v("leads_novos");
  const conhecidos = v("leads_conhecidos");
  const requentados = v("requentados");
  const conversasNovas = v("conversas_novas");
  const andamento = v("conversas_andamento");
  const primeira = v("primeira_conversa");

  const totalLeads = novos + conhecidos;
  const umDia = periodo.de === periodo.ate;
  const qtdDias = dias?.length ?? 0;
  const media = (t: number) => (qtdDias ? t / qtdDias : 0);

  return (
    <>
      <div className="rotulo">Gestão</div>
      <h1>O dia da operação</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <SeletorPeriodo
        valor={periodo}
        aoMudar={setPeriodo}
        atalhos={[
          { nome: "Hoje", de: hojeSP(), ate: hojeSP() },
          { nome: "Ontem", de: somaDias(hojeSP(), -1), ate: somaDias(hojeSP(), -1) },
        ]}
      />

      <div className="faixa">
        <div>
          <div className="rotulo">Leads novos</div>
          <div className="valor num">{linhas ? num(novos) : "..."}</div>
          <div className="mudo">{!linhas ? "" : umDia ? "nunca tinham falado com a gente" : `${num(Math.round(media(novos)))} por dia útil ou não`}</div>
        </div>
        <div>
          <div className="rotulo">Leads requentados</div>
          <div className="valor num">{linhas ? num(requentados) : "..."}</div>
          <div className="mudo">{linhas ? "voltaram depois de 15 dias parados" : ""}</div>
        </div>
        <div>
          <div className="rotulo">Conversas abertas</div>
          <div className="valor num">{linhas ? num(conversasNovas) : "..."}</div>
          <div className="mudo">{!linhas ? "" : umDia ? "atendimentos iniciados" : `${num(Math.round(media(conversasNovas)))} por dia`}</div>
        </div>
        <div>
          <div className="rotulo">Conversas em andamento</div>
          <div className="valor num">{linhas ? num(andamento) : "..."}</div>
          <div className="mudo">{linhas ? "começaram antes e tiveram movimento" : ""}</div>
        </div>
      </div>

      <p className="nota">
        O histórico de conversa importado do Pigeon começa em 04/03/2026.
        <Ajuda titulo="O que isso limita"
          fontes={["Conversas e mensagens: Pigeon Post"]}>
          As regras de 15 e 20 dias valem cheias de 24/03 em diante. Antes disso, quem conversou em
          fevereiro pode aparecer como lead novo, porque o painel não enxerga a conversa anterior.
        </Ajuda>
      </p>

      <h2><span className="idx" /> Quem chegou no período</h2>
      <p className="nota">
        Separa a entrada de gente em rosto novo e rosto que já conhecia a gente. Serve para saber se o
        volume do período veio de captação nova ou de base antiga voltando, porque as duas coisas pedem
        reação diferente de marketing e de comercial.
        <Ajuda titulo="Novo, conhecido e requentado"
          fontes={["Negociações criadas: RD Station CRM, pela data de criação",
                   "Conversa anterior: Pigeon Post, ligada à negociação pelo telefone"]}>
          <b>Lead novo</b> é negociação criada sem nenhuma conversa com a gente nos 20 dias anteriores:
          rosto novo. <b>Lead conhecido</b> é o contrário, já tinha conversa recente quando a negociação
          nasceu. <b>Requentado</b> é quem voltou a falar depois de 15 dias parado, e por isso não entra no
          total de negociações criadas: ele não é entrada nova, é base reagindo. A soma de novo mais
          conhecido fecha o total de negociações criadas no período.
        </Ajuda>
      </p>
      {!linhas ? <p className="rotulo">Carregando</p> : (
        <div className="rolar">
          <table className="tabela">
            <thead><tr><th>O quê</th><th className="n">No período</th><th className="n">Do total</th><th>Como é contado</th></tr></thead>
            <tbody>
              {["leads_novos", "leads_conhecidos"].map((id) => (
                <tr key={id}>
                  <td><b>{linhas.find((l) => l.indicador === id)?.rotulo}</b></td>
                  <td className="n"><b>{num(v(id))}</b></td>
                  <td className="n">{totalLeads ? pct(v(id) / totalLeads) : "-"}</td>
                  <td className="mudo">{d(id)}</td>
                </tr>
              ))}
              <tr>
                <td>Total de negociações criadas</td>
                <td className="n"><b>{num(totalLeads)}</b></td>
                <td className="n">100,0%</td>
                <td className="mudo">tudo que entrou no CRM no período</td>
              </tr>
              <tr>
                <td><b>{linhas.find((l) => l.indicador === "requentados")?.rotulo}</b></td>
                <td className="n"><b>{num(requentados)}</b></td>
                <td className="n">-</td>
                <td className="mudo">{d("requentados")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Conversas no período</h2>
      <p className="nota">
        O mesmo período visto pelo WhatsApp em vez do CRM: quantas conversas o time tocou e quanto disso
        era gente falando com a gente pela primeira vez. É a medida de carga de atendimento, não de venda.
        <Ajuda titulo="O que conta como conversa"
          fontes={["Conversas e mensagens: Pigeon Post",
                   "Primeira conversa: nenhuma mensagem anterior daquele telefone na base"]}>
          <b>Conversa aberta</b> é conversa que começou no período. <b>Em andamento</b> é conversa que já
          existia e recebeu mensagem dentro do período. Somadas, dão as <b>conversas tocadas</b>, que é o
          volume real de trabalho do dia, maior que o número de leads novos. <b>Rosto novo</b> é a fatia das
          conversas abertas que é primeiro contato de verdade: quanto mais baixo, mais o time está gastando
          o dia em retorno de quem já conhecia a gente.
        </Ajuda>
      </p>
      {!linhas ? <p className="rotulo">Carregando</p> : (
        <div className="rolar">
          <table className="tabela">
            <thead><tr><th>O quê</th><th className="n">No período</th><th>Como é contado</th></tr></thead>
            <tbody>
              {["conversas_novas", "conversas_andamento", "primeira_conversa"].map((id) => (
                <tr key={id}>
                  <td><b>{linhas.find((l) => l.indicador === id)?.rotulo}</b></td>
                  <td className="n"><b>{num(v(id))}</b></td>
                  <td className="mudo">{d(id)}</td>
                </tr>
              ))}
              <tr>
                <td>Conversas tocadas no período</td>
                <td className="n"><b>{num(conversasNovas + andamento)}</b></td>
                <td className="mudo">novas mais as que já estavam abertas</td>
              </tr>
              <tr>
                <td>Rosto novo entre as conversas abertas</td>
                <td className="n">{conversasNovas ? pct(primeira / conversasNovas) : "-"}</td>
                <td className="mudo">quanto do atendimento é gente nova, não retorno</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Dia a dia</h2>
      <p className="nota">
        As três entradas dia a dia, uma linha cada, para enxergar buraco e pico no período em vez do total
        fechado. Queda nas três no mesmo dia costuma ser feriado ou anúncio parado, e não time parado.
        <Ajuda titulo="As três linhas"
          fontes={["Conversas abertas: Pigeon Post",
                   "Leads novos e requentados: RD Station CRM cruzado com Pigeon Post"]}>
          <b>Conversas abertas</b> é o WhatsApp, <b>leads novos</b> é o CRM, e os dois não batem de
          propósito: há conversa que nunca virou negociação e negociação que nasceu sem conversa.
          <b> Requentados</b> é a linha tracejada e anda sozinha: ela sobe quando alguém trabalha a base
          antiga, independente de captação.
        </Ajuda>
      </p>
      {!dias ? <p className="rotulo">Carregando</p> : dias.length === 0 ? (
        <p className="mudo">Sem movimento no período.</p>
      ) : (
        <>
          <Curva
            rotulos={dias.map((x) => dataCurta(x.dia))}
            series={[
              { nome: "Conversas abertas", cor: COR.tinta, pontos: dias.map((x) => Number(x.conversas_novas)) },
              { nome: "Leads novos", cor: COR.cinza, pontos: dias.map((x) => Number(x.leads_novos)) },
              { nome: "Requentados", cor: COR.cinza, tracejada: true, pontos: dias.map((x) => Number(x.requentados)) },
            ]}
          />
          <div className="rolar" style={{ marginTop: 16 }}>
            <table className="tabela">
              <thead><tr><th>Dia</th><th className="n">Conversas abertas</th><th className="n">Leads novos</th><th className="n">Requentados</th></tr></thead>
              <tbody>
                {[...dias].reverse().map((x) => (
                  <tr key={x.dia}>
                    <td className="num">{dataCurta(x.dia)}</td>
                    <td className="n">{num(x.conversas_novas)}</td>
                    <td className="n">{num(x.leads_novos)}</td>
                    <td className="n">{Number(x.requentados) > 0 ? num(x.requentados) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
