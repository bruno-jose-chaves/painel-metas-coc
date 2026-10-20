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

// Duração em minutos, escrita como gente lê. Minuto puro fica ilegível acima de
// uma hora: "2356 min" ninguém processa como "quase dois dias".
//
// Esta conta existia duas vezes, em Fontes e em Qualidade, com arredondamentos
// diferentes: o mesmo intervalo saía como "2 h" numa tela e "2,5 h" na outra.
export const duracao = (min: number | string | null | undefined) => {
  if (min == null) return "-";
  const m = Number(min);
  if (!Number.isFinite(m)) return "-";
  if (m < 1) return "na hora";
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1).replace(".", ",")} h`;
  return `${(m / 60 / 24).toFixed(1).replace(".", ",")} dias`;
};
