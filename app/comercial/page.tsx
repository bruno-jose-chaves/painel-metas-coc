"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe } from "@/lib/telas";
import Time from "@/components/telas/Time";
import Lancamentos from "@/components/telas/Lancamentos";
import Agente from "@/components/telas/Agente";
import Atendimento from "@/components/telas/Atendimento";
import Qualidade from "@/components/telas/Qualidade";

// Time e Lançamentos respondem à mesma pergunta por ângulos diferentes: quem
// está entregando, e o que exatamente foi vendido.
const ABAS: Aba[] = telasDe("comercial");

function Tela() {
  const { aba, escolher } = useAba(ABAS);
  return (
    <>
      <SubAbas abas={ABAS} aba={aba} aoEscolher={escolher} />
      {aba === "time" && <Time />}
      {aba === "lancamentos" && <Lancamentos />}
      {aba === "agente" && <Agente />}
      {aba === "qualidade" && <Qualidade />}
      {aba === "atendimento" && <Atendimento />}
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Tela />}</Shell>;
}
