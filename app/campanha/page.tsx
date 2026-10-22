"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe } from "@/lib/telas";
import Campanha from "@/components/telas/Campanha";
import Historico from "@/components/Historico";
import Upsell from "@/components/Upsell";
import Comparar from "@/components/Comparar";

const ABAS: Aba[] = telasDe("campanha");

function Tela() {
  const { aba, escolher } = useAba(ABAS);
  return (
    <>
      <SubAbas abas={ABAS} aba={aba} aoEscolher={escolher} />
      {aba === "atual" && <Campanha />}
      {aba === "historico" && <Historico />}
      {aba === "comparar" && <Comparar />}
      {aba === "upsell" && <Upsell />}
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Tela />}</Shell>;
}
