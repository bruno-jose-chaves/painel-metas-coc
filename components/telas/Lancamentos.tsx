"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Sugestoes from "@/components/Sugestoes";
import Vendas from "@/components/telas/Vendas";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num } from "@/lib/formato";

// "O que conferir" nunca foi outra tela: é a mesma matrícula lançada, filtrada
// pelo que saiu estranho. Virou o segundo modo daqui, com a contagem no botão,
// para quem abre Lançamentos ver que existe coisa torta sem procurar por ela.
export default function Lancamentos() {
  const { volta, em, minutos } = useAtualizacao();
  const [modo, setModo] = useState<"lista" | "conferir">("lista");
  const [aConferir, setAConferir] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc("painel_sugestoes", { p_desde: "2026-01-01" })
      .then(({ data }) => setAConferir(((data as unknown[]) ?? []).length));
  }, [volta]);

  return (
    <>
      <div className="rotulo">Vendas</div>
      <h1>Matrícula por matrícula</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <div className="filtros">
        <div className="atalhos">
          <button className={modo === "lista" ? "ativo" : ""} onClick={() => setModo("lista")}>
            Todas as matrículas
          </button>
          <button className={modo === "conferir" ? "ativo" : ""} onClick={() => setModo("conferir")}>
            O que vale conferir
            {aConferir != null ? ` (${num(aConferir)})` : ""}
          </button>
        </div>
      </div>

      {modo === "lista" ? <Vendas embutido /> : <Sugestoes embutido />}
    </>
  );
}
