"use client";
import { useRef, useState } from "react";
import { COR } from "@/lib/cores";

export type Serie = {
  nome: string;
  cor: string;
  tracejada?: boolean;
  pontos: (number | null)[];
  // Texto pronto para o balão, quando o número cru não basta (valor em reais,
  // por exemplo). Mesma posição dos pontos.
  rotulos?: (string | null)[];
};

// Gráfico de linhas em SVG puro, sem biblioteca externa.
//
// O que mudou: a linha sozinha não respondia nada. Agora tem fio vertical que
// gruda no ponto mais próximo e um balão que lista TODAS as séries daquele dia,
// com o valor exato. A pessoa mira numa data, nunca numa linha de dois pixels.
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
  const [ativo, setAtivo] = useState<number | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const L = 52, R = 14, T = 14, B = 30;
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

  // Posição do balão em porcentagem da largura, para acompanhar o SVG que
  // encolhe junto com a tela.
  const posBalao = ativo == null ? 0 : (x(ativo) / larg) * 100;

  return (
    <div className="grafico" ref={caixa}>
      <div className="grafico-area">
        <svg
          viewBox={`0 0 ${larg} ${alt}`}
          role="img"
          aria-label="Evolução no período"
          onMouseLeave={() => setAtivo(null)}
        >
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
              <text key={i} x={x(i)} y={alt - 9} textAnchor="middle" className="eixo" fill={COR.cinza}>
                {r}
              </text>
            ) : null
          )}

          {ativo != null && (
            <line x1={x(ativo)} x2={x(ativo)} y1={T} y2={alt - B} stroke={COR.tinta} strokeWidth="1" opacity="0.35" />
          )}

          {series.map((s) => (
            <path
              key={s.nome}
              d={linha(s.pontos)}
              fill="none"
              stroke={s.cor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={s.tracejada ? "5 4" : undefined}
            />
          ))}

          {ativo != null &&
            series.map((s) =>
              s.pontos[ativo] == null ? null : (
                <circle
                  key={"p" + s.nome}
                  cx={x(ativo)}
                  cy={escala(s.pontos[ativo] as number)}
                  r="4"
                  fill={s.cor}
                  stroke="var(--superficie)"
                  strokeWidth="2"
                />
              )
            )}

          {/* Faixa invisível por ponto: a área de acerto é a fatia inteira, não
              a linha. Ninguém mira em dois pixels. */}
          {rotulos.map((r, i) => (
            <rect
              key={"z" + i}
              x={x(i) - passo / 2}
              y={T}
              width={Math.max(passo, 8)}
              height={alt - T - B}
              fill="transparent"
              tabIndex={0}
              style={{ cursor: aoClicar ? "pointer" : "default", outline: "none" }}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              onClick={() => aoClicar?.(i)}
              onKeyDown={(e) => { if (e.key === "Enter") aoClicar?.(i); }}
            >
              <title>{r}</title>
            </rect>
          ))}
        </svg>

        {ativo != null && (
          <div
            className={"balao" + (posBalao > 60 ? " esquerda" : "")}
            style={{ left: `${posBalao}%` }}
            role="status"
          >
            <div className="rotulo">{rotulos[ativo]}</div>
            {series.map((s) => (
              <div key={s.nome} className="balao-linha">
                <i style={{ background: s.cor }} className={s.tracejada ? "tracejada" : undefined} />
                <b className="num">
                  {s.rotulos?.[ativo] ??
                    (s.pontos[ativo] == null ? "-" : formatar(s.pontos[ativo] as number))}
                </b>
                <span>{s.nome}</span>
              </div>
            ))}
            {aoClicar && <div className="ids">clique para ver as matrículas</div>}
          </div>
        )}
      </div>

      {series.length > 1 && (
        <div className="legenda-serie">
          {series.map((s) => (
            <span key={s.nome}>
              <i style={{ background: s.cor }} className={s.tracejada ? "tracejada" : undefined} />
              {s.nome}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
