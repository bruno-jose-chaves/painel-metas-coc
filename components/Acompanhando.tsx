"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import Detalhe, { type Recorte } from "@/components/Detalhe";
import { brl, num, pct, dataCurta } from "@/lib/formato";

// O que eu quero acompanhar hoje.
//
// Campanha cadastrada tem meta, fase e projeção, e por isso ganha cartão
// próprio. Turma que ainda não virou campanha não tem nada disso, e some da
// tela: foi o que aconteceu com 2027, que começou a vender e ficou invisível.
//
// Aqui a pessoa escolhe até duas turmas para ficar de olho. A referência não é
// meta, que não existe: é a turma equivalente do ano anterior no mesmo dia de
// vida dela. É a única comparação honesta para uma turma recém-aberta.

type Cartao = {
  turma_id: string; nome: string; produto: string; ano: number; semestre: number | null;
  venda_de: string; venda_ate: string; dia_da_turma: number; em_curso: boolean;
  alunos: number; faturamento: number; ticket: number | null;
  anterior_id: string | null; anterior_nome: string | null;
  anterior_mesmo_ponto: number | null; anterior_total: number | null;
};
type Turma = { id: string; produto: string; ano: number; semestre: number | null; nome: string; alunos: number };

const CHAVE = "acompanhando";
const LIMITE = 2;

function lerEscolha(): string[] {
  try {
    const b = localStorage.getItem(CHAVE);
    return b ? (JSON.parse(b) as string[]).slice(0, LIMITE) : [];
  } catch { return []; }
}

export default function Acompanhando({ volta }: { volta: number }) {
  const [escolha, setEscolha] = useState<string[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[] | null>(null);
  const [turmas, setTurmas] = useState<Turma[] | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [detalhe, setDetalhe] = useState<{ titulo: string; recorte: Recorte } | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); setEscolha(lerEscolha()); }, []);

  useEffect(() => {
    if (escolha.length === 0) { setCartoes([]); return; }
    supabase.rpc("painel_turma_cartao", { p_turmas: escolha })
      .then(({ data }) => setCartoes((data as Cartao[]) ?? []));
  }, [escolha, volta]);

  useEffect(() => {
    if (!abrindo || turmas) return;
    supabase.rpc("painel_turmas", { p_so_com_venda: false })
      .then(({ data }) => setTurmas((data as Turma[]) ?? []));
  }, [abrindo, turmas]);

  function guardar(ids: string[]) {
    setEscolha(ids);
    try { localStorage.setItem(CHAVE, JSON.stringify(ids)); } catch { /* aba anônima */ }
  }

  function alternar(id: string) {
    const tem = escolha.includes(id);
    if (tem) return guardar(escolha.filter((x) => x !== id));
    // Duas é o limite de propósito: a tela Hoje serve para bater o olho, e uma
    // lista de dez turmas vira outra planilha.
    guardar([...escolha, id].slice(-LIMITE));
  }

  // Agrupa por ano, porque é assim que a escolha é feita: "o que de 2027 eu
  // quero olhar", e não "qual produto".
  const porAno = useMemo(() => {
    const m = new Map<number, Turma[]>();
    for (const t of turmas ?? []) {
      if (!m.has(t.ano)) m.set(t.ano, []);
      m.get(t.ano)!.push(t);
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [turmas]);

  return (
    <>
      <div className="secao-topo">
        <h2><span className="idx">003</span> Acompanhando</h2>
        <div className="atalhos">
          <button onClick={() => setAbrindo(true)}>
            {escolha.length ? "Trocar o que acompanho" : "Escolher o que acompanhar"}
          </button>
        </div>
      </div>

      {escolha.length === 0 ? (
        <p className="nota">
          Nada escolhido. Serve para ficar de olho em turma que ainda não virou campanha, como as de 2027.
          <Ajuda titulo="Por que isto existe separado das campanhas"
            fontes={["Turmas e janela de venda: tabela turmas",
                     "Matrículas: planilha comercial (tabela vendas), pela turma de cada venda",
                     "Comparação: a turma equivalente do ano anterior, no mesmo dia de vida"]}>
            Campanha cadastrada tem meta, fase e projeção, e por isso ganha cartão próprio acima. Turma que
            ainda não é campanha não tem nada disso e simplesmente não aparece, que foi o que aconteceu com
            2027 quando começou a vender. Aqui você escolhe até duas para acompanhar, e a referência é a
            turma equivalente do ano anterior no mesmo dia de vida, não uma meta que ainda não existe.
          </Ajuda>
        </p>
      ) : !cartoes ? <p className="rotulo">Carregando</p> : (
        <div className="cards">
          {cartoes.map((c) => {
            const ref = c.anterior_mesmo_ponto;
            const dif = ref != null && ref > 0 ? Number(c.alunos) / Number(ref) - 1 : null;
            return (
              <article className="card" key={c.turma_id}>
                <div className="card-top">
                  <div>
                    <div className="rotulo">
                      {dataCurta(c.venda_de)} a {dataCurta(c.venda_ate)} · dia {num(c.dia_da_turma)} de venda
                    </div>
                    <h3>{c.nome}</h3>
                  </div>
                  <span className={"selo " + (c.em_curso ? "atencao" : "no_ritmo")}>
                    {c.em_curso ? "Em curso" : "Fechada"}
                  </span>
                </div>

                <div
                  className="grande num abre"
                  title="Ver as matrículas desta turma"
                  onClick={() => setDetalhe({
                    titulo: c.nome,
                    recorte: { p_de: c.venda_de, p_ate: c.venda_ate, p_turma: c.turma_id },
                  })}
                >
                  {num(c.alunos)} <small>alunos</small>
                </div>

                <div className="faixa" style={{ marginTop: 10 }}>
                  <div>
                    <div className="rotulo">No mesmo ponto</div>
                    <div className="valor num">{ref == null ? "-" : num(ref)}</div>
                    <div className="mudo">
                      {c.anterior_nome ? c.anterior_nome : "sem turma equivalente"}
                    </div>
                  </div>
                  <div>
                    <div className="rotulo">Diferença</div>
                    <div className={"valor num " + (dif == null ? "" : dif >= 0 ? "ok" : "alerta")}>
                      {dif == null ? "-" : (dif > 0 ? "+" : "") + pct(dif)}
                    </div>
                    <div className="mudo num">
                      {ref == null ? "" : `${Number(c.alunos) - Number(ref) > 0 ? "+" : ""}${num(Number(c.alunos) - Number(ref))} alunos`}
                    </div>
                  </div>
                  <div>
                    <div className="rotulo">Faturamento</div>
                    <div className="valor num">{brl(c.faturamento)}</div>
                    <div className="mudo num">{c.ticket ? "ticket " + brl(c.ticket) : ""}</div>
                  </div>
                  <div>
                    <div className="rotulo">A turma anterior fechou</div>
                    <div className="valor num">{c.anterior_total == null ? "-" : num(c.anterior_total)}</div>
                    <div className="mudo">alunos no total</div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {montado && abrindo && createPortal(
        <div className="cortina" onClick={() => setAbrindo(false)}>
          <aside className="gaveta" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Escolher turmas">
            <div className="gaveta-topo">
              <div>
                <div className="rotulo">Acompanhando</div>
                <h3>Escolha até {LIMITE} turmas</h3>
              </div>
              <button onClick={() => setAbrindo(false)} aria-label="Fechar">×</button>
            </div>
            {!turmas ? <p className="rotulo" style={{ padding: "0 20px" }}>Carregando</p> : (
              <div className="gaveta-corpo">
                <p className="nota" style={{ marginTop: 0 }}>
                  A escolha fica guardada neste navegador, então cada pessoa acompanha o que quiser.
                  {escolha.length >= LIMITE && " Duas já estão escolhidas: desmarque uma para trocar."}
                </p>
                {porAno.map(([ano, lista]) => (
                  <div key={ano} style={{ marginBottom: 14 }}>
                    <div className="rotulo">{ano}</div>
                    <div className="escolhas">
                      {lista.map((t) => {
                        const ativo = escolha.includes(t.id);
                        const cheio = escolha.length >= LIMITE && !ativo;
                        return (
                          <button
                            key={t.id}
                            className={"escolha" + (ativo ? " ativa" : "")}
                            disabled={cheio}
                            onClick={() => alternar(t.id)}
                          >
                            <b>{t.nome}</b>
                            <span>{t.alunos ? num(t.alunos) + " alunos" : "sem venda ainda"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>,
        document.body,
      )}

      {detalhe && (
        <Detalhe titulo={detalhe.titulo} recorte={detalhe.recorte} aoFechar={() => setDetalhe(null)} />
      )}
    </>
  );
}
