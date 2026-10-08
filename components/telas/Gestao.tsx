"use client";
import { useEffect, useState } from "react";
import SeletorPeriodo from "@/components/Periodo";
import Curva from "@/components/Curva";
import { supabase } from "@/lib/supabase";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, pct, dataCurta } from "@/lib/formato";
import { hojeSP, somaDias, ultimosDias, type Periodo } from "@/lib/periodo";

type Linha = { indicador: string; rotulo: string; valor: number; detalhe: string | null };
type Dia = { dia: string; conversas_novas: number; requentados: number; leads_novos: number };

export default function Gestao() {
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(7));
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [dias, setDias] = useState<Dia[] | null>(null);

  useEffect(() => {
    const p = { p_de: periodo.de, p_ate: periodo.ate };
    setLinhas(null); setDias(null);
    supabase.rpc("painel_gestao", p).then(({ data }) => setLinhas((data as Linha[]) ?? []));
    supabase.rpc("painel_gestao_dia", p).then(({ data }) => setDias((data as Dia[]) ?? []));
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
        O histórico de conversa importado do Pigeon começa em 01/08/2026. As regras de 15 e 20 dias valem
        cheias de 21/08 em diante. Antes disso o painel conta menos lead conhecido e menos requentado do que
        o real, porque não tem como ver a conversa que veio antes do corte.
      </p>

      <h2><span className="idx">024</span> Quem chegou no período</h2>
      <p className="nota">
        Lead novo é negociação criada sem nenhuma conversa nos 20 dias anteriores — gente que entrou agora.
        Quem já falava com a gente antes de virar negociação aparece separado, porque não é captação nova:
        é o funil andando.
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

      <h2><span className="idx">025</span> Conversas no período</h2>
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

      <h2><span className="idx">026</span> Dia a dia</h2>
      {!dias ? <p className="rotulo">Carregando</p> : dias.length === 0 ? (
        <p className="mudo">Sem movimento no período.</p>
      ) : (
        <>
          <Curva
            rotulos={dias.map((x) => dataCurta(x.dia))}
            series={[
              { nome: "Conversas abertas", cor: "#0A0A0A", pontos: dias.map((x) => Number(x.conversas_novas)) },
              { nome: "Leads novos", cor: "#6B6A66", pontos: dias.map((x) => Number(x.leads_novos)) },
              { nome: "Requentados", cor: "#6B6A66", tracejada: true, pontos: dias.map((x) => Number(x.requentados)) },
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
