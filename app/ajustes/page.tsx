"use client";
import Shell from "@/components/Shell";
import SubAbas, { useAba, type Aba } from "@/components/SubAbas";
import Cadastro from "@/components/telas/Cadastro";
import Configuracao from "@/components/telas/Configuracao";

// O que é ajuste de sistema sai do caminho de quem só quer ver número.
const ABAS: Aba[] = [
  { id: "campanhas", nome: "Campanhas e metas", oque: "Cadastro de campanha, fases, metas de venda e de captação, produtos e turmas por ano." },
  { id: "sistema", nome: "Acesso e integrações", oque: "Quem entra no painel, estado das integrações, última sincronização e saúde dos dados." },
];

function Tela({ admin }: { admin: boolean }) {
  const { aba, escolher } = useAba(ABAS);
  return (
    <>
      <SubAbas abas={ABAS} aba={aba} aoEscolher={escolher} />
      {aba === "campanhas" ? <Cadastro admin={admin} /> : <Configuracao admin={admin} />}
    </>
  );
}

export default function Page() {
  return <Shell>{({ admin }) => <Tela admin={admin} />}</Shell>;
}
