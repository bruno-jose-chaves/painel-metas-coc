"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct } from "@/lib/formato";

type Turma = {
  id: string; produto_id: string; produto: string; ano: number; semestre: number | null;
  nome: string; venda_de: string; venda_ate: string; alunos: number; faturamento: number;
};
type Resultado = {
  recorte: string; base_nomes: string[]; alvo_nomes: string[];
  pessoas_base: number; pessoas_alvo: number; cruzaram: number;
  taxa: number | null; faturamento_alvo: number; ticket_alvo: number | null; dias_medio: number | null;
};

// Seletor de turmas em coluna, agrupado por ano. Marcar e desmarcar, sem menu
// suspenso, porque quase sempre se escolhe mais de uma.
function Escolha({
  titulo, explicacao, turmas, escolhidas, aoMudar,
}: {
  titulo: string; explicacao: string; turmas: Turma[];
  escolhidas: string[]; aoMudar: (ids: string[]) => void;
}) {
  const anos = useMemo(() => Array.from(new Set(turmas.map((t) => t.ano))).sort((a, b) => b - a), [turmas]);
  const alternar = (id: string) =>
    aoMudar(escolhidas.includes(id) ? escolhidas.filter((x) => x !== id) : [...escolhidas, id]);

  return (
    <div className="bloco" style={{ marginBottom: 0 }}>
      <div className="rotulo">{titulo}</div>
      <p className="nota">{explicacao}</p>
      <div style={{ display: "grid", gap: 14, maxHeight: 360, overflowY: "auto" }}>
        {anos.map((ano) => (
          <div key={ano}>
            <div className="rotulo" style={{ marginBottom: 6 }}>{ano}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {turmas.filter((t) => t.ano === ano).map((t) => (
                <button
                  key={t.id}
                  className={"btn " + (escolhidas.includes(t.id) ? "" : "claro")}
                  style={{ fontSize: 12.5, padding: "7px 11px" }}
                  onClick={() => alternar(t.id)}
                  title={`${num(t.alunos)} alunos`}
                >
                  {t.nome}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {escolhidas.length > 0 && (
        <button className="btn claro" style={{ marginTop: 12 }} onClick={() => aoMudar([])}>
          Limpar
        </button>
      )}
    </div>
  );
}

export default function Upsell() {
  const { volta, em, minutos } = useAtualizacao();
  const [turmas, setTurmas] = useState<Turma[] | null>(null);
  const [base, setBase] = useState<string[]>([]);
  const [alvo, setAlvo] = useState<string[]>([]);
  const [res, setRes] = useState<Resultado[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    supabase.rpc("painel_turmas", { p_so_com_venda: true })
      .then(({ data }) => setTurmas((data as Turma[]) ?? []));
  }, [volta]);

  useEffect(() => {
    if (base.length === 0 || alvo.length === 0) { setRes(null); return; }
    setBuscando(true);
    supabase.rpc("painel_upsell_modular", { p_base: base, p_alvo: alvo, p_ano_anterior: true })
      .then(({ data }) => { setRes((data as Resultado[]) ?? []); setBuscando(false); });
  }, [base, alvo, volta]);

  const atual = res?.find((r) => r.recorte === "atual");
  const anterior = res?.find((r) => r.recorte === "ano anterior");
  // Diferença em pontos percentuais, não em porcentagem da porcentagem. De
  // 13,6% para 9,0% a leitura certa é "caiu 4,6 pontos", e não "caiu 33,7%",
  // que é verdade aritmética e mentira prática: ninguém lê taxa de upsell
  // assim, e o número grande assusta à toa.
  const pontos = atual?.taxa != null && anterior?.taxa != null
    ? Number(atual.taxa) - Number(anterior.taxa)
    : null;

  return (
    <>
      <div className="rotulo">Upsell</div>
      <h1>Quem comprou um, comprou o outro?</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <p className="nota">
        Escolha de um lado a base de comparação, que é o grupo de alunos que você quer olhar, e do outro o curso que
        quer saber se eles compraram também. Pode marcar mais de uma turma em cada lado. O painel cruza por e-mail,
        telefone e nome, e traz junto o mesmo recorte do ano anterior, com as turmas equivalentes, para você ver se
        melhorou ou piorou.
      </p>

      {!turmas ? <p className="rotulo">Carregando</p> : (
        <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
          <Escolha
            titulo="Base de comparação"
            explicacao="Quem já é aluno destas turmas."
            turmas={turmas}
            escolhidas={base}
            aoMudar={setBase}
          />
          <Escolha
            titulo="Curso de destino"
            explicacao="O que queremos saber se eles compraram também."
            turmas={turmas}
            escolhidas={alvo}
            aoMudar={setAlvo}
          />
        </div>
      )}

      {base.length === 0 || alvo.length === 0 ? (
        <p className="rodape">
          Marque pelo menos uma turma de cada lado para ver o resultado.
        </p>
      ) : buscando || !atual ? (
        <p className="rotulo" style={{ marginTop: 24 }}>Calculando</p>
      ) : (
        <>
          <h2><span className="idx">038</span> Resultado</h2>
          <div className="faixa">
            <div>
              <div className="rotulo">Alunos na base</div>
              <div className="valor num">{num(atual.pessoas_base)}</div>
              <div className="mudo">pessoas distintas</div>
            </div>
            <div>
              <div className="rotulo">Compraram também</div>
              <div className="valor num">{num(atual.cruzaram)}</div>
              <div className="mudo">de {num(atual.pessoas_alvo)} no curso de destino</div>
            </div>
            <div>
              <div className="rotulo">Taxa de upsell</div>
              <div className="valor num">{pct(atual.taxa)}</div>
              {pontos != null && (
                <div className={"mudo num " + (pontos >= 0 ? "ok" : "alerta")}>
                  {(pontos > 0 ? "+" : "") + pct(pontos)
                    .replace("%", " ponto" + (Math.abs(pontos * 100) === 1 ? "" : "s"))}
                  {" contra "}{pct(anterior!.taxa)}{" no ano anterior"}
                </div>
              )}
            </div>
            <div>
              <div className="rotulo">Faturamento vindo da base</div>
              <div className="valor num">{brl(atual.faturamento_alvo)}</div>
              <div className="mudo num">
                {atual.ticket_alvo ? `ticket ${brl(atual.ticket_alvo)}` : ""}
              </div>
            </div>
            <div>
              <div className="rotulo">Tempo até a segunda compra</div>
              <div className="valor num">{atual.dias_medio == null ? "-" : num(atual.dias_medio)}</div>
              <div className="mudo">dias, em média</div>
            </div>
          </div>

          <h2><span className="idx">039</span> Contra o ano anterior</h2>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Recorte</th><th>Base</th><th>Destino</th>
                  <th className="n">Base</th><th className="n">Cruzaram</th>
                  <th className="n">Taxa</th><th className="n">Faturamento</th><th className="n">Dias</th>
                </tr>
              </thead>
              <tbody>
                {res!.map((r) => (
                  <tr key={r.recorte} className={r.recorte === "atual" ? "destaque" : undefined}>
                    <td><b>{r.recorte === "atual" ? "Agora" : "Ano anterior"}</b></td>
                    <td className="mudo" style={{ maxWidth: 220 }}>{(r.base_nomes ?? []).join(", ")}</td>
                    <td className="mudo" style={{ maxWidth: 220 }}>{(r.alvo_nomes ?? []).join(", ")}</td>
                    <td className="n">{num(r.pessoas_base)}</td>
                    <td className="n"><b>{num(r.cruzaram)}</b></td>
                    <td className="n">{pct(r.taxa)}</td>
                    <td className="n">{brl(r.faturamento_alvo)}</td>
                    <td className="n">{r.dias_medio == null ? "-" : num(r.dias_medio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rodape">
            A turma equivalente do ano anterior é a mesma do mesmo produto e semestre, um ano atrás. Se a turma
            anterior ainda estava vendendo quando o recorte foi feito, o número dela ainda vai crescer, então a
            comparação fica conservadora. O cruzamento é por pessoa, não por matrícula: quem comprou o destino duas
            vezes conta uma.
          </p>
        </>
      )}
    </>
  );
}
