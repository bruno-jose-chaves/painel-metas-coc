"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Indicador = {
  id: string; nome: string; ajuda: string | null;
  conta_como_lead: boolean; ordem: number;
};
export type Turma = { id: string; nome: string; ano: number; produto_id: string };
export type Destino = { id: string; nome: string; grupo: string };

// A lista de indicadores vivia copiada em três telas. Agora é tabela: quem
// manda é o banco, e acrescentar um indicador não exige mexer em tela nenhuma.
let cache: Indicador[] | null = null;

export function useIndicadores() {
  const [lista, setLista] = useState<Indicador[] | null>(cache);
  useEffect(() => {
    if (cache) return;
    supabase.from("indicadores_captacao").select("*").order("ordem")
      .then(({ data }) => { cache = (data as Indicador[]) ?? []; setLista(cache); });
  }, []);
  return lista ?? [];
}

// Para onde uma regra pode apontar: campanha montada no painel, ou turma, que
// cobre curso vendendo o ano inteiro sem campanha, como o Semiextensivo.
export function useDestinos() {
  const [destinos, setDestinos] = useState<Destino[]>([]);
  useEffect(() => {
    Promise.all([
      supabase.from("resumo_campanhas").select("id,nome,inicio").order("inicio"),
      supabase.rpc("painel_turmas", { p_so_com_venda: false }),
    ]).then(([c, t]) => {
      const campanhas = ((c.data as { id: string; nome: string }[]) ?? [])
        .map((x) => ({ id: "c:" + x.id, nome: x.nome, grupo: "Campanhas do painel" }));
      const anoAtual = new Date().getFullYear();
      const turmas = ((t.data as Turma[]) ?? [])
        .filter((x) => x.ano >= anoAtual - 1 && x.ano <= anoAtual + 1)
        .sort((a, b) => b.ano - a.ano || a.nome.localeCompare(b.nome))
        .map((x) => ({ id: "t:" + x.id, nome: x.nome, grupo: "Turmas" }));
      setDestinos([...campanhas, ...turmas]);
    });
  }, []);
  return destinos;
}

// "c:acafe-2026-2" ou "t:semi-extensivo-2026-2" viram as duas colunas da regra.
export function partirDestino(valor: string) {
  const [tipo, id] = [valor.slice(0, 1), valor.slice(2)];
  return tipo === "t" ? { campanha_id: null, turma_id: id } : { campanha_id: id, turma_id: null };
}
