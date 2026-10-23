"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Curva from "@/components/Curva";
import Ajuda from "@/components/Ajuda";
import Detalhe, { type Recorte } from "@/components/Detalhe";
import { COR } from "@/lib/cores";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, dataCurta } from "@/lib/formato";

// Turma contra turma.
//
// O histórico entre anos responde "como foi 2025 contra 2024". Esta tela
// responde outra pergunta, que é a que aparece na virada de turma: "esta turma
// está indo melhor ou pior do que aquela, no mesmo ponto da vida dela".
//
// Por isso o eixo não é a data: é o dia da turma. O dia 1 de uma encosta no dia
// 1 da outra. Sem isso, Método/1 e Método/2, que abrem em meses diferentes,
// nunca ficam lado a lado, e a leitura por data só mostra o calendário.

type Turma = {
  id: string; produto_id: string; produto: string; ano: number; semestre: number | null;
  nome: string; venda_de: string; venda_ate: string; alunos: number; faturamento: number;
};
type Ponto = {
  d: number; dia_a: string | null; alunos_a: number | null; acum_a: number | null;
  dia_b: string | null; alunos_b: number | null; acum_b: number | null;
};
type Resumo = {
  turma_id: string; nome: string; lado: "a" | "b"; alunos: number; faturamento: number;
  ticket: number | null; desconto: number | null; venda_de: string; venda_ate: string;
  dias_corridos: number; em_curso: boolean; melhor_dia: string | null; melhor_dia_n: number;
};

// A turma equivalente do ano anterior: mesmo produto, mesmo semestre, um ano
// atrás. É o padrão porque é a comparação que quase sempre se quer, e é a única
// que não depende de a pessoa saber qual turma escolher.
function equivalente(t: Turma, todas: Turma[]) {
  return todas.find((x) => x.produto_id === t.produto_id && x.ano === t.ano - 1
    && (x.semestre ?? 0) === (t.semestre ?? 0));
}

const variacao = (a: number | null | undefined, b: number | null | undefined) => {
  if (a == null || b == null || Number(b) === 0) return null;
  return Number(a) / Number(b) - 1;
};

function Delta({ v, casas = 1 }: { v: number | null; casas?: number }) {
  if (v == null) return <span className="mudo">-</span>;
  return (
    <span className={"num " + (v >= 0 ? "ok" : "alerta")}>
      {(v > 0 ? "+" : "") + pct(v, casas)}
    </span>
  );
}

export default function Comparar() {
  const { volta, em, minutos } = useAtualizacao();
  const [turmas, setTurmas] = useState<Turma[] | null>(null);
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [curva, setCurva] = useState<Ponto[] | null>(null);
  const [resumo, setResumo] = useState<Resumo[] | null>(null);
  const [detalhe, setDetalhe] = useState<{ titulo: string; recorte: Recorte } | null>(null);

  useEffect(() => {
    supabase.rpc("painel_turmas", { p_so_com_venda: true }).then(({ data }) => {
      const lista = (data as Turma[]) ?? [];
      setTurmas(lista);
      if (lista.length === 0) return;
      setA((atual) => {
        if (atual) return atual;
        // Abre na turma mais recente que já vendeu, contra a equivalente do ano
        // anterior. Quem quiser outro par troca nos dois campos.
        const nova = lista[0];
        const par = equivalente(nova, lista);
        setB((x) => x || par?.id || lista[1]?.id || "");
        return nova.id;
      });
    });
  }, [volta]);

  useEffect(() => {
    if (!a || !b || a === b) { setCurva(null); setResumo(null); return; }
    supabase.rpc("painel_comparar_turmas", { p_a: a, p_b: b })
      .then(({ data }) => setCurva((data as Ponto[]) ?? []));
    supabase.rpc("painel_comparar_turmas_resumo", { p_a: a, p_b: b })
      .then(({ data }) => setResumo((data as Resumo[]) ?? []));
  }, [a, b, volta]);

  const ta = turmas?.find((t) => t.id === a);
  const tb = turmas?.find((t) => t.id === b);
  const ra = resumo?.find((r) => r.lado === "a");
  const rb = resumo?.find((r) => r.lado === "b");

  // O ponto da curva em que as duas ainda são comparáveis: o último dia que a
  // turma A já viveu. Comparar o total de uma turma em curso com o total de uma
  // turma fechada é a armadilha óbvia desta tela, então o número que fica em
  // destaque é sempre no mesmo ponto.
  const mesmoPonto = useMemo(() => {
    if (!curva || !ra) return null;
    const p = curva.filter((x) => x.acum_a != null).slice(-1)[0];
    if (!p) return null;
    const antes = curva.find((x) => x.d === p.d);
    return { d: p.d, a: Number(p.acum_a ?? 0), b: antes?.acum_b == null ? null : Number(antes.acum_b) };
  }, [curva, ra]);

  // Semestres diferentes têm forma de venda diferente, e sobrepor os dois dá
  // uma leitura que parece dramática e não quer dizer nada. Avisa em vez de
  // impedir: às vezes é exatamente isso que se quer olhar.
  const semestresDiferentes = !!ta && !!tb && ta.produto_id === tb.produto_id
    && (ta.semestre ?? 0) !== (tb.semestre ?? 0);
  const produtosDiferentes = !!ta && !!tb && ta.produto_id !== tb.produto_id;

  const series = curva ? [
    { nome: ta?.nome ?? "Turma A", cor: COR.tinta, pontos: curva.map((p) => p.acum_a) },
    { nome: tb?.nome ?? "Turma B", cor: COR.cinza, tracejada: true, pontos: curva.map((p) => p.acum_b) },
  ] : [];

  const porProduto = useMemo(() => {
    const m = new Map<string, Turma[]>();
    for (const t of turmas ?? []) {
      if (!m.has(t.produto)) m.set(t.produto, []);
      m.get(t.produto)!.push(t);
    }
    return [...m.entries()];
  }, [turmas]);

  return (
    <>
      <div className="rotulo">Turma contra turma</div>
      <h1>Esta turma está indo melhor que a outra?</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <p className="nota">
        As duas curvas são alinhadas pelo dia da turma, não pela data do calendário.
        <Ajuda titulo="Por que o eixo é o dia da turma"
          fontes={["Planilha comercial, pela turma de cada venda",
                   "Turma = produto + ano + semestre, com janela de venda própria",
                   "Cancelada não entra",
                   "A turma em curso para no dia de hoje, não cai para zero no resto do eixo"]}>
          Turmas abrem em meses diferentes. Se o eixo fosse a data, o Método/1 e o Método/2 nunca
          ficariam lado a lado e a comparação só mostraria o calendário. Alinhando pelo dia 1 de cada
          turma, o que aparece é o ritmo de venda de cada uma no mesmo ponto da vida dela.
        </Ajuda>
      </p>

      {!turmas ? <p className="rotulo">Carregando</p> : (
        <div className="escolha-par">
          <label>
            <span className="rotulo">Esta turma</span>
            <select value={a} onChange={(e) => {
              const nova = e.target.value;
              setA(nova);
              const t = turmas.find((x) => x.id === nova);
              const par = t && equivalente(t, turmas);
              if (par) setB(par.id);
            }}>
              {porProduto.map(([p, lista]) => (
                <optgroup key={p} label={p}>
                  {lista.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span className="rotulo">Contra esta</span>
            <select value={b} onChange={(e) => setB(e.target.value)}>
              {porProduto.map(([p, lista]) => (
                <optgroup key={p} label={p}>
                  {lista.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      )}

      {(semestresDiferentes || produtosDiferentes) && (
        <p className="aviso-leve">
          {produtosDiferentes
            ? "São cursos diferentes, com preço e duração diferentes. A curva serve para ver forma de venda, não para cobrar meta de um pelo outro."
            : "São semestres diferentes do mesmo curso, e eles vendem em ritmos diferentes. A sobreposição mostra o formato, não quem está melhor."}
        </p>
      )}

      {a === b ? (
        <p className="rodape">Escolha duas turmas diferentes.</p>
      ) : !curva || !resumo || !ra || !rb ? (
        <p className="rotulo" style={{ marginTop: 24 }}>Calculando</p>
      ) : (
        <>
          <h2><span className="idx" /> No mesmo ponto da turma</h2>
          <p className="nota">
            {ra.em_curso
              ? <>{ra.nome} está no dia {num(mesmoPonto?.d ?? 0)} de venda. O número ao lado é onde {rb.nome} estava no dia de mesmo número.</>
              : <>As duas turmas já fecharam, então a comparação é do total de cada uma.</>}
            <Ajuda titulo="Por que não comparar os dois totais"
              fontes={["Acumulado de cada turma no mesmo dia de vida (painel_comparar_turmas)",
                       "Totais fechados e ticket (painel_comparar_turmas_resumo)"]}>
              Uma turma em curso sempre perde do total de uma turma fechada, e isso não diz nada. O
              destaque desta tela é sempre o mesmo ponto das duas: quantos alunos cada uma tinha com o
              mesmo tempo de venda. O total fechado fica logo abaixo, para quando a pergunta for outra.
            </Ajuda>
          </p>
          <div className="faixa">
            <div>
              <div className="rotulo">{ra.nome}</div>
              <div className="valor num">{num(mesmoPonto?.a ?? ra.alunos)}</div>
              <div className="mudo">alunos{ra.em_curso ? ", até hoje" : ", no fim"}</div>
            </div>
            <div>
              <div className="rotulo">{rb.nome}, no mesmo dia</div>
              <div className="valor num">{mesmoPonto?.b == null ? "-" : num(mesmoPonto.b)}</div>
              <div className="mudo num">
                {mesmoPonto?.b != null && mesmoPonto.b > 0 ? (
                  <>de {num(rb.alunos)} no fim</>
                ) : "sem venda nesse ponto"}
              </div>
            </div>
            <div>
              <div className="rotulo">Diferença no mesmo ponto</div>
              <div className="valor num">
                <Delta v={variacao(mesmoPonto?.a, mesmoPonto?.b)} />
              </div>
              <div className="mudo">
                {mesmoPonto?.b != null
                  ? `${mesmoPonto.a - mesmoPonto.b > 0 ? "+" : ""}${num(mesmoPonto.a - mesmoPonto.b)} alunos`
                  : "sem base para comparar"}
              </div>
            </div>
            <div>
              <div className="rotulo">Ticket</div>
              <div className="valor num">{brl(ra.ticket)}</div>
              <div className="mudo num">
                <Delta v={variacao(ra.ticket, rb.ticket)} /> contra {brl(rb.ticket)}
              </div>
            </div>
            <div>
              <div className="rotulo">Desconto médio</div>
              <div className="valor num">{pct(ra.desconto)}</div>
              <div className="mudo num">contra {pct(rb.desconto)} na outra</div>
            </div>
          </div>

          <h2><span className="idx" /> As duas curvas</h2>
          <Curva
            rotulos={curva.map((p) => "dia " + p.d)}
            series={series}
            altura={260}
            aoClicar={(i) => {
              const p = curva[i];
              if (!p?.dia_a) return;
              setDetalhe({
                titulo: `${ra.nome} em ${dataCurta(p.dia_a)}`,
                recorte: { p_de: p.dia_a, p_ate: p.dia_a, p_turma: ra.turma_id },
              });
            }}
          />

          <h2><span className="idx" /> As duas por inteiro</h2>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Turma</th><th>Janela de venda</th>
                  <th className="n">Alunos</th><th className="n">Faturamento</th>
                  <th className="n">Ticket</th><th className="n">Desconto</th>
                  <th className="n">Melhor dia</th><th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {[ra, rb].map((r) => (
                  <tr key={r.turma_id} className={r.lado === "a" ? "destaque abre" : "abre"}
                      onClick={() => setDetalhe({
                        titulo: r.nome,
                        recorte: { p_de: r.venda_de, p_ate: r.venda_ate, p_turma: r.turma_id },
                      })}>
                    <td><b>{r.nome}</b></td>
                    <td className="mudo num">{dataCurta(r.venda_de)} a {dataCurta(r.venda_ate)}</td>
                    <td className="n"><b>{num(r.alunos)}</b></td>
                    <td className="n">{brl(r.faturamento)}</td>
                    <td className="n">{brl(r.ticket)}</td>
                    <td className="n">{pct(r.desconto)}</td>
                    <td className="n">{dataCurta(r.melhor_dia)} · {num(r.melhor_dia_n)}</td>
                    <td>
                      <span className={"selo " + (r.em_curso ? "atencao" : "no_ritmo")}>
                        {r.em_curso ? "Em curso" : "Fechada"}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}><b>Diferença</b></td>
                  <td className="n"><Delta v={variacao(ra.alunos, rb.alunos)} /></td>
                  <td className="n"><Delta v={variacao(ra.faturamento, rb.faturamento)} /></td>
                  <td className="n"><Delta v={variacao(ra.ticket, rb.ticket)} /></td>
                  <td className="n"><Delta v={variacao(ra.desconto, rb.desconto)} /></td>
                  <td className="n mudo">-</td>
                  <td className="mudo">{ra.em_curso ? "turma em curso" : ""}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="rodape">
            Clique em qualquer linha, ou em um ponto do gráfico, para ver as matrículas.
          </p>
        </>
      )}

      {detalhe && (
        <Detalhe titulo={detalhe.titulo} recorte={detalhe.recorte} aoFechar={() => setDetalhe(null)} />
      )}
    </>
  );
}
