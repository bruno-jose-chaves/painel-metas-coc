"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Time from "@/components/telas/Time";
import Vendas from "@/components/telas/Vendas";
import Sugestoes from "@/components/Sugestoes";

// Time e Lançamentos respondem à mesma pergunta por ângulos diferentes: quem
// está entregando, e o que exatamente foi vendido.
const ABAS: Aba[] = [
  { id: "time", nome: "Time", oque: "Quanto cada vendedor recebeu de lead, quanto fechou e quanto está pendurado, com comissão e bônus no período." },
  { id: "lancamentos", nome: "Lançamentos", oque: "A matrícula como ela foi lançada: aluno, curso, valor de tabela, desconto e vendedor." },
  { id: "conferir", nome: "O que conferir", oque: "Casos que o painel marcou como estranhos e precisam de olho humano: duplicado, sem curso, valor fora da faixa." },
];

function Tela() {
  const { aba, escolher } = useAba(ABAS);
  return (
    <>
      <SubAbas abas={ABAS} aba={aba} aoEscolher={escolher} />
      {aba === "time" && <Time />}
      {aba === "lancamentos" && <Vendas />}
      {aba === "conferir" && <Sugestoes />}
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Tela />}</Shell>;
}
