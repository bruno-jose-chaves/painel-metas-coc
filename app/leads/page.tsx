"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import SeletorPeriodo from "@/components/Periodo";
import Curva from "@/components/Curva";
import { supabase } from "@/lib/supabase";
import { num, pct, dataCurta } from "@/lib/formato";
import { ultimosDias, type Periodo } from "@/lib/periodo";

type Dia = { dia: string; conversoes: number; conversoes_lp: number; visitas: number };
type Origem = { identificador: string; tipo: string; conversoes: number; visitas: number; taxa: number | null };
type Fonte = { fonte: string; negocios: number; ganhas: number; conversao: number | null };
type PreVenda = { captados: number; aquecidos: number; entregues: number; sem_contato: number; parados_7d: number; parados_30d: number };
type Campanha = { id: string; nome: string; inicio: string; fim: string };
type Tag = { tag: string; leads: number; conversoes: number };

const TIPO: Record<string, string> = { landing_page: "Landing page do RD", formulario: "Formulário embutido" };

function Tela() {
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(30));
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [dias, setDias] = useState<Dia[] | null>(null);
  const [origens, setOrigens] = useState<Origem[] | null>(null);
  const [fontes, setFontes] = useState<Fonte[] | null>(null);
  const [apv, setApv] = useState<PreVenda | null>(null);
  const [tags, setTags] = useState<Tag[] | null>(null);

  useEffect(() => {
    supabase.from("resumo_campanhas").select("id,nome,inicio,fim").order("inicio")
      .then(({ data }) => setCampanhas((data as Campanha[]) ?? []));
  }, []);

  useEffect(() => {
    const p = { p_de: periodo.de, p_ate: periodo.ate };
    setDias(null); setOrigens(null); setFontes(null); setApv(null); setTags(null);
    supabase.rpc("painel_leads_dia", p).then(({ data }) => setDias((data as Dia[]) ?? []));
    supabase.rpc("painel_leads_origem", p).then(({ data }) => setOrigens((data as Origem[]) ?? []));
    supabase.rpc("painel_fontes", p).then(({ data }) => setFontes((data as Fonte[]) ?? []));
    supabase.rpc("painel_pre_venda", p).then(({ data }) => setApv(((data as PreVenda[]) ?? [])[0] ?? null));
    supabase.rpc("painel_tags", p).then(({ data }) => setTags((data as Tag[]) ?? []));
  }, [periodo]);

  const totalConv = dias?.reduce((s, d) => s + Number(d.conversoes), 0) ?? 0;
  const totalConvLp = dias?.reduce((s, d) => s + Number(d.conversoes_lp), 0) ?? 0;
  const totalVis = dias?.reduce((s, d) => s + Number(d.visitas), 0) ?? 0;
  const maiorConv = Math.max(1, ...(origens ?? []).map((o) => Number(o.conversoes)));

  return (
    <>
      <div className="rotulo">015 · Leads</div>
      <h1>De onde vem o lead</h1>

      <SeletorPeriodo
        valor={periodo}
        aoMudar={setPeriodo}
        atalhos={campanhas.map((c) => ({ nome: c.nome, de: c.inicio, ate: c.fim }))}
      />

      <div className="faixa">
        <div><div className="rotulo">Conversões</div><div className="valor num">{dias ? num(totalConv) : "..."}</div></div>
        <div>
          <div className="rotulo">Em formulário embutido</div>
          <div className="valor num">{dias ? num(totalConv - totalConvLp) : "..."}</div>
          <div className="mudo">páginas do site</div>
        </div>
        <div>
          <div className="rotulo">Em landing page do RD</div>
          <div className="valor num">{dias ? num(totalConvLp) : "..."}</div>
          <div className="mudo num">{dias && totalVis ? num(totalVis) + " visitas registradas" : ""}</div>
        </div>
        <div>
          <div className="rotulo">Média por dia</div>
          <div className="valor num">{dias?.length ? num(Math.round(totalConv / dias.length)) : "-"}</div>
        </div>
        <div>
          <div className="rotulo">Captados pelo APV</div>
          <div className="valor num">{apv ? num(apv.captados) : "..."}</div>
        </div>
      </div>

      <h2><span className="idx">016</span> Conversões por dia</h2>
      {!dias ? <p className="rotulo">Carregando</p> : dias.length === 0 ? (
        <p className="mudo">Sem conversões registradas no período.</p>
      ) : (
        <Curva
          rotulos={dias.map((d) => dataCurta(d.dia))}
          series={[
            { nome: "Conversões", cor: "#0A0A0A", pontos: dias.map((d) => Number(d.conversoes)) },
            { nome: "Visitas em landing page", cor: "#6B6A66", tracejada: true, pontos: dias.map((d) => Number(d.visitas)) },
          ]}
        />
      )}

      <h2><span className="idx">017</span> Páginas e formulários</h2>
      {!origens ? <p className="rotulo">Carregando</p> : origens.length === 0 ? (
        <p className="mudo">Sem conversões por página no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Ativo</th><th>Tipo</th><th className="n">Conversões</th>
                <th style={{ minWidth: 120 }} /><th className="n">Visitas</th><th className="n">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {origens.map((o) => (
                <tr key={o.tipo + o.identificador}>
                  <td style={{ maxWidth: 420, wordBreak: "break-word" }}>{o.identificador}</td>
                  <td className="mudo">{TIPO[o.tipo] ?? o.tipo}</td>
                  <td className="n"><b>{num(o.conversoes)}</b></td>
                  <td><div className="mini"><i style={{ width: `${(Number(o.conversoes) / maiorConv) * 100}%` }} /></div></td>
                  <td className="n">{o.visitas == null ? "não medido" : num(o.visitas)}</td>
                  <td className="n">{o.taxa == null ? "-" : pct(Number(o.taxa), 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx">018</span> Tags dos leads</h2>
      {!tags ? <p className="rotulo">Carregando</p> : tags.length === 0 ? (
        <p className="mudo">
          Ainda sem tags no período. O webhook de conversão foi ligado em 02/10/2026, então só há tag a partir dessa data.
        </p>
      ) : (
        <>
          <div className="rolar">
            <table className="tabela">
              <thead><tr><th>Tag</th><th className="n">Pessoas</th><th className="n">Conversões</th><th style={{ minWidth: 120 }} /></tr></thead>
              <tbody>
                {tags.map((x) => (
                  <tr key={x.tag}>
                    <td>{x.tag}</td>
                    <td className="n">{num(x.leads)}</td>
                    <td className="n">{num(x.conversoes)}</td>
                    <td><div className="mini"><i style={{ width: `${(Number(x.conversoes) / Math.max(1, ...tags.map((y) => Number(y.conversoes)))) * 100}%` }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mudo" style={{ marginTop: 10 }}>
            Cada conversão traz as tags que a pessoa tinha naquele momento. É daqui que sai, na próxima versão, o de para de tag para curso de destino.
          </p>
        </>
      )}

      <h2><span className="idx">019</span> Origem dos negócios no CRM</h2>
      {!fontes ? <p className="rotulo">Carregando</p> : fontes.length === 0 ? (
        <p className="mudo">Nenhum negócio criado no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead><tr><th>Origem</th><th className="n">Negócios</th><th className="n">Ganhas</th><th className="n">Conversão</th></tr></thead>
            <tbody>
              {fontes.map((f) => (
                <tr key={f.fonte}>
                  <td>{f.fonte}</td>
                  <td className="n">{num(f.negocios)}</td>
                  <td className="n">{num(f.ganhas)}</td>
                  <td className="n">{pct(f.conversao == null ? null : Number(f.conversao))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mudo" style={{ marginTop: 24 }}>
        O RD só conta visita nas páginas hospedadas por ele. Quando a página é feita em HTML no site de vocês e usa um formulário embutido do RD, a conversão é registrada mas a visita acontece fora do alcance dele. Por isso o formulário embutido aparece sem visita e sem taxa.
      </p>
      <p className="mudo">
        Mesmo nas landing pages do RD a taxa é aproximada: a visita e a conversão podem cair em dias diferentes, e o lead
        que chega por e-mail converte sem visita contada. Use a conversão como número firme e a taxa só como indício. Medir
        visita de verdade nas páginas do site exige trazer o dado do Google Analytics, que é um passo à parte.
      </p>
      <p className="mudo">
        A tag de cada lead ainda não é lida por aqui: a API do RD só entrega esse dado por webhook, e isso entra numa próxima versão.
      </p>
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Tela />}</Shell>;
}
