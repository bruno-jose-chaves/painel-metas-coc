"use client";
import { useEffect, useId, useRef, useState } from "react";

// O Ⓘ que guarda o resto do texto.
//
// As telas tinham parágrafos de seis linhas explicando como o número foi feito.
// Quem já sabe pula e perde tempo; quem não sabe lê no meio do caminho. Agora a
// tela mostra a frase curta e guarda a explicação aqui: fica a um passo de
// distância, e some quando ninguém precisa dela.
//
// `fontes` é a parte que faltava no painel inteiro: de onde o número veio, quais
// bases foram cruzadas e por qual chave. É o que permite conferir um número sem
// perguntar para ninguém.
export default function Ajuda({
  titulo,
  children,
  fontes,
}: {
  titulo?: string;
  children?: React.ReactNode;
  fontes?: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <span
      className="ajuda"
      ref={caixa}
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={titulo ? "Sobre " + titulo : "Mais informações"}
        onClick={() => setAberto((v) => !v)}
        onFocus={() => setAberto(true)}
      >
        i
      </button>
      {aberto && (
        <span className="ajuda-balao" id={id} role="tooltip">
          {titulo && <span className="rotulo">{titulo}</span>}
          {children && <span className="ajuda-corpo">{children}</span>}
          {fontes?.length ? (
            <span className="ajuda-fontes">
              <span className="rotulo">De onde vem</span>
              {fontes.map((f) => <span key={f}>{f}</span>)}
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}
