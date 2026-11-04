"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe } from "@/lib/telas";
import Visao from "@/components/telas/Visao";
import Gestao from "@/components/telas/Gestao";
import Meu from "@/components/telas/Meu";

// A primeira tela responde "como estamos hoje". O resumo é o que todo mundo vê;
// a operação do dia, com lead novo, requentado e conversa, é leitura de
// diretoria e por isso fica só para o admin.
//
// Quem vende entra em Meu painel, não no resumo da empresa: a primeira coisa
// que ele precisa é o que é dele e o que está parado na mão dele.
function Tela({ admin }: { admin: boolean }) {
  const abas: Aba[] = admin
    ? telasDe("hoje", true)
    : [...telasDe("hoje", false)].sort((a, b) => (a.id === "meu" ? -1 : b.id === "meu" ? 1 : 0));
  const { aba, escolher } = useAba(abas);
  return (
    <>
      <SubAbas abas={abas} aba={aba} aoEscolher={escolher} />
      {aba === "resumo" && <Visao />}
      {aba === "meu" && <Meu admin={admin} />}
      {aba === "operacao" && <Gestao />}
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Tela admin={admin} />}</Shell>;
}
