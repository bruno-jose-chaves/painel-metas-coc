"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { procurar, type Achado } from "@/lib/telas";

// Dezenove telas, mais de sessenta quadros, em cinco áreas: quem não construiu
// o painel não sabe se "desconto" mora em Comercial ou em Campanha, e ia
// abrindo aba por aba. Aqui a pessoa escreve o que quer e o painel diz onde
// está. Procura pelo nome da aba, pelo nome do quadro, pelo que a tela faz, por
// apelido e pelo código de três dígitos, e abre direto no quadro.
//
// Entende também o vocabulário da casa: venda e matrícula são a mesma coisa
// aqui dentro, e quem procura "vendas por dia" quer o quadro que se chama
// "Ritmo diário de matrículas".
export default function Busca({ admin }: { admin: boolean }) {
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [escolhido, setEscolhido] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  const achados = useMemo(() => procurar(texto, admin).slice(0, 8), [texto, admin]);

  useEffect(() => { setEscolhido(0); }, [texto]);

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAberta(true); }
      if (e.key === "Escape") setAberta(false);
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  useEffect(() => {
    if (aberta) { setTexto(""); setTimeout(() => campo.current?.focus(), 10); }
  }, [aberta]);

  const ir = (a: Achado) => { setAberta(false); window.location.href = a.link; };

  const teclado = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setEscolhido((i) => Math.min(i + 1, achados.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setEscolhido((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && achados[escolhido]) { e.preventDefault(); ir(achados[escolhido]); }
  };

  return (
    <>
      <button className="busca-botao" onClick={() => setAberta(true)} title="Procurar uma tela do painel">
        <span aria-hidden="true">⌕</span> Procurar
      </button>

      {aberta && (
        <div className="busca-fundo" onClick={() => setAberta(false)}>
          <div className="busca-caixa" onClick={(e) => e.stopPropagation()}>
            <input
              ref={campo}
              className="busca-campo"
              value={texto}
              placeholder="O que você quer ver? Ex.: vendas por dia, etiqueta, tempo de resposta, 311"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={teclado}
            />
            {achados.length === 0 ? (
              <p className="mudo" style={{ padding: "14px 18px", margin: 0 }}>
                Nada com esse nome. Tente a palavra que você usaria falando, como desconto, etiqueta ou
                motivo de perda. A busca entende venda e matrícula como a mesma coisa.
              </p>
            ) : (
              <ul className="busca-lista">
                {achados.map((a, i) => (
                  <li key={a.area.id + a.tela.id}>
                    <button
                      className={i === escolhido ? "ativo" : ""}
                      onMouseEnter={() => setEscolhido(i)}
                      onClick={() => ir(a)}
                    >
                      <span className="busca-num num">{a.bloco ? a.bloco.codigo : a.tela.codigo}</span>
                      <span className="busca-texto">
                        <b>
                          {a.area.nome} · {a.tela.nome}
                          {a.bloco ? <> · {a.bloco.nome}</> : null}
                        </b>
                        <small>{a.bloco ? "Quadro dentro de " + a.tela.nome : a.tela.oque}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="busca-rodape">
              Setas para escolher, Enter para abrir, Esc para fechar. Atalho: Ctrl K (ou ⌘ K).
            </p>
          </div>
        </div>
      )}
    </>
  );
}
