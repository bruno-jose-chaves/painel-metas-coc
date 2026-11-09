"use client";
import { useEffect, useState } from "react";
import FiltroCampanha, { type Campanha } from "@/components/FiltroCampanha";
import Curva from "@/components/Curva";
import { supabase } from "@/lib/supabase";
import { buscarCampanhas } from "@/lib/campanhas";
import { useUltima } from "@/lib/consulta";
import Ajuda from "@/components/Ajuda";
import { COR } from "@/lib/cores";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, pct, dataCurta } from "@/lib/formato";
import { ultimosDias, type Periodo } from "@/lib/periodo";
import Esqueleto from "@/components/Esqueleto";

type Dia = { dia: string; conversoes: number; conversoes_lp: number; visitas: number };
type Origem = { identificador: string; tipo: string; conversoes: number; visitas: number; taxa: number | null };
type Fonte = { fonte: string; negocios: number; ganhas: number; conversao: number | null };
type Tag = { tag: string; leads: number; conversoes: number };

const TIPO: Record<string, string> = { landing_page: "Landing page do RD", formulario: "Formulário embutido" };

export default function Leads() {
  const ultima = useUltima();
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(30));
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [campanha, setCampanha] = useState<string | null>(null);
  const [dias, setDias] = useState<Dia[] | null>(null);
  const [origens, setOrigens] = useState<Origem[] | null>(null);
  const [fontes, setFontes] = useState<Fonte[] | null>(null);
  const [tags, setTags] = useState<Tag[] | null>(null);

  useEffect(() => {
    buscarCampanhas<Campanha>().then(setCampanhas);
  }, [volta]);

  const produto = campanhas.find((c) => c.id === campanha)?.produto_id ?? null;

  useEffect(() => {
    const p = { p_de: periodo.de, p_ate: periodo.ate, p_produto: produto };
    setDias(null); setOrigens(null); setFontes(null); setTags(null);
    ultima("dias", supabase.rpc("painel_leads_dia", p), ({ data }) => setDias((data as Dia[]) ?? []));
    ultima("origens", supabase.rpc("painel_leads_origem", p), ({ data }) => setOrigens((data as Origem[]) ?? []));
    supabase.rpc("painel_fontes", p).then(({ data }) => setFontes((data as Fonte[]) ?? []));
    ultima("tags", supabase.rpc("painel_tags", p), ({ data }) => setTags((data as Tag[]) ?? []));
  }, [periodo, produto, volta]);

  const totalConv = dias?.reduce((s, d) => s + Number(d.conversoes), 0) ?? 0;
  const totalConvLp = dias?.reduce((s, d) => s + Number(d.conversoes_lp), 0) ?? 0;
  const totalVis = dias?.reduce((s, d) => s + Number(d.visitas), 0) ?? 0;
  const maiorConv = Math.max(1, ...(origens ?? []).map((o) => Number(o.conversoes)));

  return (
    <>
      <div className="rotulo">Leads</div>
      <h1>De onde vem o lead</h1>
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
      </div>

      {campanha && (
        <p className="nota">
          Filtrado por {campanhas.find((c) => c.id === campanha)?.nome}. Só entram as páginas e formulários
          ligados a esse curso, pela regra automática ou pelo que foi apontado em Pendências.
        </p>
      )}
      <h2><span className="idx" /> Conversões por dia</h2>
      <p className="nota">
        Quanta gente converteu em formulário por dia, com a visita em landing page ao lado. Serve para
        ligar pico de captação a anúncio e a envio de e-mail, e para achar o dia em que a captação parou.
        <Ajuda titulo="Conversão e visita não medem a mesma coisa"
          fontes={["Conversões e visitas: RD Station Marketing",
                   "Período e curso: os filtros no topo da tela",
                   "Quais páginas pertencem a cada curso: as regras apontadas em Marketing, A classificar"]}>
          <b>Conversão</b> conta envio de formulário, não pessoa: quem baixa dois materiais aparece duas
          vezes. <b>Visita em landing page</b> é a linha tracejada e só existe para página hospedada no
          próprio RD, então página feita no site de vocês com formulário embutido do RD aparece com
          conversão e sem visita. Por isso a distância entre as duas linhas não é taxa de conversão
          confiável, e a tabela abaixo é o lugar certo para olhar isso.
        </Ajuda>
      </p>
      {!dias ? <Esqueleto /> : dias.length === 0 ? (
        <p className="mudo">Sem conversões registradas no período.</p>
      ) : (
        <Curva
          rotulos={dias.map((d) => dataCurta(d.dia))}
          series={[
            { nome: "Conversões", cor: COR.tinta, pontos: dias.map((d) => Number(d.conversoes)) },
            { nome: "Visitas em landing page", cor: COR.cinza, tracejada: true, pontos: dias.map((d) => Number(d.visitas)) },
          ]}
        />
      )}

      <h2><span className="idx" /> Páginas e formulários</h2>
      <p className="nota">
        Qual página e qual formulário trouxeram gente no período. É a tabela que diz onde investir
        tráfego e qual material rico ainda funciona.
        <Ajuda titulo="Como ler a taxa de conversão desta tabela"
          fontes={["Páginas, formulários, visitas e conversões: RD Station Marketing",
                   "Quais páginas contam em cada curso: as regras apontadas em Marketing, A classificar"]}>
          A taxa só é confiável nas páginas hospedadas pelo RD, porque é só nelas que ele conta visita.
          Página com taxa acima de 100% ou com visita zerada é página do site de vocês com formulário
          embutido: a conversão dela está certa, a visita não existe. Página sem curso apontado cai em
          <b> A classificar</b>, e enquanto não for apontada ela não entra em meta de captação nenhuma.
        </Ajuda>
      </p>
      {!origens ? <Esqueleto /> : origens.length === 0 ? (
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

      <h2><span className="idx" /> Tags dos leads</h2>
      <p className="nota">
        Quais etiquetas a pessoa já tinha no RD no momento em que converteu. Serve para descobrir
        interesse declarado sem perguntar, e é daqui que vai sair o de para de etiqueta para curso.
        <Ajuda titulo="Por que a contagem começa em outubro"
          fontes={["Tags: RD Station Marketing, pelo webhook de conversão",
                   "A tag guardada é a que a pessoa tinha no momento da conversão, não a de hoje",
                   "O webhook foi ligado em 02/10/2026"]}>
          <b>Pessoas</b> é gente diferente e <b>conversões</b> é envio de formulário, então a mesma pessoa
          com três downloads conta uma vez na primeira coluna e três na segunda. Antes de 02/10/2026 não
          existe tag guardada, então comparar com período anterior a isso não faz sentido.
        </Ajuda>
      </p>
      {!tags ? <Esqueleto /> : tags.length === 0 ? (
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
        </>
      )}

      <h2><span className="idx" /> Origem dos negócios no CRM</h2>
      <p className="nota">
        A mesma pergunta pelo lado do CRM em vez do formulário: de qual fonte nasceram as negociações do
        período. Hoje este bloco serve para medir o tamanho do buraco de preenchimento, não para decidir
        verba: a fonte está em branco na maior parte das negociações.
        <Ajuda titulo="Por que a fonte não sustenta decisão hoje"
          fontes={["Negociações criadas no período: RD Station CRM, pelo campo de fonte",
                   "Os blocos acima vêm do RD Station Marketing, que é outra base"]}>
          Das 10.029 negociações criadas em 2026, <b>87,7% estão sem fonte preenchida</b>, contra 11,7%
          sem campanha. O campo fica em branco quando o lead não entra por um fluxo do RD, e é por isso
          que a linha de sem origem come a tabela. Para ler origem com decisão em cima, use a campanha:
          em <b>Campanha, Da origem à matrícula</b> e no bloco <b>De onde veio quem fechou</b>, em
          Comercial, Time. Formulário gera conversão no Marketing e negociação nasce no CRM, às vezes
          dias depois e às vezes sem formulário nenhum no meio, então as duas bases não precisam bater.
        </Ajuda>
      </p>
      {!fontes ? <Esqueleto /> : fontes.length === 0 ? (
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

      <p className="rodape">
        O RD só conta visita nas páginas hospedadas por ele.
        <Ajuda titulo="Por que a conversão às vezes passa de 100%"
          fontes={["Visitas e conversões: RD Station Marketing"]}>
          Quando a página é feita em HTML no site de vocês e usa um formulário embutido do RD, a conversão é
          contada e a visita não. Por isso a taxa dessas páginas aparece alta demais, ou a visita aparece zerada.
        </Ajuda>
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
