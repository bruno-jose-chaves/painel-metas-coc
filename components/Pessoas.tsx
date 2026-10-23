"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { num, dataCurta } from "@/lib/formato";

// Gaveta de gente.
//
// Número agregado que não responde "quem?" obriga a confiar ou a sair caçando
// na mão. Esta gaveta recebe o mesmo recorte que gerou o número, lista as
// pessoas e, quando existe conversa no Pigeon, abre a conversa em um clique.
export type Pessoa = {
  pessoa: string; telefone: string | null; email?: string | null;
  quando: string; conversas?: number; atendente?: string | null;
  primeira_mensagem?: string | null; onde?: string | null;
  virou_matricula: boolean; curso?: string | null; link: string | null;
};

export default function Pessoas({
  titulo, rotulo, rpc, params, aoFechar,
}: {
  titulo: string;
  rotulo: string;
  rpc: string;
  params: Record<string, unknown>;
  aoFechar: () => void;
}) {
  const [lista, setLista] = useState<Pessoa[] | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    setLista(null);
    supabase.rpc(rpc, params).then(({ data }) => setLista((data as Pessoa[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpc, JSON.stringify(params)]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  if (!montado) return null;

  const compraram = lista?.filter((p) => p.virou_matricula).length ?? 0;
  const comConversa = lista?.filter((p) => p.link).length ?? 0;

  return createPortal(
    <>
      <div className="cortina" onClick={aoFechar} />
      <aside className="gaveta larga" role="dialog" aria-label={titulo}>
        <div className="gaveta-topo">
          <div>
            <div className="rotulo">{rotulo}</div>
            <h3 className="gaveta-titulo">{titulo}</h3>
            {lista && (
              <p className="mudo num" style={{ margin: "4px 0 0" }}>
                {num(lista.length)} {lista.length === 1 ? "pessoa" : "pessoas"}
                {compraram > 0 ? ` · ${num(compraram)} viraram matrícula` : ""}
                {comConversa > 0 ? ` · ${num(comConversa)} com conversa no Pigeon` : ""}
              </p>
            )}
          </div>
          <button className="btn claro" onClick={aoFechar}>Fechar</button>
        </div>
        <div className="gaveta-corpo">
          {!lista ? (
            <p className="rotulo" style={{ padding: "0 20px" }}>Carregando</p>
          ) : lista.length === 0 ? (
            <p className="mudo" style={{ padding: "0 20px" }}>
              Ninguém neste recorte. Pode ser gente que chegou antes de 30/09/2026, que é quando o
              telefone da conversa passou a ser guardado.
            </p>
          ) : (
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Pessoa</th>
                    <th>Telefone</th>
                    <th>Onde</th>
                    <th>Virou matrícula</th>
                    <th>Conversa</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p, i) => (
                    <tr key={(p.telefone ?? p.pessoa) + i}>
                      <td className="mudo num">{dataCurta(p.quando)}</td>
                      <td style={{ maxWidth: 260 }}>
                        <b>{p.pessoa}</b>
                        {p.primeira_mensagem && (
                          <div className="ids" style={{ whiteSpace: "normal" }}>
                            “{p.primeira_mensagem.slice(0, 120)}”
                          </div>
                        )}
                        {p.email && <div className="ids">{p.email}</div>}
                      </td>
                      <td className="num">{p.telefone ?? "-"}</td>
                      <td className="mudo">
                        {p.onde ?? p.atendente ?? "-"}
                        {p.conversas && p.conversas > 1 ? (
                          <div className="ids">{num(p.conversas)} conversas</div>
                        ) : null}
                      </td>
                      <td>
                        {p.virou_matricula
                          ? <><span className="selo no_ritmo">sim</span>
                              {p.curso ? <div className="ids">{p.curso}</div> : null}</>
                          : <span className="mudo">não</span>}
                      </td>
                      <td>
                        {p.link
                          ? <a className="btn claro" href={p.link} target="_blank" rel="noreferrer">Abrir no Pigeon</a>
                          : <span className="mudo">sem conversa</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}
