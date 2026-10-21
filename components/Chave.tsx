"use client";

// Chave liga/desliga para filtro de sim ou não.
//
// Antes esses filtros eram botões que trocavam de texto conforme o estado, e
// isso confundia: "Só dia de semana" aceso parecia que estava desligando
// alguma coisa, não ligando. Aqui o rótulo nunca muda, só o estado, e o estado
// aparece escrito além da cor, para não depender de enxergar a diferença.

export default function Chave({
  ligada,
  aoMudar,
  children,
  ajuda,
}: {
  ligada: boolean;
  aoMudar: (v: boolean) => void;
  children: React.ReactNode;
  ajuda?: string;
}) {
  return (
    <button
      type="button"
      className="chave"
      role="switch"
      aria-pressed={ligada}
      title={ajuda}
      onClick={() => aoMudar(!ligada)}
    >
      <span className="trilho" aria-hidden="true" />
      <span className="texto">
        <span className="nome">{children}</span>
        <span className="estado">{ligada ? "ligado" : "desligado"}</span>
      </span>
    </button>
  );
}
