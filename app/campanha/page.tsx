"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe, type Papel } from "@/lib/telas";
import Campanha from "@/components/telas/Campanha";
import Historico from "@/components/Historico";
import Upsell from "@/components/Upsell";
import Comparar from "@/components/Comparar";

// As abas seguem o papel de quem entra, como no Comercial: antes a lista era
// montada sem o papel e mostrava aba que a pessoa não deveria ver.
function Tela({ papel }: { papel: Papel }) {
  const ABAS: Aba[] = telasDe("campanha", papel);
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
  return <Shell>{({ papel }) => <Tela papel={papel} />}</Shell>;
}
