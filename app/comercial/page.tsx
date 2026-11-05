"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe } from "@/lib/telas";
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
function Tela({ admin }: { admin: boolean }) {
  const ABAS: Aba[] = telasDe("comercial", admin);
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
  return <Shell>{({ admin }) => <Tela admin={admin} />}</Shell>;
}
