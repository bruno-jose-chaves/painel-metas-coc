"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Time from "@/components/telas/Time";
import Vendas from "@/components/telas/Vendas";
import Sugestoes from "@/components/Sugestoes";
import Agente from "@/components/telas/Agente";
import FunilWhats from "@/components/telas/FunilWhats";
import Escapando from "@/components/telas/Escapando";
import Qualidade from "@/components/telas/Qualidade";

// Time e Lançamentos respondem à mesma pergunta por ângulos diferentes: quem
// está entregando, e o que exatamente foi vendido.
const ABAS: Aba[] = [
  { id: "time", codigo: 310, nome: "Time", oque: "Quanto cada vendedor recebeu de lead, quanto fechou e quanto está pendurado, com comissão e bônus no período." },
  { id: "lancamentos", codigo: 320, nome: "Lançamentos", oque: "A matrícula como ela foi lançada: aluno, curso, valor de tabela, desconto e vendedor." },
  { id: "agente", codigo: 330, nome: "Agente de Pré-vendas", oque: "A qualidade do agente: de tudo que ele abriu, quanto respondeu, quanto virou conversa e quanto chegou no comercial." },
  { id: "whats", codigo: 340, nome: "WhatsApp e CRM", oque: "Quem conversou no WhatsApp e não virou card no CRM, e há quantos dias cada negociação aberta está parada na etapa." },
  { id: "qualidade", codigo: 350, nome: "Qualidade do lead", oque: "Quem procurou a gente e quem foi procurado, quanto respondeu, quanto esperou pelo atendimento e quanto virou matrícula, por canal." },
  { id: "escapando", codigo: 360, nome: "O que está escapando", oque: "A fila do que some sem ninguém ver: pagamento pendente, conversa sem card no CRM e negociação dormindo, com nome, dono e o que fazer." },
  { id: "conferir", codigo: 370, nome: "O que conferir", oque: "Lançamentos que o painel marcou como estranhos e precisam de olho humano." },
];

function Tela() {
  const { aba, escolher } = useAba(ABAS);
  return (
    <>
      <SubAbas abas={ABAS} aba={aba} aoEscolher={escolher} />
      {aba === "time" && <Time />}
      {aba === "lancamentos" && <Vendas />}
      {aba === "agente" && <Agente />}
      {aba === "whats" && <FunilWhats />}
      {aba === "qualidade" && <Qualidade />}
      {aba === "escapando" && <Escapando />}
      {aba === "conferir" && <Sugestoes />}
    </>
  );
}

export default function Page() {
  return <Shell>{() => <Tela />}</Shell>;
}
