import { useRef } from "react";

// Resposta atrasada não pode sobrescrever a atual.
//
// O painel pede os dados dentro de um efeito que roda a cada troca de filtro.
// Trocar o filtro duas vezes seguidas dispara duas consultas, e quem responde
// por último vence, não quem foi pedida por último. Como a consulta sem filtro
// costuma ser a mais pesada, a resposta velha chegava depois e devolvia a tela
// ao estado anterior: era o filtro que "não pegava" e só acertava filtrando e
// desfiltrando até dar sorte.
//
// Cada consulta tem a própria contagem, pela chave, senão uma cancelaria a
// outra dentro da mesma tela.
export function useUltima() {
  const contas = useRef<Record<string, number>>({});
  return function ultima<T>(chave: string, promessa: PromiseLike<T>, aplicar: (valor: T) => void) {
    const meu = (contas.current[chave] = (contas.current[chave] ?? 0) + 1);
    promessa.then((valor) => { if (meu === contas.current[chave]) aplicar(valor); });
  };
}
