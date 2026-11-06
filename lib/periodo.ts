// Datas sempre no fuso de São Paulo, para bater com o que a operação vê.
export const hojeSP = () => {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date());
};

export const somaDias = (iso: string, dias: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export const menor = (a: string, b: string) => (a < b ? a : b);

export type Periodo = { de: string; ate: string };

export const ultimosDias = (dias: number): Periodo => {
  const ate = hojeSP();
  return { de: somaDias(ate, -(dias - 1)), ate };
};

// Datas de referência que estavam escritas à mão em sete lugares, todas presas
// em 2026. Na virada do ano elas congelariam o painel no ano passado sem
// ninguém perceber: a tela continuaria desenhando, só com dado velho.
export const inicioDoAno = () => hojeSP().slice(0, 4) + "-01-01";

// Agosto de 2026 foi quando o registro de conversa do Pigeon passou a ser
// confiável. Antes disso não há o que ler, então esta é uma data fixa de
// verdade, e não um ano corrente disfarçado.
// O historico de conversa que o Pigeon entregou comeca em 04/03/2026, e nao em
// agosto como o painel dizia: marco a novembro tem volume parecido e atendente
// preenchido em todos os meses. O que comeca em agosto e outra coisa, a janela
// escolhida para a lista de A classificar.
export const DESDE_CONVERSAS = "2026-03-04";
export const DESDE_CLASSIFICAR = "2026-08-01";
