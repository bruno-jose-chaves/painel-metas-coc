"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { brl, num, pct, dataCurta } from "@/lib/formato";

export type Recorte = {
  p_de?: string | null; p_ate?: string | null; p_produto?: string | null;
  p_vendedor?: string | null; p_campanha?: string | null; p_fase?: number | null;
};
type Venda = {
  data: string; aluno: string; curso: string; vendedor: string;
  valor_tabela: number | null; desconto: number | null; valor_venda: number | null;
  cidade: string | null; turma: string | null;
};

// Número agregado que não responde "quais?" obriga a pessoa a confiar ou a
// abrir a planilha. Esta gaveta é a resposta: recebe o mesmo recorte que gerou
// o número e lista as matrículas uma a uma.
export default function Detalhe({
  titulo, recorte, aoFechar,
}: {
  titulo: string;
  recorte: Recorte;
  aoFechar: () => void;
}) {
  const [lista, setLista] = useState<Venda[] | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    setLista(null);
    supabase.rpc("painel_vendas_detalhe", { ...recorte, p_limite: 300 })
      .then(({ data }) => setLista((data as Venda[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(recorte)]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  if (!montado) return null;

  const total = lista?.reduce((s, v) => s + Number(v.valor_venda ?? 0), 0) ?? 0;

  return createPortal(
    <>
      <div className="cortina" onClick={aoFechar} />
      <aside className="gaveta larga" role="dialog" aria-label={titulo}>
        <div className="gaveta-topo">
          <div>
            <div className="rotulo">Matrículas</div>
            <h3 className="gaveta-titulo">
              {titulo}
            </h3>
            {lista && (
              <p className="mudo num" style={{ margin: "4px 0 0" }}>
                {num(lista.length)} {lista.length === 1 ? "matrícula" : "matrículas"} · {brl(total)}
                {lista.length === 300 ? " · mostrando as 300 mais recentes" : ""}
              </p>
            )}
          </div>
          <button className="btn claro" onClick={aoFechar}>Fechar</button>
        </div>
        <div className="gaveta-corpo">
          {!lista ? (
            <p className="rotulo" style={{ padding: "0 20px" }}>Carregando</p>
          ) : lista.length === 0 ? (
            <p className="mudo" style={{ padding: "0 20px" }}>Nenhuma matrícula nesse recorte.</p>
          ) : (
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Dia</th><th>Aluno</th><th>Curso</th><th>Vendedor</th>
                    <th className="n">Tabela</th><th className="n">Desconto</th><th className="n">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((v, i) => (
                    <tr key={v.aluno + v.data + i}>
                      <td className="num">{dataCurta(v.data)}</td>
                      <td><b>{v.aluno}</b>{v.cidade ? <div className="ids">{v.cidade}</div> : null}</td>
                      <td className="mudo">{v.turma ?? v.curso}</td>
                      <td className="mudo">{v.vendedor}</td>
                      <td className="n">{v.valor_tabela ? brl(v.valor_tabela) : "-"}</td>
                      <td className="n">{v.desconto ? pct(v.desconto) : "-"}</td>
                      <td className="n"><b>{brl(v.valor_venda)}</b></td>
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
