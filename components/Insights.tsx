"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";

type Insight = {
  chave: string; tipo: string; publico: string; prioridade: number;
  titulo: string; detalhe: string; numero: string | null;
  pessoa: string | null; link: string | null;
};

const PUBLICO: Record<string, string> = {
  comercial: "Comercial", marketing: "Marketing", diretoria: "Gestão",
};

// O que já foi visto fica no navegador de quem olhou. Não é controle de
// tarefa: é só para o contador parar de piscar a mesma coisa todo dia. Marcar
// como visto não some com o item, porque o problema continua existindo.
const VISTOS = "insights-vistos";

function lerVistos(): string[] {
  try { return JSON.parse(localStorage.getItem(VISTOS) ?? "[]"); } catch { return []; }
}
function salvarVistos(v: string[]) {
  try { localStorage.setItem(VISTOS, JSON.stringify(v.slice(-400))); } catch { /* vazio */ }
}

export default function Insights() {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Insight[] | null>(null);
  const [vistos, setVistos] = useState<string[]>([]);
  const [filtro, setFiltro] = useState<string>("todos");
  const [montado, setMontado] = useState(false);

  useEffect(() => { setVistos(lerVistos()); setMontado(true); }, []);

  useEffect(() => {
    let vivo = true;
    const buscar = () =>
      supabase.rpc("painel_insights").then(({ data }) => {
        if (vivo) setLista((data as Insight[]) ?? []);
      });
    buscar();
    const t = setInterval(buscar, 10 * 60 * 1000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const novos = useMemo(
    () => (lista ?? []).filter((i) => !vistos.includes(i.chave)).length,
    [lista, vistos],
  );

  const mostrados = useMemo(() => {
    const l = (lista ?? []).slice().sort((a, b) =>
      a.prioridade - b.prioridade || a.publico.localeCompare(b.publico));
    return filtro === "todos" ? l : l.filter((i) => i.publico === filtro);
  }, [lista, filtro]);

  const publicos = useMemo(
    () => Array.from(new Set((lista ?? []).map((i) => i.publico))),
    [lista],
  );

  function abrir() {
    setAberto(true);
    const todas = Array.from(new Set([...vistos, ...(lista ?? []).map((i) => i.chave)]));
    setVistos(todas);
    salvarVistos(todas);
  }

  return (
    <>
      <button
        className={"estrela" + (novos > 0 ? " tem" : "")}
        aria-label="Vale olhar hoje"
        title="Vale olhar hoje"
        onClick={() => (aberto ? setAberto(false) : abrir())}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"
            fill={novos > 0 ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        {novos > 0 && <span className="conta num">{novos}</span>}
      </button>

      {/* A gaveta sai do cabeçalho e vai para o corpo da página. Dentro do
          cabeçalho ela não funciona: o backdrop-filter do topo cria um bloco de
          contenção e a posição fixa passa a valer dentro da faixa do menu, que
          tem 58 pixels de altura. */}
      {aberto && montado && createPortal(
        <>
          <div className="cortina" onClick={() => setAberto(false)} />
          <aside className="gaveta" role="dialog" aria-label="Vale olhar hoje">
            <div className="gaveta-topo">
              <div>
                <div className="rotulo">Vale olhar hoje</div>
                <h3 style={{ margin: "4px 0 0", fontSize: 19, fontWeight: 750, letterSpacing: "-.02em" }}>
                  {lista == null ? "Procurando" : lista.length === 0 ? "Nada aberto" : `${lista.length} para olhar`}
                </h3>
              </div>
              <button className="btn claro" onClick={() => setAberto(false)}>Fechar</button>
            </div>

            {publicos.length > 1 && (
              <div className="atalhos" style={{ margin: "0 20px 14px" }}>
                <button className={filtro === "todos" ? "ativo" : ""} onClick={() => setFiltro("todos")}>
                  Tudo
                </button>
                {publicos.map((p) => (
                  <button key={p} className={filtro === p ? "ativo" : ""} onClick={() => setFiltro(p)}>
                    {PUBLICO[p] ?? p}
                  </button>
                ))}
              </div>
            )}

            <div className="gaveta-corpo">
              {lista == null ? (
                <p className="rotulo" style={{ padding: "0 20px" }}>Carregando</p>
              ) : mostrados.length === 0 ? (
                <p className="mudo" style={{ padding: "0 20px" }}>
                  Nenhum ponto aberto agora. Esta lista olha conversa sem resposta, lead que voltou a falar,
                  virada de preço, ritmo de campanha, upsell na mesa e furo de dado. Quando um desses acontece,
                  aparece aqui sozinho.
                </p>
              ) : (
                mostrados.map((i) => (
                  <article key={i.chave} className={"insight p" + i.prioridade}>
                    <div className="insight-topo">
                      <span className="rotulo">{PUBLICO[i.publico] ?? i.publico}</span>
                      {i.numero && <span className="selo">{i.numero}</span>}
                    </div>
                    <b>{i.titulo}</b>
                    <p className="mudo">{i.detalhe}</p>
                    <div className="insight-pe">
                      {i.pessoa && <span className="quem">{i.pessoa}</span>}
                      {i.link && <a href={i.link} onClick={() => setAberto(false)}>abrir a tela</a>}
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>
        </>,
        document.body,
      )}
    </>
  );
}
