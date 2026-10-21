"use client";
import { useEffect, useRef, useState } from "react";

export type Aba = {
  id: string; nome: string; oque?: string; marcador?: number | null;
  // Código de três dígitos: setor, sub-aba, seção. Hoje é 100, Campanha 200,
  // Comercial 300, Marketing 400, Ajustes 500. A primeira sub-aba de Comercial
  // é 310, e os blocos dentro dela são 311, 312, 313. Serve para a gente
  // conversar: "olha o 341" é mais curto que "a terceira caixa da aba WhatsApp
  // e CRM dentro de Comercial".
  codigo?: number;
};

// Subnavegação de uma área. Guarda a escolha no endereço, então recarregar a
// página ou mandar o link para alguém cai na mesma visão.
export function useAba(abas: Aba[], chave = "v") {
  const [aba, setAba] = useState<string>(abas[0]?.id ?? "");

  useEffect(() => {
    const atual = new URLSearchParams(window.location.search).get(chave);
    if (atual && abas.some((a) => a.id === atual)) setAba(atual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolher = (id: string) => {
    setAba(id);
    const url = new URL(window.location.href);
    if (id === abas[0]?.id) url.searchParams.delete(chave);
    else url.searchParams.set(chave, id);
    window.history.replaceState(null, "", url.toString());
  };

  return { aba, escolher };
}

export default function SubAbas({
  abas,
  aba,
  aoEscolher,
}: {
  abas: Aba[];
  aba: string;
  aoEscolher: (id: string) => void;
}) {
  const nav = useRef<HTMLElement>(null);

  // No telefone as abas não cabem todas. Se a ativa está fora da vista, quem
  // abre o link não vê em que aba está. Então ela se puxa para dentro.
  useEffect(() => {
    const alvo = nav.current?.querySelector<HTMLElement>("button.ativo");
    alvo?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [aba]);

  // A linha embaixo das abas não é enfeite: "Passagem", "Captação" e
  // "Pendências" são nomes curtos que só fazem sentido para quem construiu a
  // tela. Dizer em uma frase o que tem dentro evita a pessoa abrir aba por aba
  // procurando o número que ela quer.
  const atual = abas.find((a) => a.id === aba);
  const descricao = atual?.oque;

  // O código da aba vai para o <main>, e é de lá que o índice tira a numeração
  // dos blocos. Assim nenhuma tela precisa saber em que posição ela está.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    if (atual?.codigo) main.setAttribute("data-codigo", String(atual.codigo));
    else main.removeAttribute("data-codigo");
  }, [atual?.codigo]);

  return (
    <div className="subnav-caixa">
      <nav className="subnav" ref={nav}>
        {abas.map((a) => (
          <button
            key={a.id}
            className={aba === a.id ? "ativo" : ""}
            onClick={() => aoEscolher(a.id)}
            title={a.oque}
          >
            {a.nome}
            {a.marcador != null && a.marcador > 0 && <span className="marcador">{a.marcador}</span>}
          </button>
        ))}
      </nav>
      {descricao && <p className="subnav-oque">{descricao}</p>}
    </div>
  );
}
