"use client";
import { useMemo, useState } from "react";

// Mapa de calor de hora do dia contra dia da semana.
//
// Uma cor só, do claro ao escuro, porque a grandeza é uma só e tem ordem.
// Arco-íris aqui faria a pessoa procurar significado na mudança de cor, que não
// existe. O número só aparece nas células fortes: número em toda célula vira
// tabela, e tabela a gente já tem em cima.

export type Celula = { dia_semana: number; nome_dia: string; hora: number; valor: number; base: number };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function MapaCalor({
  dados, formatar, rotuloValor, aoClicar,
}: {
  dados: Celula[];
  formatar: (v: number) => string;
  rotuloValor: string;
  aoClicar?: (c: Celula) => void;
}) {
  const [sobre, setSobre] = useState<Celula | null>(null);

  const { horas, mapa, maior } = useMemo(() => {
    const comDado = dados.filter((c) => Number(c.valor) > 0);
    const hs = comDado.map((c) => c.hora);
    // A grade vai só das horas que existem, com uma folga de uma hora de cada
    // lado. Mostrar madrugada vazia por 7 colunas só gasta espaço.
    const min = hs.length ? Math.max(0, Math.min(...hs) - 1) : 7;
    const max = hs.length ? Math.min(23, Math.max(...hs) + 1) : 20;
    const m = new Map<string, Celula>();
    for (const c of dados) m.set(c.dia_semana + ":" + c.hora, c);
    return {
      horas: Array.from({ length: max - min + 1 }, (_, i) => min + i),
      mapa: m,
      maior: Math.max(1, ...comDado.map((c) => Number(c.valor))),
    };
  }, [dados]);

  return (
    <div className="calor-caixa">
      <div className="rolar">
        <table className="calor">
          <thead>
            <tr>
              <th />
              {horas.map((h) => (
                <th key={h} className="num">{String(h).padStart(2, "0")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <tr key={d} className={d === 0 || d === 6 ? "fds" : undefined}>
                <th>{DIAS[d].slice(0, 3)}</th>
                {horas.map((h) => {
                  const c = mapa.get(d + ":" + h);
                  const v = Number(c?.valor ?? 0);
                  const f = v / maior;
                  const forte = f > 0.55;
                  return (
                    <td
                      key={h}
                      className={(v > 0 ? "tem" : "") + (aoClicar && v > 0 ? " abre" : "")}
                      style={v > 0 ? {
                        background: `rgba(18,18,17,${(0.07 + f * 0.85).toFixed(3)})`,
                        color: forte ? "#FFF" : "var(--tinta)",
                      } : undefined}
                      onMouseEnter={() => c && setSobre(c)}
                      onMouseLeave={() => setSobre(null)}
                      onClick={aoClicar && c && v > 0 ? () => aoClicar(c) : undefined}
                    >
                      {f > 0.35 ? formatar(v) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="calor-pe">
        <div className="calor-escala">
          <span className="rotulo">menos</span>
          {[0.08, 0.26, 0.44, 0.62, 0.8, 0.95].map((a) => (
            <i key={a} style={{ background: `rgba(18,18,17,${a})` }} />
          ))}
          <span className="rotulo">mais · até {formatar(maior)}</span>
        </div>
        <div className="mudo num">
          {sobre
            ? `${DIAS[sobre.dia_semana]}, ${String(sobre.hora).padStart(2, "0")}h · ${formatar(Number(sobre.valor))} ${rotuloValor}`
            : "Passe o mouse para ver a célula"}
        </div>
      </div>
    </div>
  );
}
