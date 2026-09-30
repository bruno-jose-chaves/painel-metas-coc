"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { brl, num, pct, dataCurta, dataHora } from "@/lib/formato";

type Resumo = {
  id: string; nome: string; inicio: string; fim: string; meta_ativa: number;
  meta_alunos: number; meta_faturamento: number; alunos: number; faturamento: number; cancelados: number;
  alunos_hoje: number; faturamento_hoje: number; ticket_medio: number | null; ticket_alvo: number | null;
  desconto_medio: number | null; meta_alunos_hoje: number; fase_atual: string | null; preco_atual: number | null;
  fase_fim: string | null; dias_restantes: number; situacao: string; market_share: number | null;
  referencia_ano_anterior: { alunos: number; ticket: number; market_share: number } | null;
};

const SITUACAO: Record<string, string> = {
  no_ritmo: "No ritmo", atencao: "Atenção", atras: "Atrás", nao_iniciada: "Não iniciada", encerrada: "Encerrada",
};

function Visao() {
  const [dados, setDados] = useState<Resumo[] | null>(null);
  const [sync, setSync] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("resumo_campanhas").select("*").order("inicio").then(({ data }) => setDados((data as Resumo[]) ?? []));
    supabase.from("sincronizacoes").select("terminado_em").eq("status", "ok").like("fonte", "planilha:%")
      .order("terminado_em", { ascending: false }).limit(1).then(({ data }) => setSync(data?.[0]?.terminado_em ?? null));
  }, []);

  if (!dados) return <p className="rotulo">Carregando</p>;
  const hojeAlunos = dados.reduce((s, c) => s + Number(c.alunos_hoje), 0);
  const hojeFat = dados.reduce((s, c) => s + Number(c.faturamento_hoje), 0);

  return (
    <>
      <div className="rotulo">001 · Visão geral</div>
      <h1>Como estamos hoje</h1>

      <div className="faixa">
        <div><div className="rotulo">Matrículas hoje</div><div className="valor num">{num(hojeAlunos)}</div></div>
        <div><div className="rotulo">Faturamento hoje</div><div className="valor num">{brl(hojeFat)}</div></div>
        <div><div className="rotulo">Leads hoje</div><div className="valor num">-</div><div className="mudo">aguardando RD</div></div>
        <div><div className="rotulo">Última atualização</div><div className="valor num" style={{ fontSize: 20 }}>{dataHora(sync)}</div></div>
      </div>

      <h2><span className="idx">002</span> Campanhas ativas</h2>
      <div className="cards">
        {dados.map((c) => {
          const ating = c.meta_alunos ? c.alunos / c.meta_alunos : 0;
          const esperado = c.meta_alunos ? c.meta_alunos_hoje / c.meta_alunos : 0;
          return (
            <article className="card" key={c.id}>
              <div className="card-top">
                <div>
                  <div className="rotulo">{dataCurta(c.inicio)} a {dataCurta(c.fim)} · Meta {c.meta_ativa}</div>
                  <h3>{c.nome}</h3>
                </div>
                <span className={"selo " + c.situacao}>{SITUACAO[c.situacao] ?? c.situacao}</span>
              </div>

              <div className="grande num">{num(c.alunos)} <small>/ {num(c.meta_alunos)} alunos</small></div>
              <div className="barra" aria-label="Progresso da meta">
                <i style={{ width: `${Math.min(ating, 1) * 100}%` }} />
                <b style={{ left: `${Math.min(esperado, 1) * 100}%` }} title="Meta esperada para hoje" />
              </div>
              <div className="legenda num"><span>{pct(ating)} da meta</span><span>esperado hoje: {num(c.meta_alunos_hoje)}</span></div>

              <div className="grade">
                <div><div className="rotulo">Faturamento</div><div className="v num">{brl(c.faturamento)}</div><div className="mudo num">de {brl(c.meta_faturamento)}</div></div>
                <div><div className="rotulo">Ticket médio</div><div className="v num">{brl(c.ticket_medio)}</div><div className="mudo num">alvo {brl(c.ticket_alvo)}</div></div>
                <div><div className="rotulo">Fase atual</div><div className="v">{c.fase_atual ?? "-"}</div><div className="mudo num">{c.preco_atual ? brl(c.preco_atual, 2) + " até " + dataCurta(c.fase_fim) : ""}</div></div>
                <div><div className="rotulo">Dias restantes</div><div className="v num">{num(c.dias_restantes)}</div><div className="mudo num">share {pct(c.market_share, 2)}</div></div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mudo" style={{ marginTop: 24 }}>Barra preta: realizado. Traço vermelho: onde a meta ativa espera que a campanha esteja hoje.</p>
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Visao />}</Shell>;
}
