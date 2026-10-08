"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Visao from "@/components/telas/Visao";
import Gestao from "@/components/telas/Gestao";

// A primeira tela responde "como estamos hoje". O resumo é o que todo mundo vê;
// a operação do dia, com lead novo, requentado e conversa, é leitura de diretoria.
const ABAS: Aba[] = [
  { id: "resumo", nome: "Resumo", oque: "Matrículas, faturamento e leads do período, e o cartão de cada campanha no ar com meta, ritmo e projeção." },
  { id: "operacao", nome: "Operação do dia", oque: "Lead novo, lead requentado e conversa do dia, pessoa por pessoa. Leitura de diretoria." },
];

function Tela({ admin }: { admin: boolean }) {
  const { aba, escolher } = useAba(ABAS);
  if (!admin) return <Visao />;
  return (
    <>
      <SubAbas abas={ABAS} aba={aba} aoEscolher={escolher} />
      {aba === "resumo" ? <Visao /> : <Gestao />}
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Tela admin={admin} />}</Shell>;
}
