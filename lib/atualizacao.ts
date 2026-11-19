"use client";
import { useEffect, useRef, useState } from "react";
import { limparCache } from "@/lib/cache";
import { EVENTO_RECARREGAR, limparFalhas } from "@/lib/erros";

const MINUTOS = 5;

// Conta quantas voltas de atualização já aconteceram. Cada tela coloca esse
// número nas dependências da busca de dados, então todas recarregam juntas sem
// perder o filtro que a pessoa escolheu. Só conta enquanto a aba está à vista:
// painel esquecido aberto não fica batendo no banco à toa.
export function useAtualizacao() {
  const [volta, setVolta] = useState(0);
  const [em, setEm] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      // O cache curto tem que cair junto, senão atualizar devolveria a mesma
      // foto guardada e a volta de cinco minutos não valeria nada.
      limparCache();
      limparFalhas();
      setVolta((v) => v + 1);
      setEm(new Date());
    }, MINUTOS * 60_000);

    // Ao voltar para a aba depois de um tempo, atualiza na hora.
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - em.getTime() < MINUTOS * 60_000) return;
      limparCache();
      setVolta((v) => v + 1);
      setEm(new Date());
    };
    // Botão "Tentar de novo" do aviso de erro.
    const aoPedir = () => {
      limparCache();
      limparFalhas();
      setVolta((v) => v + 1);
      setEm(new Date());
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener(EVENTO_RECARREGAR, aoPedir);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener(EVENTO_RECARREGAR, aoPedir);
    };
  }, [em]);

  return { volta, em, minutos: MINUTOS };
}

export function horaCurta(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

// Diz se a busca está rodando só por causa da volta de cinco minutos (ou do
// "Tentar de novo"), com os mesmos filtros de antes. Nesse caso a tela mantém o
// dado antigo até o novo chegar, em vez de virar esqueleto e perder a rolagem.
// Quando um filtro muda, devolve falso e a tela limpa normalmente.
export function useSoVolta(volta: number, ...filtros: unknown[]) {
  const chave = JSON.stringify(filtros);
  const anterior = useRef<{ volta: number; chave: string } | null>(null);
  const so = anterior.current !== null && anterior.current.chave === chave && anterior.current.volta !== volta;
  useEffect(() => { anterior.current = { volta, chave }; });
  return so;
}
