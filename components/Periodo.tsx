"use client";
import type { Periodo } from "@/lib/periodo";
import { hojeSP, somaDias, ultimosDias } from "@/lib/periodo";

type Atalho = { nome: string; dias?: number; de?: string; ate?: string };

export default function SeletorPeriodo({
  valor,
  aoMudar,
  atalhos = [],
}: {
  valor: Periodo;
  aoMudar: (p: Periodo) => void;
  atalhos?: Atalho[];
}) {
  const padrao: Atalho[] = [
    { nome: "7 dias", dias: 7 },
    { nome: "30 dias", dias: 30 },
    { nome: "90 dias", dias: 90 },
  ];
  const lista = [...atalhos, ...padrao];
  const ativo = (a: Atalho) => {
    const p = a.dias ? ultimosDias(a.dias) : { de: a.de!, ate: a.ate! };
    return p.de === valor.de && p.ate === valor.ate;
  };

  return (
    <div className="filtros">
      <div className="atalhos">
        {lista.map((a) => (
          <button
            key={a.nome}
            className={ativo(a) ? "ativo" : ""}
            onClick={() => aoMudar(a.dias ? ultimosDias(a.dias) : { de: a.de!, ate: a.ate! })}
          >
            {a.nome}
          </button>
        ))}
      </div>
      <label>
        <span className="rotulo">De</span>
        <input
          type="date"
          value={valor.de}
          max={valor.ate}
          onChange={(e) => e.target.value && aoMudar({ ...valor, de: e.target.value })}
        />
      </label>
      <label>
        <span className="rotulo">Até</span>
        <input
          type="date"
          value={valor.ate}
          min={valor.de}
          max={somaDias(hojeSP(), 1)}
          onChange={(e) => e.target.value && aoMudar({ ...valor, ate: e.target.value })}
        />
      </label>
    </div>
  );
}
