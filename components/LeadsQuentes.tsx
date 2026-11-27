"use client";
import { useEffect, useMemo, useState } from "react";
import Curva from "@/components/Curva";
import Ajuda from "@/components/Ajuda";
import Esqueleto from "@/components/Esqueleto";
import { supabase } from "@/lib/supabase";
import { useUltima } from "@/lib/consulta";
import { COR } from "@/lib/cores";
import { num, pct, dataCurta } from "@/lib/formato";
import { somaDias, type Periodo } from "@/lib/periodo";

// Leads quentes: só quem levantou a mão (reserva, lead de curso, inscrição em
// live). Material rico, que é lead frio, fica fora por padrão. O tipo de cada
// formulário vem da regra dele em Marketing, A classificar.
type Linha = {
  dia: string; identificador: string; indicador: string; canal: string; origem: string;
  conversoes: number; pessoas: number;
};
type Meta = { indicador: string; rotulo: string; meta: number; realizado: number; esperado_hoje: number; situacao: string };
type Frente = {
  frente: string; inicio: string; fim: string; captados: number; meta: number;
  esperado_hoje: number; situacao: string; campanhas_crm: string[] | null;
};

const TIPOS: { id: string; nome: string; indicadores: string[] }[] = [
  { id: "quentes", nome: "Quentes", indicadores: ["reservas", "leads", "inscritos_lives"] },
  { id: "reservas", nome: "Reservas", indicadores: ["reservas"] },
  { id: "leads", nome: "Leads de curso", indicadores: ["leads"] },
  { id: "lives", nome: "Inscritos em live", indicadores: ["inscritos_lives"] },
  { id: "frios", nome: "Material rico (frio)", indicadores: ["material_rico"] },
];
const NOME_TIPO: Record<string, string> = {
  reservas: "Reserva", leads: "Lead de curso", inscritos_lives: "Inscrito em live",
  material_rico: "Material rico", sem_regra: "Sem tipo",
};
const SITUACAO: Record<string, string> = {
  no_ritmo: "No ritmo", atencao: "Atenção", atras: "Atrás", sem_meta: "Sem meta", nao_iniciada: "Não começou",
};

export default function LeadsQuentes({ periodo, campanha, produto, volta }: {
  periodo: Periodo; campanha: string | null; produto: string | null; volta: number;
}) {
  const ultima = useUltima();
  const [tipo, setTipo] = useState("quentes");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [semTipo, setSemTipo] = useState<number | null>(null);
  const [metas, setMetas] = useState<Meta[] | null>(null);
  const [frentes, setFrentes] = useState<Frente[] | null>(null);
  const indicadores = TIPOS.find((t) => t.id === tipo)!.indicadores;

  useEffect(() => {
    setLinhas(null);
    ultima("quentes", supabase.rpc("painel_leads_quentes", {
      p_de: periodo.de, p_ate: periodo.ate, p_produto: produto, p_indicadores: indicadores,
    }), ({ data }) => setLinhas((data as Linha[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, produto, tipo, volta]);

  // Quanto da captação do período ainda não tem tipo: esse volume não entra em
  // nenhuma das contas acima até alguém classificar o formulário.
  useEffect(() => {
    setSemTipo(null);
    if (produto) return;
    ultima("semtipo", supabase.rpc("painel_leads_quentes", {
      p_de: periodo.de, p_ate: periodo.ate, p_produto: null, p_indicadores: ["sem_regra"],
    }), ({ data }) => setSemTipo(((data as Linha[]) ?? []).reduce((s, l) => s + Number(l.conversoes), 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, produto, volta]);

  useEffect(() => {
    setMetas(null); setFrentes(null);
    if (!campanha) return;
    ultima("metas", supabase.rpc("painel_metas_leads_todas", { p_campanhas: [campanha] }),
      ({ data }) => setMetas((data as Meta[]) ?? []));
    ultima("frentes", supabase.rpc("painel_metas_leads_frentes", { p_campanha: campanha }),
      ({ data }) => setFrentes((data as Frente[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanha, volta]);

  const total = (linhas ?? []).reduce((s, l) => s + Number(l.conversoes), 0);

  const dias = useMemo(() => {
    const lista: string[] = [];
    for (let d = periodo.de; d <= periodo.ate && lista.length < 400; d = somaDias(d, 1)) lista.push(d);
    return lista;
  }, [periodo.de, periodo.ate]);

  const series = useMemo(() => {
    const tiposNoDado = indicadores.filter((i) => (linhas ?? []).some((l) => l.indicador === i));
    const cores = [COR.tinta, COR.ruim, COR.cinza];
    return tiposNoDado.map((ind, k) => {
      const porDia: Record<string, number> = {};
      for (const l of linhas ?? []) if (l.indicador === ind) porDia[l.dia] = (porDia[l.dia] ?? 0) + Number(l.conversoes);
      return { nome: NOME_TIPO[ind] ?? ind, cor: cores[k % cores.length], pontos: dias.map((d) => porDia[d] ?? 0) };
    });
  }, [linhas, dias, indicadores]);

  const porCanal = useMemo(() => {
    const m = new Map<string, { n: number; origens: Map<string, number> }>();
    for (const l of linhas ?? []) {
      const a = m.get(l.canal) ?? { n: 0, origens: new Map() };
      a.n += Number(l.conversoes);
      a.origens.set(l.origem, (a.origens.get(l.origem) ?? 0) + Number(l.conversoes));
      m.set(l.canal, a);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [linhas]);

  const porForm = useMemo(() => {
    const m = new Map<string, { indicador: string; n: number }>();
    for (const l of linhas ?? []) {
      const k = l.identificador + "|" + l.indicador;
      const a = m.get(k) ?? { indicador: l.indicador, n: 0 };
      a.n += Number(l.conversoes);
      m.set(k, a);
    }
    return [...m.entries()].map(([k, v]) => ({ identificador: k.split("|")[0], ...v })).sort((a, b) => b.n - a.n);
  }, [linhas]);

  const metasDoTipo = (metas ?? []).filter((m) => indicadores.includes(m.indicador));
  const maiorCanal = Math.max(1, ...porCanal.map(([, a]) => a.n));

  return (
    <>
      <h2><span className="idx" /> Leads quentes contra a meta</h2>
      <p className="nota">
        Só quem levantou a mão: reserva, lead de curso e inscrição em live. Material rico é lead frio e
        fica de fora, a não ser que você escolha olhar para ele.
        <Ajuda titulo="De onde vem o tipo de cada lead"
          fontes={["Conversões: RD Station Marketing",
                   "Tipo de cada formulário: as regras em Marketing, A classificar",
                   "Meta de captação: Ajustes, Campanhas e metas"]}>
          Cada formulário tem um tipo na regra dele (reserva, lead, inscrito em live ou material rico).
          Formulário sem regra ainda não tem tipo e não entra em nenhuma conta desta parte até ser
          classificado. A meta aparece quando há uma campanha escolhida no filtro e ela tem meta de
          captação cadastrada; o número da meta conta a campanha inteira, não só o período escolhido.
          Na tabela de frentes (Black, ConCOC, Site PV, COC Experience), lead é negociação criada no CRM
          com o nome da campanha daquela frente, uma por pessoa, dentro da janela da frente; o esperado
          hoje cresce só dentro dessa janela.
        </Ajuda>
      </p>

      <div className="atalhos" style={{ marginBottom: 14 }} aria-label="Tipo de lead">
        {TIPOS.map((t) => (
          <button key={t.id} className={tipo === t.id ? "ativo" : ""} onClick={() => setTipo(t.id)}>{t.nome}</button>
        ))}
      </div>

      <div className="faixa">
        <div>
          <div className="rotulo">Conversões no período</div>
          <div className="valor num">{linhas ? num(total) : "..."}</div>
          <div className="mudo num">{linhas && dias.length ? num(Math.round((total / dias.length) * 10) / 10) + " por dia" : ""}</div>
        </div>
        {campanha && metas && metasDoTipo.length === 0 && (
          <div>
            <div className="rotulo">Meta de captação</div>
            <div className="valor">sem meta</div>
            <div className="mudo">cadastre em Ajustes, Campanhas e metas</div>
          </div>
        )}
        {metasDoTipo.map((m) => (
          <div key={m.indicador}>
            <div className="rotulo">{m.rotulo} na campanha</div>
            <div className="valor num">
              {num(m.realizado)}{m.meta > 0 && <span className="mudo"> de {num(m.meta)}</span>}
            </div>
            <div className="mudo num">
              {m.meta > 0
                ? `${pct(Number(m.realizado) / m.meta, 0)} · esperado hoje ${num(Math.round(Number(m.esperado_hoje)))} · ${SITUACAO[m.situacao] ?? m.situacao}`
                : "sem meta"}
            </div>
          </div>
        ))}
        {!campanha && (
          <div>
            <div className="rotulo">Meta</div>
            <div className="valor">-</div>
            <div className="mudo">escolha uma campanha no filtro</div>
          </div>
        )}
      </div>

      {campanha && frentes && frentes.length > 0 && indicadores.includes("leads") && (
        <div className="rolar" style={{ marginBottom: 18 }}>
          <table className="tabela">
            <thead>
              <tr>
                <th>Frente da campanha</th><th>Janela</th><th className="n">Leads</th><th className="n">Meta</th>
                <th className="n">Atingido</th><th className="n">Esperado hoje</th><th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {frentes.map((f) => (
                <tr key={f.frente}>
                  <td title={f.campanhas_crm?.length ? "No CRM: " + f.campanhas_crm.join(", ") : "Nenhuma campanha do CRM com esse nome ainda"}>
                    {f.frente}
                  </td>
                  <td className="mudo num">{dataCurta(f.inicio)} a {dataCurta(f.fim)}</td>
                  <td className="n"><b>{num(f.captados)}</b></td>
                  <td className="n">{num(f.meta)}</td>
                  <td className="n">{f.meta ? pct(Number(f.captados) / f.meta, 0) : "-"}</td>
                  <td className="n">{num(Math.round(Number(f.esperado_hoje)))}</td>
                  <td><span className={"selo " + f.situacao}>{SITUACAO[f.situacao] ?? f.situacao}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {semTipo != null && semTipo > 0 && (
        <p className="nota">
          {num(semTipo)} conversões do período vieram de formulários ainda sem tipo e não entram nesta conta.{" "}
          <a href="/marketing/?v=classificar">Classificar em Marketing, A classificar</a>.
        </p>
      )}

      {!linhas ? <Esqueleto /> : total === 0 ? (
        <p className="mudo">Sem leads desse tipo no período.</p>
      ) : (
        <Curva rotulos={dias.map((d) => dataCurta(d))} series={series} />
      )}

      <h2><span className="idx" /> Leads quentes por canal</h2>
      <p className="nota">
        De onde veio cada lead do tipo escolhido, pela origem que o RD registra na conversão.
        <Ajuda titulo="Como o canal é montado"
          fontes={["Origem: RD Station Marketing, no momento da conversão"]}>
          A origem que o RD guarda é muito detalhada (cada conjunto de anúncio vira uma origem). Aqui ela é
          juntada em canais: Anúncio Meta, Google Ads, Busca orgânica, Redes sociais, Acesso direto, Site do
          COC, E-mail e Link em outro site. <b>Desconhecida</b> é quando o RD não conseguiu identificar de
          onde a pessoa veio. Passe o mouse no canal para ver as origens que entraram nele.
        </Ajuda>
      </p>
      {!linhas ? <Esqueleto /> : porCanal.length === 0 ? (
        <p className="mudo">Sem leads desse tipo no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead><tr><th>Canal</th><th className="n">Conversões</th><th className="n">Parte</th><th style={{ minWidth: 120 }} /></tr></thead>
            <tbody>
              {porCanal.map(([canal, a]) => (
                <tr key={canal}>
                  <td title={[...a.origens.entries()].sort((x, y) => y[1] - x[1]).map(([o, n]) => `${o}: ${n}`).join("\n")}>{canal}</td>
                  <td className="n"><b>{num(a.n)}</b></td>
                  <td className="n">{pct(a.n / total, 0)}</td>
                  <td><div className="mini"><i style={{ width: `${(a.n / maiorCanal) * 100}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> Leads quentes por formulário</h2>
      <p className="nota">Qual formulário trouxe cada lead do tipo escolhido no período.</p>
      {!linhas ? <Esqueleto /> : porForm.length === 0 ? (
        <p className="mudo">Sem leads desse tipo no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead><tr><th>Formulário</th><th>Tipo</th><th className="n">Conversões</th><th className="n">Parte</th></tr></thead>
            <tbody>
              {porForm.map((f) => (
                <tr key={f.identificador + f.indicador}>
                  <td style={{ maxWidth: 420, wordBreak: "break-word" }}>{f.identificador}</td>
                  <td className="mudo">{NOME_TIPO[f.indicador] ?? f.indicador}</td>
                  <td className="n"><b>{num(f.n)}</b></td>
                  <td className="n">{pct(f.n / total, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
