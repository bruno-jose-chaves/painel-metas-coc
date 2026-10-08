"use client";
import { useEffect, useState } from "react";
import Curva, { type Serie } from "@/components/Curva";
import { supabase } from "@/lib/supabase";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, dataCurta } from "@/lib/formato";

type Ano = {
  ano: number; temporada: string; rotulo: string;
  alunos: number; faturamento: number; ticket_medio: number | null;
  desconto_medio: number | null; primeiro: string; ultimo: string;
  alunos_ate_hoje: number; variacao_alunos: number | null; variacao_ticket: number | null;
};
type Ponto = { semana: number; ano: number; acumulado: number };
type Produto = { id: string; nome: string; duas_temporadas: boolean };

// Preto para o ano corrente, cinza para o anterior, cinza claro para os de trás.
const COR = ["#121211", "#76746D", "#A8A59C", "#C9C6BE"];

const variacao = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(Number(v))) return "-";
  const n = Number(v);
  return (n > 0 ? "+" : "") + pct(n);
};

export default function Historico() {
  const { volta, em, minutos } = useAtualizacao();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produto, setProduto] = useState<string | null>(null);
  const [anos, setAnos] = useState<Ano[] | null>(null);
  const [curva, setCurva] = useState<Ponto[] | null>(null);
  const [quantos, setQuantos] = useState(3);
  // O Método ACAFE e o Semi têm duas turmas por ano. Comparar ano cheio contra
  // ano cheio junta as duas e esconde o que está acontecendo em cada uma.
  const [temporada, setTemporada] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("produtos").select("id,nome,duas_temporadas").order("ordem").then(({ data }) => {
      const lista = (data as Produto[]) ?? [];
      setProdutos(lista);
      setProduto((atual) => atual ?? lista[0]?.id ?? null);
    });
  }, [volta]);

  const duas = produtos.find((p) => p.id === produto)?.duas_temporadas ?? false;

  // Ao trocar para um produto de turma única, a escolha de semestre some.
  useEffect(() => { if (!duas) setTemporada(null); else setTemporada((t) => t ?? "2"); }, [duas]);

  useEffect(() => {
    if (!produto) return;
    setAnos(null); setCurva(null);
    const t = duas ? temporada : null;
    supabase.rpc("painel_historico_anos", { p_produto: produto, p_temporada: t })
      .then(({ data }) => setAnos((data as Ano[]) ?? []));
    supabase.rpc("painel_historico_curva", { p_produto: produto, p_anos: quantos, p_temporada: t })
      .then(({ data }) => setCurva((data as Ponto[]) ?? []));
  }, [produto, quantos, temporada, duas, volta]);

  const nomeProduto = produtos.find((p) => p.id === produto)?.nome ?? "";
  const ordenados = [...(anos ?? [])].sort((a, b) => b.ano - a.ano);
  const atual = ordenados[0];
  const anterior = ordenados[1];

  // Monta uma série por ano sobre o eixo de semanas, para as curvas se sobreporem.
  const semanas = Array.from(new Set((curva ?? []).map((p) => p.semana))).sort((a, b) => a - b);
  const anosCurva = Array.from(new Set((curva ?? []).map((p) => p.ano))).sort((a, b) => b - a);
  const series: Serie[] = anosCurva.map((ano, i) => ({
    nome: String(ano),
    cor: COR[Math.min(i, COR.length - 1)],
    tracejada: i > 0,
    pontos: semanas.map((s) => {
      const p = (curva ?? []).find((x) => x.ano === ano && x.semana === s);
      return p ? Number(p.acumulado) : null;
    }),
  }));

  return (
    <>
      <div className="rotulo">Histórico</div>
      <h1>O mesmo curso, ano a ano</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <div className="filtros">
        <div className="atalhos">
          {produtos.map((p) => (
            <button key={p.id} className={produto === p.id ? "ativo" : ""} onClick={() => setProduto(p.id)}>
              {p.nome}
            </button>
          ))}
        </div>
        {duas && (
          <div className="atalhos">
            {[
              { id: "1", nome: "1º semestre" },
              { id: "2", nome: "2º semestre" },
              { id: "", nome: "Os dois" },
            ].map((t) => (
              <button
                key={t.id}
                className={(temporada ?? "") === t.id ? "ativo" : ""}
                onClick={() => setTemporada(t.id || null)}
              >
                {t.nome}
              </button>
            ))}
          </div>
        )}
        <div className="atalhos">
          {[2, 3, 5].map((q) => (
            <button key={q} className={quantos === q ? "ativo" : ""} onClick={() => setQuantos(q)}>
              {q} anos
            </button>
          ))}
        </div>
      </div>

      {atual && (
        <div className="faixa">
          <div>
            <div className="rotulo">{atual.rotulo} até hoje</div>
            <div className="valor num">{num(atual.alunos_ate_hoje)}</div>
            <div className="mudo">alunos</div>
          </div>
          {anterior && (
            <div>
              <div className="rotulo">{anterior.rotulo} na mesma data</div>
              <div className="valor num">{num(anterior.alunos_ate_hoje)}</div>
              <div className={"mudo " + (Number(atual.variacao_alunos ?? 0) >= 0 ? "ok" : "alerta")}>
                {variacao(atual.variacao_alunos)} contra o ano passado
              </div>
            </div>
          )}
          <div>
            <div className="rotulo">Ticket médio {atual.ano}</div>
            <div className="valor num">{atual.ticket_medio == null ? "-" : brl(atual.ticket_medio)}</div>
            <div className="mudo">{variacao(atual.variacao_ticket)} contra o ano passado</div>
          </div>
          <div>
            <div className="rotulo">Desconto médio {atual.ano}</div>
            <div className="valor num">{pct(atual.desconto_medio)}</div>
            <div className="mudo">
              {anterior && anterior.desconto_medio != null ? `${pct(anterior.desconto_medio)} em ${anterior.ano}` : ""}
            </div>
          </div>
        </div>
      )}

      <h2><span className="idx">009</span> Curva acumulada, sobreposta</h2>
      <p className="nota">
        Alinhada pela semana do ano, não pelo dia da campanha, porque a campanha muda de data a cada ano. Lido assim,
        a distância vertical entre as linhas na semana de hoje é exatamente o quanto {nomeProduto}
        {temporada ? ` do ${temporada}º semestre` : ""} está à frente ou atrás do mesmo momento dos anos anteriores.
      </p>
      {!curva ? <p className="rotulo">Carregando</p> : semanas.length === 0 ? (
        <p className="mudo">Sem histórico de venda para este curso.</p>
      ) : (
        <Curva rotulos={semanas.map((s) => "s" + s)} series={series} altura={260} />
      )}

      <h2><span className="idx">010</span> Ano por ano</h2>
      {!anos ? <p className="rotulo">Carregando</p> : anos.length === 0 ? (
        <p className="mudo">Sem histórico para este curso.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Ano</th><th className="n">Alunos no ano</th><th className="n">Até esta data</th>
                <th className="n">Variação</th><th className="n">Faturamento</th>
                <th className="n">Ticket</th><th className="n">Desconto</th><th>Janela de venda</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((a) => (
                <tr key={a.rotulo} className={a.ano === atual?.ano ? "destaque" : undefined}>
                  <td className="num"><b>{a.rotulo}</b></td>
                  <td className="n">{num(a.alunos)}</td>
                  <td className="n"><b>{num(a.alunos_ate_hoje)}</b></td>
                  <td className={"n " + (Number(a.variacao_alunos ?? 0) >= 0 ? "ok" : "alerta")}>
                    {variacao(a.variacao_alunos)}
                  </td>
                  <td className="n">{brl(a.faturamento)}</td>
                  <td className="n">{a.ticket_medio == null ? "-" : brl(a.ticket_medio)}</td>
                  <td className="n">{pct(a.desconto_medio)}</td>
                  <td className="mudo num">{dataCurta(a.primeiro)} a {dataCurta(a.ultimo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="rodape">
        Até esta data compara maçã com maçã: conta só a venda feita até o mesmo dia do ano, nos anos anteriores
        também, e dentro do mesmo semestre quando o curso tem duas turmas: o Método ACAFE do 1º semestre vende de
        janeiro a junho e o do 2º de julho a novembro, então somar os dois esconde o que cada turma está fazendo. A coluna de alunos no ano é o fechamento cheio, que para o ano corrente ainda vai crescer. Ticket e
        desconto de 2021 e 2022 aparecem vazios porque a planilha daquela época não trazia valor de tabela.
      </p>
    </>
  );
}
