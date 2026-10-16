"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import SeletorPeriodo from "@/components/Periodo";
import { ultimosDias, type Periodo } from "@/lib/periodo";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, pct, dataHora } from "@/lib/formato";

// O funil do WhatsApp, lido pelas etiquetas do Pigeon.
//
// O time já marcava tudo: em que etapa o contato está, de que curso é o
// interesse e de quem é o lead. Isso chegava no painel desde 05/10 dentro do
// corpo do webhook e nada lia, porque o telefone não estava sendo extraído
// desse tipo de evento.
//
// Etiqueta é estado, não evento: vale a última marcação de cada telefone.

type Etapa = {
  etapa: string; ordem: number; pessoas: number; matriculas: number;
  por_curso: Record<string, number>; por_vendedor: Record<string, number>;
};
type Etiqueta = {
  etiqueta: string; etiqueta_norm: string; tipo: string | null; valor: string | null;
  pessoas: number; ultima: string;
};

const TIPO: Record<string, string> = {
  etapa: "etapa do funil", curso: "curso", vendedor: "dono do lead", ignorar: "ignorada",
};

export default function FunilWhats() {
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(() => ultimosDias(30));
  const [funil, setFunil] = useState<Etapa[] | null>(null);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[] | null>(null);

  useEffect(() => {
    setFunil(null);
    supabase.rpc("painel_funil_whats", { p_de: periodo.de, p_ate: periodo.ate })
      .then(({ data }) => setFunil((data as Etapa[]) ?? []));
    supabase.rpc("painel_etiquetas_whats", { p_desde: periodo.de })
      .then(({ data }) => setEtiquetas((data as Etiqueta[]) ?? []));
  }, [periodo, volta]);

  const marcadas = useMemo(() => (funil ?? []).filter((e) => e.ordem > 0), [funil]);
  const semEtapa = useMemo(() => (funil ?? []).find((e) => e.ordem === 0), [funil]);
  const maior = Math.max(1, ...marcadas.map((e) => Number(e.pessoas)));
  const semSignificado = (etiquetas ?? []).filter((e) => !e.tipo);

  return (
    <>
      <div className="rotulo">Funil do WhatsApp</div>
      <h1>Onde cada contato parou</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <p className="nota">
        A etapa vem da etiqueta que o time coloca no contato dentro do Pigeon.
        <Ajuda titulo="Como esta tela é montada"
          fontes={["Etiquetas do contato: webhook do Pigeon (tabela conversas_eventos, evento CONTACT_TAG_UPDATE)",
                   "Significado de cada etiqueta: tabela etiquetas_whats",
                   "Virou matrícula: planilha comercial (tabela vendas), cruzando por telefone",
                   "Medição começa em 05/10/2026, quando o webhook entrou no ar"]}>
          Cada contato carrega três etiquetas ao mesmo tempo: a etapa, o curso de interesse e o dono do
          lead. Etiqueta é estado, não evento, então vale a última marcação de cada telefone dentro do
          período. <b>Virou matrícula</b> não vem da etiqueta: vem da planilha comercial, cruzando pelo
          telefone, que é a fonte firme da venda.
        </Ajuda>
      </p>

      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />

      {!funil ? <p className="rotulo">Carregando</p> : funil.length === 0 ? (
        <p className="mudo">Nenhuma etiqueta no período.</p>
      ) : (
        <>
          <h2><span className="idx">070</span> O funil</h2>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th style={{ minWidth: 150 }}>Tamanho</th>
                  <th className="n">Pessoas</th>
                  <th className="n">Viraram matrícula</th>
                  <th className="n">Conversão</th>
                  <th>Cursos</th>
                  <th>Dono do lead</th>
                </tr>
              </thead>
              <tbody>
                {marcadas.map((e) => (
                  <tr key={e.etapa}>
                    <td><b>{e.etapa}</b></td>
                    <td>
                      <div className="mini"><i style={{ width: `${(Number(e.pessoas) / maior) * 100}%` }} /></div>
                    </td>
                    <td className="n"><b>{num(e.pessoas)}</b></td>
                    <td className="n">{num(e.matriculas)}</td>
                    <td className="n">{e.pessoas ? pct(Number(e.matriculas) / Number(e.pessoas)) : "-"}</td>
                    <td className="mudo" style={{ maxWidth: 260 }}>
                      {Object.entries(e.por_curso ?? {}).sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => `${k} ${v}`).join(" · ")}
                    </td>
                    <td className="mudo" style={{ maxWidth: 170 }}>
                      {Object.entries(e.por_vendedor ?? {}).sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => `${k} ${v}`).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {semEtapa && (
            <>
              <h2><span className="idx">071</span> Contato sem etapa marcada</h2>
              <p className="nota">
                Quem tem etiqueta de curso ou de dono, mas nenhuma etiqueta de etapa. Não é erro do
                painel: é contato que o time não marcou.
              </p>
              <div className="faixa">
                <div>
                  <div className="rotulo">Pessoas</div>
                  <div className="valor num">{num(semEtapa.pessoas)}</div>
                  <div className="mudo">sem etapa no período</div>
                </div>
                <div>
                  <div className="rotulo">Viraram matrícula</div>
                  <div className="valor num">{num(semEtapa.matriculas)}</div>
                  <div className="mudo num">
                    {semEtapa.pessoas ? pct(Number(semEtapa.matriculas) / Number(semEtapa.pessoas)) + " do grupo" : ""}
                  </div>
                </div>
                <div>
                  <div className="rotulo">Por dono</div>
                  <div className="valor num" style={{ fontSize: 16 }}>
                    {Object.entries(semEtapa.por_vendedor ?? {}).sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => `${k} ${v}`).join(" · ") || "-"}
                  </div>
                  <div className="mudo">quem concentra o não marcado</div>
                </div>
              </div>
            </>
          )}

          <h2><span className="idx">072</span> Etiquetas em uso</h2>
          <p className="nota">
            Toda etiqueta que apareceu no período e o significado apontado para ela.
            <Ajuda titulo="Etiqueta sem significado">
              Etiqueta que o painel não conhece não entra em conta nenhuma: a pessoa some do funil e
              aparece em &quot;sem etapa marcada&quot;. Quando aparecer uma etiqueta nova aqui, me avise
              que eu aponto o significado dela.
            </Ajuda>
          </p>
          {semSignificado.length > 0 && (
            <p className="aviso-leve ruim">
              {semSignificado.length} etiqueta{semSignificado.length > 1 ? "s" : ""} sem significado
              apontado: {semSignificado.map((e) => e.etiqueta).join(", ")}.
            </p>
          )}
          {!etiquetas ? <p className="rotulo">Carregando</p> : (
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Etiqueta</th>
                    <th>Significa</th>
                    <th>Aponta para</th>
                    <th className="n">Pessoas</th>
                    <th>Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {etiquetas.map((e) => (
                    <tr key={e.etiqueta_norm} className={!e.tipo ? "fora" : undefined}>
                      <td><b>{e.etiqueta}</b></td>
                      <td>
                        {e.tipo
                          ? <span className="selo no_ritmo">{TIPO[e.tipo] ?? e.tipo}</span>
                          : <span className="selo atras">sem significado</span>}
                      </td>
                      <td className="mudo">{e.valor ?? "-"}</td>
                      <td className="n">{num(e.pessoas)}</td>
                      <td className="mudo num">{dataHora(e.ultima)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="rodape">
            A medição começa em 05/10/2026, quando o webhook do Pigeon entrou no ar. Antes disso não há
            etiqueta guardada, e o período maior que isso não traz mais gente.
          </p>
        </>
      )}
    </>
  );
}
