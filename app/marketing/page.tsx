"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Anuncios from "@/components/Anuncios";
import Etiquetas from "@/components/Etiquetas";
import Leads from "@/components/telas/Leads";
import Pendencias from "@/components/telas/Pendencias";
import { supabase } from "@/lib/supabase";

// Tudo que responde "de onde vem o lead" em um lugar: captação por página,
// anúncio de clique para WhatsApp, e as duas filas de classificação. O marcador
// nas abas mostra quanto está esperando decisão, sem precisar entrar para ver.
function Tela({ admin }: { admin: boolean }) {
  const [paginas, setPaginas] = useState<number | null>(null);
  const [etiquetas, setEtiquetas] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc("painel_pendencias", { p_desde: "2026-08-01", p_minimo: 10 })
      .then(({ data }) => setPaginas(((data as unknown[]) ?? []).length));
    supabase.rpc("painel_etiquetas_pendentes", { p_desde: "2026-01-01", p_minimo: 5 })
      .then(({ data }) => setEtiquetas(((data as unknown[]) ?? []).length));
  }, []);

  const abas: Aba[] = [
    { id: "captacao", nome: "Captação" },
    { id: "anuncios", nome: "Anúncios" },
    { id: "paginas", nome: "Páginas a classificar", marcador: paginas },
    { id: "etiquetas", nome: "Etiquetas a classificar", marcador: etiquetas },
  ];
  const { aba, escolher } = useAba(abas);

  return (
    <>
      <SubAbas abas={abas} aba={aba} aoEscolher={escolher} />
      {aba === "captacao" && <Leads />}
      {aba === "anuncios" && <Anuncios />}
      {aba === "paginas" && <Pendencias admin={admin} />}
      {aba === "etiquetas" && <Etiquetas admin={admin} />}
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Tela admin={admin} />}</Shell>;
}
