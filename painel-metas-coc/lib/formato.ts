export const brl = (v: number | string | null | undefined, casas = 0) =>
  v == null ? "-" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: casas, minimumFractionDigits: casas });
export const num = (v: number | string | null | undefined) => (v == null ? "-" : Number(v).toLocaleString("pt-BR"));
export const pct = (v: number | null | undefined, casas = 1) =>
  v == null || !Number.isFinite(v) ? "-" : (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas }) + "%";
export const dataCurta = (d: string | null | undefined) => {
  if (!d) return "-";
  const [, m, dia] = d.slice(0, 10).split("-");
  return `${dia}/${m}`;
};
export const dataHora = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
