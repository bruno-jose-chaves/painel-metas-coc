"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { brl, num, dataCurta } from "@/lib/formato";
import Esqueleto from "@/components/Esqueleto";

// A ficha de uma pessoa.
//
// O painel inteiro responde perguntas de conjunto. A pergunta mais natural que
// existe, "quem é essa pessoa e o que já aconteceu com ela", não tinha resposta
// nenhuma: dependia de abrir a planilha, o CRM e o WhatsApp e cruzar na cabeça.
// Aqui as três fontes viram uma linha do tempo só.

export type Achado = {
  chave: string; nome: string; telefone: string | null; email: string | null;
  cidade: string | null; e_aluno: boolean; cursos: string | null;
  ultimo_contato: string | null; dono: string | null; conversas: number;
};
type Item = {
  bloco: string; ordem: number; quando: string | null; titulo: string;
  detalhe: string | null; valor: number | null; link: string | null; situacao: string | null;
};

const NOME_BLOCO: Record<string, string> = {
  matricula: "Matrícula", negociacao: "Negociação no CRM",
  conversa: "Conversa no WhatsApp", etiqueta: "Etiqueta",
};

export default function Pessoa({ achado, aoFechar }: { achado: Achado; aoFechar: () => void }) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);
  useEffect(() => {
    setItens(null);
    supabase.rpc("painel_pessoa_ficha", { p_chave: achado.chave })
      .then(({ data }) => setItens((data as Item[]) ?? []));
  }, [achado.chave]);

  const matriculas = (itens ?? []).filter((i) => i.bloco === "matricula" && i.situacao !== "cancelada");
  const gasto = matriculas.reduce((s, i) => s + Number(i.valor ?? 0), 0);

  if (!montado) return null;
  return createPortal(
    <div className="cortina" onClick={aoFechar}>
      <div className="gaveta larga" onClick={(e) => e.stopPropagation()}>
        <div className="gaveta-topo">
          <div>
            <div className="rotulo">{achado.e_aluno ? "Aluno" : "Lead"}</div>
            <h3>{achado.nome}</h3>
            <p className="mudo num" style={{ margin: "4px 0 0" }}>
              {[achado.telefone, achado.email, achado.cidade].filter(Boolean).join(" · ") || "sem contato registrado"}
            </p>
          </div>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
        </div>

        <div className="faixa" style={{ margin: "0 0 16px" }}>
          <div>
            <div className="rotulo">Matrículas</div>
            <div className="valor num">{num(matriculas.length)}</div>
          </div>
          <div>
            <div className="rotulo">Já pagou</div>
            <div className="valor num">{brl(gasto)}</div>
          </div>
          <div>
            <div className="rotulo">Conversas</div>
            <div className="valor num">{num(achado.conversas)}</div>
          </div>
          <div>
            <div className="rotulo">Dono no CRM</div>
            <div className="valor num" style={{ fontSize: 18 }}>{achado.dono ?? "sem dono"}</div>
          </div>
        </div>

        {!itens ? <Esqueleto /> : itens.length === 0 ? (
          <p className="mudo">Nada registrado para esta pessoa.</p>
        ) : (
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th><th>O que</th><th>Detalhe</th>
                  <th className="n">Valor</th><th />
                </tr>
              </thead>
              <tbody>
                {itens.map((i, k) => (
                  <tr key={k} className={i.situacao === "cancelada" ? "fora" : undefined}>
                    <td className="num">{dataCurta(i.quando)}</td>
                    <td>
                      <b>{i.titulo}</b>
                      <div className="rotulo">{NOME_BLOCO[i.bloco] ?? i.bloco}</div>
                    </td>
                    <td className="mudo">{i.detalhe}</td>
                    <td className="n">{i.valor == null ? "" : brl(i.valor)}</td>
                    <td>
                      {i.link && (
                        <a className="btn" href={i.link} target="_blank" rel="noreferrer">Abrir conversa</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
