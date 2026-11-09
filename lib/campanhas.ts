"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { emCache } from "@/lib/cache";

// A lista de campanhas era buscada em sete telas, cada uma com a sua seleção de
// colunas, e em toda navegação. A view tem vinte linhas: uma consulta só,
// guardada por um minuto, serve as sete.
export type Campanha = {
  id: string; nome: string; produto_id: string | null;
  inicio: string; fim: string;
  situacao: string; meta_ativa: number | null;
  alunos: number; faturamento: number;
  meta_alunos: number | null; meta_alunos_hoje: number;
  [k: string]: unknown;
};

export const buscarCampanhas = <T = Campanha>() =>
  emCache<T[]>("campanhas", 60, () =>
    supabase.from("resumo_campanhas").select("*").order("inicio")
      .then(({ data }) => (data as T[]) ?? []));

// A última leitura da planilha, que fica no carimbo de várias telas.
export const buscarUltimaSync = () =>
  emCache("sync:planilha", 60, () =>
    supabase.from("sincronizacoes").select("terminado_em")
      .eq("status", "ok").like("fonte", "planilha:%")
      .order("terminado_em", { ascending: false }).limit(1)
      .then(({ data }) => (data?.[0]?.terminado_em as string | null) ?? null));

export function useCampanhas(volta = 0) {
  const [lista, setLista] = useState<Campanha[] | null>(null);
  useEffect(() => { buscarCampanhas().then(setLista); }, [volta]);
  return lista;
}
