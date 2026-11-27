"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import { telasDe, type Papel } from "@/lib/telas";
import Cadastro from "@/components/telas/Cadastro";
import Configuracao from "@/components/telas/Configuracao";
import Cursos from "@/components/telas/Cursos";

// O que é ajuste de sistema sai do caminho de quem só quer ver número.
function Tela({ admin, papel }: { admin: boolean; papel: Papel }) {
  const ABAS: Aba[] = telasDe("ajustes", papel);
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
  return <Shell>{({ admin, papel }) => <Tela admin={admin} papel={papel} />}</Shell>;
}
