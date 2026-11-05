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
export const DESDE_CONVERSAS = "2026-08-01";
