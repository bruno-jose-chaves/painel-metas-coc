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
