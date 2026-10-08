"use client";
import { useEffect, useState } from "react";

export type Aba = { id: string; nome: string; marcador?: number | null };

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
  return (
    <nav className="subnav">
      {abas.map((a) => (
        <button key={a.id} className={aba === a.id ? "ativo" : ""} onClick={() => aoEscolher(a.id)}>
          {a.nome}
          {a.marcador != null && a.marcador > 0 && <span className="marcador">{a.marcador}</span>}
        </button>
      ))}
    </nav>
  );
}
