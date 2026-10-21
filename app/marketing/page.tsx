"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Anuncios from "@/components/Anuncios";
import Etiquetas from "@/components/Etiquetas";
import Passagem from "@/components/Passagem";
import Leads from "@/components/telas/Leads";
import Pendencias from "@/components/telas/Pendencias";
import { supabase } from "@/lib/supabase";

// Tudo que responde "de onde vem o lead" em um lugar: captação por página,
// anúncio de clique para WhatsApp, e as duas filas de classificação. O marcador
// nas abas mostra quanto está esperando decisão, sem precisar entrar para ver.
function Tela({ admin }: { admin: boolean }) {
  const [paginas, setPaginas] = useState<number | null>(null);
  const [etiquetas, setEtiquetas] = useState<number | null>(null);
  const [passagem, setPassagem] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc("painel_pendencias", { p_desde: "2026-08-01", p_minimo: 10 })
      .then(({ data }) => setPaginas(((data as unknown[]) ?? []).length));
    supabase.rpc("painel_etiquetas_pendentes", { p_desde: "2026-01-01", p_minimo: 5 })
      .then(({ data }) => setEtiquetas(((data as unknown[]) ?? []).length));
    supabase.rpc("painel_passagem_crm", {})
      .then(({ data }) => setPassagem(((data as { situacao: string }[]) ?? [])
        .filter((l) => l.situacao === "alerta").length));
  }, []);

  const abas: Aba[] = [
    { id: "captacao", codigo: 410, nome: "Captação", oque: "Quantos leads entraram por dia e por página, contra a meta de captação da campanha." },
    { id: "anuncios", codigo: 420, nome: "Anúncios", oque: "Quantas conversas cada peça de clique para WhatsApp precisa para sair uma matrícula." },
    { id: "passagem", codigo: 430, nome: "Passagem para o CRM", marcador: passagem, oque: "Se o lead que o formulário captou virou mesmo negociação no comercial." },
    { id: "paginas", codigo: 440, nome: "Páginas a classificar", marcador: paginas, oque: "Páginas que já estão captando e ainda não foram ligadas a um curso." },
    { id: "etiquetas", codigo: 450, nome: "Etiquetas a classificar", marcador: etiquetas, oque: "Etiquetas que chegam do RD e ainda não têm curso de destino apontado." },
  ];
  const { aba, escolher } = useAba(abas);

  return (
    <>
      <SubAbas abas={abas} aba={aba} aoEscolher={escolher} />
      {aba === "captacao" && <Leads />}
      {aba === "anuncios" && <Anuncios />}
      {aba === "passagem" && <Passagem admin={admin} />}
      {aba === "paginas" && <Pendencias admin={admin} />}
      {aba === "etiquetas" && <Etiquetas admin={admin} />}
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Tela admin={admin} />}</Shell>;
}
