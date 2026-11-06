"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe, type Papel } from "@/lib/telas";
import Time from "@/components/telas/Time";
import Lancamentos from "@/components/telas/Lancamentos";
import Agente from "@/components/telas/Agente";
import Atendimento from "@/components/telas/Atendimento";
import Qualidade from "@/components/telas/Qualidade";
import Performance from "@/components/telas/Performance";

// Time e Lançamentos respondem à mesma pergunta por ângulos diferentes: quem
// está entregando, e o que exatamente foi vendido.
// Performance individual e leitura de diretoria: mostra nome, carteira e
// comissao de todo mundo. Quem vende ve a propria versao disso em Meu painel.
function Tela({ admin, papel }: { admin: boolean; papel: Papel }) {
  const ABAS: Aba[] = telasDe("comercial", papel);
  const { aba, escolher } = useAba(ABAS);
  return (
    <>
      <SubAbas abas={ABAS} aba={aba} aoEscolher={escolher} />
      {aba === "time" && <Time />}
      {aba === "lancamentos" && <Lancamentos />}
      {aba === "agente" && <Agente />}
      {aba === "qualidade" && <Qualidade />}
      {aba === "atendimento" && <Atendimento />}
      {aba === "performance" && admin && <Performance />}
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin, papel }) => <Tela admin={admin} papel={papel} />}</Shell>;
}
