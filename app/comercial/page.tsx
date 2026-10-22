"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Time from "@/components/telas/Time";
import Lancamentos from "@/components/telas/Lancamentos";
import Agente from "@/components/telas/Agente";
import Atendimento from "@/components/telas/Atendimento";
import Qualidade from "@/components/telas/Qualidade";

// Time e Lançamentos respondem à mesma pergunta por ângulos diferentes: quem
// está entregando, e o que exatamente foi vendido.
const ABAS: Aba[] = [
  { id: "time", codigo: 310, nome: "Time", oque: "Quanto cada vendedor recebeu de lead, quanto fechou e quanto está pendurado, com comissão e bônus no período." },
  { id: "lancamentos", codigo: 320, nome: "Lançamentos", oque: "A matrícula como ela foi lançada (aluno, curso, valor de tabela, desconto e vendedor), e o que saiu estranho e vale conferir." },
  { id: "agente", codigo: 330, nome: "Agente de Pré-vendas", oque: "A qualidade do agente: de tudo que ele abriu, quanto respondeu, quanto virou conversa e quanto chegou no comercial." },
  { id: "qualidade", codigo: 340, nome: "Qualidade do lead", oque: "Quem procurou a gente e quem foi procurado, quanto respondeu, quanto esperou pelo atendimento e quanto virou matrícula, por canal." },
  { id: "atendimento", codigo: 350, nome: "O que está escapando", oque: "A fila do que some sem ninguém ver, com nome, dono e o que fazer, e o diagnóstico de conversa que não virou card no CRM." },
];

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
