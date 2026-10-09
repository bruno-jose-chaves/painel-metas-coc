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

// Três níveis de destino, do mais duradouro para o mais específico.
//
// Produto é o que vale para sempre: "material rico do ACAFE" é verdade todo
// ano, e a data do lead decide sozinha a turma e a campanha. É o que evita
// repontar tudo em janeiro.
//
// Turma e campanha existem para quando a regra é mesmo daquele ano, como um
// formulário feito para uma campanha específica.
export function useDestinos() {
  const [destinos, setDestinos] = useState<Destino[]>([]);
  useEffect(() => {
    Promise.all([
      supabase.from("produtos").select("id,nome,ordem").order("ordem"),
      supabase.from("resumo_campanhas").select("id,nome,inicio").order("inicio"),
      supabase.rpc("painel_turmas", { p_so_com_venda: false }),
    ]).then(([pr, c, t]) => {
      const produtos = ((pr.data as { id: string; nome: string }[]) ?? [])
        .map((x) => ({ id: "p:" + x.id, nome: x.nome, grupo: "Curso, vale para qualquer ano" }));
      const campanhas = ((c.data as { id: string; nome: string }[]) ?? [])
        .map((x) => ({ id: "c:" + x.id, nome: x.nome, grupo: "Campanhas do painel" }));
      const anoAtual = new Date().getFullYear();
      const turmas = ((t.data as Turma[]) ?? [])
        .filter((x) => x.ano >= anoAtual - 1 && x.ano <= anoAtual + 1)
        .sort((a, b) => b.ano - a.ano || a.nome.localeCompare(b.nome))
        .map((x) => ({ id: "t:" + x.id, nome: x.nome, grupo: "Turmas" }));
      setDestinos([...produtos, ...campanhas, ...turmas]);
    });
  }, []);
  return destinos;
}

// "p:metodo-acafe", "t:semi-extensivo-2026-2" ou "c:acafe-2026-2" viram as
// colunas de destino da regra.
export function partirDestino(valor: string) {
  const id = valor.slice(2);
  if (valor.startsWith("p:")) return { produto_id: id, turma_id: null, campanha_id: null };
  if (valor.startsWith("t:")) return { produto_id: null, turma_id: id, campanha_id: null };
  return { produto_id: null, turma_id: null, campanha_id: id };
}
