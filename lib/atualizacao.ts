"use client";
import { useEffect, useState } from "react";

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
      setVolta((v) => v + 1);
      setEm(new Date());
    }, MINUTOS * 60_000);

    // Ao voltar para a aba depois de um tempo, atualiza na hora.
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - em.getTime() < MINUTOS * 60_000) return;
      setVolta((v) => v + 1);
      setEm(new Date());
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [em]);

  return { volta, em, minutos: MINUTOS };
}

export function horaCurta(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
