"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Campanha from "@/components/telas/Campanha";
import Historico from "@/components/Historico";
import Upsell from "@/components/Upsell";
import Comparar from "@/components/Comparar";

const ABAS: Aba[] = [
  { id: "atual", nome: "Campanha em curso", oque: "Uma campanha por dentro: meta, projeção, escada de fases, funil e origem das matrículas." },
  { id: "historico", nome: "Histórico entre anos", oque: "O mesmo curso em anos diferentes, com curva sobreposta e variação de alunos, ticket e desconto." },
  { id: "comparar", nome: "Turma contra turma", oque: "Duas turmas sobrepostas pelo dia da turma, para ver qual vendeu mais rápido no mesmo ponto." },
  { id: "upsell", nome: "Upsell entre cursos", oque: "Quanto da base de um curso comprou o outro, contra o mesmo recorte do ano anterior." },
];

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
