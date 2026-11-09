"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { brl, num, dataCurta } from "@/lib/formato";
import Esqueleto from "@/components/Esqueleto";

// A gaveta do bloco 315.
//
// Mediana esconde o caso extremo por construção, e é justamente o caso extremo
// que explica o número. Aqui a mesma conta aparece matrícula por matrícula, em
// ordem de quem está na base há mais tempo, que é onde mora a surpresa.

type Linha = {
  aluno: string; data: string; curso: string | null; vendedor: string | null; valor: number | null;
  dias_fechar: number | null; dias_contato: number | null; dias_base: number | null;
  campanha: string; fonte: string; grupo: string;
};

const d = (v: number | null) => (v == null ? "-" : num(v));

export default function FechamentoLista({
  titulo, params, aoFechar,
}: { titulo: string; params: Record<string, unknown>; aoFechar: () => void }) {
  const [lista, setLista] = useState<Linha[] | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    setLista(null);
    supabase.rpc("painel_fechamento_lista", { ...params, p_limite: 400 })
      .then(({ data }) => setLista((data as Linha[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  if (!montado) return null;

  const comContato = lista?.filter((l) => l.dias_contato != null).length ?? 0;
  const velhos = lista?.filter((l) => (l.dias_base ?? 0) > 180).length ?? 0;

  return createPortal(
    <>
      <div className="cortina" onClick={aoFechar} />
      <aside className="gaveta larga" role="dialog" aria-label={titulo}>
        <div className="gaveta-topo">
          <div>
            <div className="rotulo">Matrícula por matrícula</div>
            <h3 className="gaveta-titulo">{titulo}</h3>
            {lista && (
              <p className="mudo num" style={{ margin: "4px 0 0" }}>
                {num(lista.length)} {lista.length === 1 ? "matrícula" : "matrículas"}
                {lista.length ? ` · ${num(velhos)} com mais de 180 dias de base` : ""}
                {lista.length ? ` · ${num(comContato)} com conversa registrada` : ""}
              </p>
            )}
          </div>
          <button className="btn claro" onClick={aoFechar}>Fechar</button>
        </div>

        {!lista ? <Esqueleto /> : lista.length === 0 ? (
          <p className="mudo">Nenhuma matrícula neste recorte.</p>
        ) : (
          <>
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Matriculou</th>
                    <th>Curso</th>
                    <th className="n">Valor</th>
                    <th className="n">Negócio aberto há</th>
                    <th className="n">Conversando há</th>
                    <th className="n">Na base há</th>
                    <th>Campanha no CRM</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((l, i) => (
                    <tr key={l.aluno + l.data + i}>
                      <td><b>{l.aluno}</b>{l.vendedor ? <div className="ids">{l.vendedor}</div> : null}</td>
                      <td className="num mudo">{dataCurta(l.data)}</td>
                      <td className="mudo" style={{ maxWidth: 200 }}>{l.curso ?? "-"}</td>
                      <td className="n num">{l.valor == null ? "-" : brl(l.valor)}</td>
                      <td className="n num">{d(l.dias_fechar)}</td>
                      <td className="n num">{d(l.dias_contato)}</td>
                      <td className="n num"><b>{d(l.dias_base)}</b></td>
                      <td className="mudo" style={{ maxWidth: 220 }}>{l.campanha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rodape">
              Em dias, do mais antigo na base para o mais novo. Traço em <b>conversando há</b> quer dizer
              que não existe conversa registrada daquele telefone antes da matrícula, o que é normal em
              venda anterior a 04/03/2026 e em quem fechou por telefone. No máximo 400 linhas por vez.
            </p>
          </>
        )}
      </aside>
    </>,
    document.body,
  );
}
