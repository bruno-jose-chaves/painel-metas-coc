"use client";
import { useState } from "react";
import Etiquetas from "@/components/Etiquetas";
import Pendencias from "@/components/telas/Pendencias";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num } from "@/lib/formato";

// Eram duas telas com a mesma estrutura, a mesma pergunta e a mesma ação: o que
// chegou sem curso apontado, e para onde ele vai. Só mudava o tipo da coisa a
// classificar. Virou uma tela com seletor de tipo, e o painel perdeu uma aba.
const TIPOS = [
  { id: "paginas", nome: "Páginas e campanhas" },
  { id: "etiquetas", nome: "Etiquetas" },
] as const;

type Tipo = (typeof TIPOS)[number]["id"];

export default function Classificar({
  admin, paginas, etiquetas,
}: {
  admin: boolean;
  paginas: number | null;
  etiquetas: number | null;
}) {
  const { em, minutos } = useAtualizacao();
  const [tipo, setTipo] = useState<Tipo>("paginas");
  const quantas: Record<Tipo, number | null> = { paginas, etiquetas };

  return (
    <>
      <div className="rotulo">A classificar</div>
      <h1>O que chegou sem curso apontado</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <div className="filtros">
        <div className="atalhos">
          {TIPOS.map((t) => (
            <button key={t.id} className={tipo === t.id ? "ativo" : ""} onClick={() => setTipo(t.id)}>
              {t.nome}
              {quantas[t.id] != null ? ` (${num(quantas[t.id] as number)})` : ""}
            </button>
          ))}
        </div>
      </div>

      {tipo === "paginas" ? <Pendencias admin={admin} embutido /> : <Etiquetas admin={admin} embutido />}
    </>
  );
}
