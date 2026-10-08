"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Campanha from "@/components/telas/Campanha";
import Historico from "@/components/Historico";
import Upsell from "@/components/Upsell";

const ABAS: Aba[] = [
  { id: "atual", nome: "Campanha em curso", oque: "Uma campanha por dentro: meta e projeção, fase a fase, funil do CRM, origem das matrículas e curva diária." },
  { id: "historico", nome: "Histórico entre anos", oque: "O mesmo curso em anos diferentes, com curva sobreposta e variação de alunos, ticket e desconto." },
  { id: "upsell", nome: "Upsell entre cursos", oque: "Quem comprou um curso e comprou outro também. Você escolhe a base e o destino, e o painel compara com o ano anterior." },
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
