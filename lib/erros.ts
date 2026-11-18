"use client";
import { useSyncExternalStore } from "react";

// Falha de leitura precisa aparecer. Antes, uma consulta que dava erro devolvia
// lista vazia e a tela mostrava "nenhum resultado" ou zero, com a mesma cara de
// um dia sem vendas. Aqui o cliente do banco registra cada leitura que falhou, e
// o Shell mostra um aviso único, com o mesmo texto em toda tela e um botão para
// tentar de novo.
let falhas = 0;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function registrarFalha() { falhas += 1; avisar(); }
export function limparFalhas() { if (falhas !== 0) { falhas = 0; avisar(); } }

export function useFalhas() {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => falhas,
    () => 0,
  );
}

// Quem quer recarregar tudo (botão do aviso) dispara este evento; useAtualizacao
// escuta e faz o mesmo que a volta de cinco minutos.
export const EVENTO_RECARREGAR = "painel:recarregar";
export const recarregarTudo = () => window.dispatchEvent(new Event(EVENTO_RECARREGAR));
