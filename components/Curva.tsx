"use client";

export type Serie = { nome: string; cor: string; tracejada?: boolean; pontos: (number | null)[] };

// Gráfico de linhas em SVG puro, sem biblioteca externa.
export default function Curva({
  rotulos,
  series,
  altura = 220,
  formatar = (v: number) => String(Math.round(v)),
}: {
  rotulos: string[];
  series: Serie[];
  altura?: number;
  formatar?: (v: number) => string;
}) {
  const L = 52, R = 12, T = 12, B = 28;
  const larg = 760, alt = altura;
  const n = rotulos.length;
  if (n === 0) return <p className="mudo">Sem dados no período.</p>;

  const todos = series.flatMap((s) => s.pontos).filter((v): v is number => v != null);
  const topo = Math.max(1, ...todos);
  const escala = (v: number) => alt - B - ((alt - T - B) * v) / topo;
  const passo = n > 1 ? (larg - L - R) / (n - 1) : 0;
  const x = (i: number) => L + i * passo;

  const linha = (pontos: (number | null)[]) =>
    pontos
      .map((v, i) => (v == null ? null : `${i === 0 || pontos[i - 1] == null ? "M" : "L"}${x(i).toFixed(1)},${escala(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");

  const marcas = [0, 0.5, 1].map((f) => topo * f);
  const cadaRotulo = Math.max(1, Math.ceil(n / 8));

  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${larg} ${alt}`} role="img" aria-label="Evolução no período">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={L} x2={larg - R} y1={escala(m)} y2={escala(m)} stroke="#0A0A0A22" />
            <text x={L - 8} y={escala(m) + 4} textAnchor="end" fontSize="11" fill="#6B6A66">
              {formatar(m)}
            </text>
          </g>
        ))}
        {rotulos.map((r, i) =>
          i % cadaRotulo === 0 ? (
            <text key={i} x={x(i)} y={alt - 8} textAnchor="middle" fontSize="11" fill="#6B6A66">
              {r}
            </text>
          ) : null
        )}
        {series.map((s) => (
          <path
            key={s.nome}
            d={linha(s.pontos)}
            fill="none"
            stroke={s.cor}
            strokeWidth="2"
            strokeDasharray={s.tracejada ? "5 4" : undefined}
          />
        ))}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, fontSize: 12 }}>
        {series.map((s) => (
          <span key={s.nome} style={{ color: "#6B6A66" }}>
            <i
              style={{
                display: "inline-block",
                width: 14,
                height: 2,
                background: s.cor,
                marginRight: 6,
                verticalAlign: 4,
              }}
            />
            {s.nome}
          </span>
        ))}
      </div>
    </div>
  );
}
