"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, dataCurta } from "@/lib/formato";

type Sugestao = {
  tipo: string; titulo: string; detalhe: string;
  quantos: number; severidade: string; o_que_fazer: string;
};
type Caso = { quem: string | null; quando: string | null; onde: string | null; observacao: string | null };

const SEVERIDADE: Record<string, string> = { alta: "Atrapalha agora", media: "Vale olhar", baixa: "Pouca coisa" };
const CLASSE: Record<string, string> = { alta: "atras", media: "atencao", baixa: "encerrada" };

export default function Sugestoes() {
  const { volta, em, minutos } = useAtualizacao();
  const [lista, setLista] = useState<Sugestao[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [casos, setCasos] = useState<Caso[] | null>(null);

  useEffect(() => {
    supabase.rpc("painel_sugestoes", { p_desde: "2026-01-01" })
      .then(({ data }) => setLista((data as Sugestao[]) ?? []));
  }, [volta]);

  useEffect(() => {
    if (!aberto) { setCasos(null); return; }
    setCasos(null);
    supabase.rpc("painel_sugestoes_casos", { p_tipo: aberto, p_desde: "2026-01-01" })
      .then(({ data }) => setCasos((data as Caso[]) ?? []));
  }, [aberto]);

  const total = lista?.reduce((s, x) => s + Number(x.quantos), 0) ?? 0;
  const altas = lista?.filter((x) => x.severidade === "alta").length ?? 0;

  return (
    <>
      <div className="rotulo">Conferência</div>
      <h1>O que vale conferir</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <div className="faixa">
        <div>
          <div className="rotulo">Pontos a conferir</div>
          <div className="valor num">{lista ? num(lista.length) : "..."}</div>
        </div>
        <div>
          <div className="rotulo">Atrapalham agora</div>
          <div className="valor num">{lista ? num(altas) : "..."}</div>
        </div>
        <div>
          <div className="rotulo">Registros envolvidos</div>
          <div className="valor num">{lista ? num(total) : "..."}</div>
        </div>
      </div>

      <h2><span className="idx">033</span> Lista de conferência</h2>
      <p className="nota">
        Isto não é cobrança, é uma lista do que está estranho na base. Cada ponto diz por que importa e o que fazer, e
        abre a relação nominal para conferir caso a caso no CRM ou na planilha. Nada aqui é apagado ou corrigido pelo
        painel: quem decide é quem conhece a negociação.
      </p>

      {!lista ? <p className="rotulo">Carregando</p> : lista.length === 0 ? (
        <p className="mudo">Nada a conferir. A base está limpa.</p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {lista.map((s) => (
            <div className="bloco" key={s.tipo} style={{ marginBottom: 0 }}>
              <div className="card-top">
                <div>
                  <h3 style={{ margin: 0, fontSize: 17 }}>{s.titulo}</h3>
                  <p className="nota">{s.detalhe}</p>
                </div>
                <span className={"selo " + (CLASSE[s.severidade] ?? "")}>
                  {SEVERIDADE[s.severidade] ?? s.severidade}
                </span>
              </div>

              <div className="grade" style={{ gridTemplateColumns: "auto 1fr" }}>
                <div>
                  <div className="rotulo">Quantos</div>
                  <div className="v num">{num(s.quantos)}</div>
                </div>
                <div>
                  <div className="rotulo">O que fazer</div>
                  <div className="v" style={{ fontSize: 14, fontWeight: 500 }}>{s.o_que_fazer}</div>
                </div>
              </div>

              <button
                className="btn claro"
                style={{ marginTop: 14 }}
                onClick={() => setAberto(aberto === s.tipo ? null : s.tipo)}
              >
                {aberto === s.tipo ? "Fechar a lista" : "Ver a lista"}
              </button>

              {aberto === s.tipo && (
                <div style={{ marginTop: 14 }}>
                  {!casos ? <p className="rotulo">Carregando</p> : casos.length === 0 ? (
                    <p className="mudo">Nada para mostrar.</p>
                  ) : (
                    <>
                      <div className="rolar">
                        <table className="tabela">
                          <thead><tr><th>Quem</th><th>Quando</th><th>Onde</th><th>O que está acontecendo</th></tr></thead>
                          <tbody>
                            {casos.map((c, i) => (
                              <tr key={i}>
                                <td>{c.quem ?? "sem nome"}</td>
                                <td className="mudo num">{dataCurta(c.quando)}</td>
                                <td className="mudo">{c.onde ?? "-"}</td>
                                <td className="mudo">{c.observacao ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {casos.length >= 200 && (
                        <p className="rodape">
                          Mostrando os 200 primeiros. Resolva estes e a lista se refaz sozinha na próxima atualização.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
