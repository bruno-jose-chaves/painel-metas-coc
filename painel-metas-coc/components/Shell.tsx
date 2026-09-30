"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const MENU = [
  { href: "/", nome: "Visão geral" },
  { href: "/campanha/", nome: "Campanha", breve: true },
  { href: "/vendas/", nome: "Vendas", breve: true },
  { href: "/time/", nome: "Time comercial", breve: true },
  { href: "/leads/", nome: "Leads", breve: true },
  { href: "/configuracao/", nome: "Configuração" },
];

type Estado = "carregando" | "sem_sessao" | "nao_autorizado" | "ok";

export default function Shell({ children }: { children: (ctx: { admin: boolean; session: Session }) => React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let vivo = true;
    async function checar(s: Session | null) {
      if (!vivo) return;
      if (!s) { setEstado("sem_sessao"); router.replace("/login/"); return; }
      setSession(s);
      const [{ data: aut }, { data: adm }] = await Promise.all([supabase.rpc("is_autorizado"), supabase.rpc("is_admin")]);
      if (!vivo) return;
      setAdmin(!!adm);
      setEstado(aut ? "ok" : "nao_autorizado");
    }
    supabase.auth.getSession().then(({ data }) => checar(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => checar(s));
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, [router]);

  const sair = async () => { await supabase.auth.signOut(); router.replace("/login/"); };

  if (estado === "carregando" || estado === "sem_sessao")
    return <div className="centro"><span className="rotulo">Carregando</span></div>;

  if (estado === "nao_autorizado")
    return (
      <div className="centro"><div className="login">
        <div className="rotulo">Acesso não liberado</div>
        <h1>Quase lá.</h1>
        <p className="mudo">O e-mail <b>{session?.user.email}</b> ainda não está na lista de acesso do painel. Peça a liberação para a diretoria.</p>
        <button className="btn claro" onClick={sair}>Sair</button>
      </div></div>
    );

  return (
    <>
      <header className="topo"><div className="topo-in">
        <a className="marca" href="/">COC <span>METAS</span></a>
        <nav className="nav">
          {MENU.map((m) => (
            <a key={m.href} href={m.href} className={(path === m.href || path + "/" === m.href ? "ativo " : "") + (m.breve ? "off" : "")}
               title={m.breve ? "Em construção" : undefined}>{m.nome}</a>
          ))}
        </nav>
        <button className="sair" onClick={sair}>Sair</button>
      </div></header>
      <main>{children({ admin, session: session! })}</main>
    </>
  );
}
