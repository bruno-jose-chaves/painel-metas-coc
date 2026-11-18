"use client";
import { useMemo, useState } from "react";
import type { Periodo } from "@/lib/periodo";
import { hojeSP, somaDias, ultimosDias } from "@/lib/periodo";

export type Campanha = { id: string; nome: string; inicio: string; fim: string; produto_id?: string | null };

// Campanha e período são filtros independentes. Escolher a campanha também
// posiciona a data, mas mexer na data depois não desfaz a escolha do curso.
export default function FiltroCampanha({
  campanhas,
  campanha,
  aoMudarCampanha,
  periodo,
  aoMudarPeriodo,
}: {
  campanhas: Campanha[];
  campanha: string | null;
  aoMudarCampanha: (id: string | null) => void;
  periodo: Periodo;
  aoMudarPeriodo: (p: Periodo) => void;
}) {
  const dias = [
    { nome: "7 dias", d: 7 },
    { nome: "30 dias", d: 30 },
    { nome: "90 dias", d: 90 },
  ];
  const ativoPeriodo = (d: number) => {
    const p = ultimosDias(d);
    return p.de === periodo.de && p.ate === periodo.ate;
  };

  // Com as campanhas de dois ou três anos na mesma fila, a linha de botões
  // passava de vinte e rolava para o lado. Agora há um seletor de ano (o do
  // fim da campanha, que é o ano do ciclo) e só aparecem as campanhas dele.
  const anoDe = (c: Campanha) => c.fim.slice(0, 4);
  const anos = useMemo(() => [...new Set(campanhas.map(anoDe))].sort().reverse(), [campanhas]);
  const anoPadrao = useMemo(() => {
    const atual = campanhas.find((c) => c.id === campanha);
    if (atual) return anoDe(atual);
    const hoje = hojeSP();
    const recente = [...campanhas].filter((c) => c.inicio <= hoje).sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
    return recente ? anoDe(recente) : anos[0];
  }, [campanhas, campanha, anos]);
  const [anoEscolhido, setAnoEscolhido] = useState<string | null>(null);
  const ano = anoEscolhido && anos.includes(anoEscolhido) ? anoEscolhido : anoPadrao;
  const doAno = campanhas.filter((c) => anoDe(c) === ano);

  function escolher(c: Campanha | null) {
    if (!c) { aoMudarCampanha(null); return; }
    aoMudarCampanha(c.id);
    aoMudarPeriodo({ de: c.inicio, ate: c.fim });
  }

  return (
    <div className="filtros" style={{ flexWrap: "wrap" }}>
      {anos.length > 1 && (
        <div className="atalhos" aria-label="Ano da campanha">
          {anos.map((a) => (
            <button key={a} className={ano === a ? "ativo" : ""} onClick={() => setAnoEscolhido(a)}>{a}</button>
          ))}
        </div>
      )}

      <div className="atalhos">
        <button className={campanha === null ? "ativo" : ""} onClick={() => escolher(null)}>
          Todos os cursos
        </button>
        {doAno.map((c) => (
          <button key={c.id} className={campanha === c.id ? "ativo" : ""} onClick={() => escolher(c)}>
            {c.nome}
          </button>
        ))}
      </div>

      <div className="atalhos">
        {dias.map((a) => (
          <button key={a.nome} className={ativoPeriodo(a.d) ? "ativo" : ""} onClick={() => aoMudarPeriodo(ultimosDias(a.d))}>
            {a.nome}
          </button>
        ))}
      </div>

      <label>
        <span className="rotulo">De</span>
        <input type="date" value={periodo.de} max={periodo.ate}
          onChange={(e) => e.target.value && aoMudarPeriodo({ ...periodo, de: e.target.value })} />
      </label>
      <label>
        <span className="rotulo">Até</span>
        <input type="date" value={periodo.ate} min={periodo.de} max={somaDias(hojeSP(), 1)}
          onChange={(e) => e.target.value && aoMudarPeriodo({ ...periodo, ate: e.target.value })} />
      </label>
    </div>
  );
}
