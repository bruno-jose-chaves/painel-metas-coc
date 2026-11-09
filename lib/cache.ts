"use client";

// Cache curto, compartilhado entre telas.
//
// O painel é um site de uma página só: trocar de aba não recarrega o navegador,
// mas remonta os componentes, e cada um volta a pedir o que precisa. Medindo as
// chamadas reais, três consultas rodavam de novo em TODA navegação: a lista de
// campanhas (2.687 vezes no período), a última sincronização da planilha
// (2.667) e a checagem de quem está logado. Nenhuma delas muda de minuto a
// minuto, e as três atrasavam a tela antes de qualquer número aparecer.
//
// Duas coisas acontecem aqui. A primeira é guardar a resposta por um tempo
// curto. A segunda, e tão importante quanto, é juntar chamadas iguais que
// acontecem ao mesmo tempo: quando três blocos da mesma tela pedem a lista de
// campanhas no mesmo instante, sai uma consulta e as três recebem a resposta.
//
// Não é cache de dado de negócio: é cache de milissegundos. O botão de
// atualizar e a volta automática de cinco minutos limpam tudo, então ninguém
// fica olhando número velho.

type Entrada = { em: number; valor?: unknown; voando?: Promise<unknown> };

const caixa = new Map<string, Entrada>();

export function emCache<T>(chave: string, segundos: number, buscar: () => PromiseLike<T>): Promise<T> {
  const agora = Date.now();
  const tem = caixa.get(chave);

  // Resposta fresca: devolve na hora, sem rede.
  if (tem && tem.voando === undefined && agora - tem.em < segundos * 1000) {
    return Promise.resolve(tem.valor as T);
  }
  // Já tem alguém buscando a mesma coisa: pega carona.
  if (tem?.voando) return tem.voando as Promise<T>;

  const voando = Promise.resolve(buscar()).then(
    (valor) => { caixa.set(chave, { em: Date.now(), valor }); return valor; },
    (erro) => {
      // Erro não entra no cache: a próxima tentativa tem que ir na rede de
      // novo, senão uma falha de rede congela a tela pelo tempo do cache.
      caixa.delete(chave);
      throw erro;
    },
  );
  caixa.set(chave, { em: agora, voando });
  return voando;
}

// Limpa tudo, ou só o que começa com o prefixo. É o que o botão de atualizar
// chama: sem isso, atualizar devolveria a mesma foto guardada.
export function limparCache(prefixo?: string) {
  if (!prefixo) { caixa.clear(); return; }
  for (const k of [...caixa.keys()]) if (k.startsWith(prefixo)) caixa.delete(k);
}
