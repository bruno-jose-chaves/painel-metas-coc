"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Campanha from "@/components/telas/Campanha";
import Historico from "@/components/Historico";
import Upsell from "@/components/Upsell";

const ABAS: Aba[] = [
  { id: "atual", nome: "Campanha em curso" },
  { id: "historico", nome: "Histórico entre anos" },
  { id: "upsell", nome: "Upsell entre cursos" },
];

function Tela() {
  const { aba, escolher } = useAba(ABAS);
  return (
    <>
      <SubAbas abas={ABAS} aba={aba} aoEscolher={escolher} />
      {aba === "atual" && <Campanha />}
      {aba === "historico" && <Historico />}
      {aba === "upsell" && <Upsell />}
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Tela />}</Shell>;
}
