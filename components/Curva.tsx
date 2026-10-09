"use client";
import { COR } from "@/lib/cores";

export type Serie = { nome: string; cor: string; tracejada?: boolean; pontos: (number | null)[] };

// Gráfico de linhas em SVG puro, sem biblioteca externa.
export default function Curva({
  rotulos,
  series,
  altura = 220,
  formatar = (v: number) => String(Math.round(v)),
  aoClicar,
}: {
  rotulos: string[];
  series: Serie[];
  altura?: number;
  formatar?: (v: number) => string;
  aoClicar?: (indice: number) => void;
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
            <line x1={L} x2={larg - R} y1={escala(m)} y2={escala(m)} stroke={COR.linha} />
            <text x={L - 8} y={escala(m) + 4} textAnchor="end" className="eixo" fill={COR.cinza}>
              {formatar(m)}
            </text>
          </g>
        ))}
        {rotulos.map((r, i) =>
          i % cadaRotulo === 0 ? (
            <text key={i} x={x(i)} y={alt - 8} textAnchor="middle" className="eixo" fill={COR.cinza}>
              {r}
            </text>
          ) : null
        )}
        {/* Faixa invisível por ponto, para o clique ter onde cair. A linha tem
            dois pixels de espessura e ninguém acerta dois pixels. */}
        {aoClicar && rotulos.map((r, i) => (
          <rect
            key={"z" + i}
            x={x(i) - passo / 2}
            y={T}
            width={Math.max(passo, 6)}
            height={alt - T - B}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onClick={() => aoClicar(i)}
          >
            <title>{r}</title>
          </rect>
        ))}
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
      {series.length > 1 && (
        <div className="legenda-serie">
          {series.map((s) => (
            <span key={s.nome}>
              <i style={{ background: s.cor }} />
              {s.nome}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
