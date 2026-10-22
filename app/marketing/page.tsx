"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe } from "@/lib/telas";
import Anuncios from "@/components/Anuncios";
import Passagem from "@/components/Passagem";
import Classificar from "@/components/telas/Classificar";
import Leads from "@/components/telas/Leads";
import { supabase } from "@/lib/supabase";

// Tudo que responde "de onde vem o lead" em um lugar: captação por página,
// anúncio de clique para WhatsApp, e a fila de classificação. O marcador nas
// abas mostra quanto está esperando decisão, sem precisar entrar para ver.
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

  // Os nomes e o que cada aba faz moram em lib/telas.ts, junto com o que a
  // busca lê. Aqui só entra o marcador, que é número vivo e muda o dia todo.
  const marcadores: Record<string, number | null> = {
    passagem,
    classificar: paginas == null && etiquetas == null ? null : (paginas ?? 0) + (etiquetas ?? 0),
  };
  const abas: Aba[] = telasDe("marketing").map((t) => ({ ...t, marcador: marcadores[t.id] ?? undefined }));

  const { aba, escolher } = useAba(abas);

  return (
    <>
      <SubAbas abas={abas} aba={aba} aoEscolher={escolher} />
      {aba === "captacao" && <Leads />}
      {aba === "anuncios" && <Anuncios />}
      {aba === "passagem" && <Passagem admin={admin} />}
      {aba === "classificar" && <Classificar admin={admin} paginas={paginas} etiquetas={etiquetas} />}
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Tela admin={admin} />}</Shell>;
}
