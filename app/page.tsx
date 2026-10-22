"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe } from "@/lib/telas";
import Visao from "@/components/telas/Visao";
import Gestao from "@/components/telas/Gestao";

// A primeira tela responde "como estamos hoje". O resumo é o que todo mundo vê;
// a operação do dia, com lead novo, requentado e conversa, é leitura de diretoria.
const ABAS: Aba[] = telasDe("hoje");

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
