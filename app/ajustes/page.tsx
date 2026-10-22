"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe } from "@/lib/telas";
import Cadastro from "@/components/telas/Cadastro";
import Configuracao from "@/components/telas/Configuracao";
import Cursos from "@/components/telas/Cursos";

// O que é ajuste de sistema sai do caminho de quem só quer ver número.
const ABAS: Aba[] = telasDe("ajustes");

function Tela({ admin }: { admin: boolean }) {
  const { aba, escolher } = useAba(ABAS);
  return (
    <>
      <SubAbas abas={ABAS} aba={aba} aoEscolher={escolher} />
      {aba === "campanhas" && <Cadastro admin={admin} />}
      {aba === "cursos" && <Cursos admin={admin} />}
      {aba === "sistema" && <Configuracao admin={admin} />}
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Tela admin={admin} />}</Shell>;
}
