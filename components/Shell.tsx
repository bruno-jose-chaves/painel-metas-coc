"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Cinco áreas, no caminho que a pergunta faz: como estamos hoje, como vai a
// campanha, quem está vendendo, de onde vem o lead, e o que é ajuste de
// sistema. Antes eram nove abas, o que obrigava a lembrar em qual delas estava
// cada número.
const MENU: { href: string; nome: string; soAdmin?: boolean }[] = [
  { href: "/", nome: "Hoje" },
  { href: "/campanha/", nome: "Campanha" },
  { href: "/comercial/", nome: "Comercial" },
  { href: "/marketing/", nome: "Marketing" },
  { href: "/ajustes/", nome: "Ajustes", soAdmin: true },
];

type Estado = "carregando" | "sem_sessao" | "nao_autorizado" | "ok";

export default function Shell({ children }: { children: (ctx: { admin: boolean; session: Session }) => React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState(false);
  const [menu, setMenu] = useState(false);
  // Quantas vezes a sessão voltou vazia em sequência. Tropeço de renovação de
  // token acontece, principalmente quando o computador dorme, e jogar a pessoa
  // para o login no primeiro tropeço é o que fazia o painel desconectar sozinho.
  const vazias = useRef(0);

  useEffect(() => {
    let vivo = true;

    async function checar(s: Session | null) {
      if (!vivo) return;
      if (!s) {
        vazias.current += 1;
        // Três tentativas de 600ms antes de desistir. Isso dá tempo de uma
        // renovação de token terminar, que é o que tropeça quando o computador
        // dorme, sem deixar quem não está logado preso numa tela de carregando.
        if (vazias.current >= 3) {
          setEstado("sem_sessao");
          router.replace("/login/");
          return;
        }
        setTimeout(async () => {
          if (!vivo) return;
          const { data } = await supabase.auth.getSession();
          checar(data.session);
        }, 600);
        return;
      }
      vazias.current = 0;
      setSession(s);
      const [{ data: aut }, { data: adm }] = await Promise.all([
        supabase.rpc("is_autorizado"),
        supabase.rpc("is_admin"),
      ]);
      if (!vivo) return;
      setAdmin(!!adm);
      setEstado(aut ? "ok" : "nao_autorizado");
    }

    supabase.auth.getSession().then(({ data }) => checar(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      // Renovação de token não é mudança de quem está logado: não refaz a
      // checagem toda, só guarda a sessão nova.
      if (evento === "TOKEN_REFRESHED" && s) { vazias.current = 0; setSession(s); return; }
      if (evento === "INITIAL_SESSION" && !s) return;
      checar(s);
    });

    // Ao voltar para a aba, confere a sessão em vez de esperar o próximo erro.
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      supabase.auth.getSession().then(({ data }) => { if (data.session) { vazias.current = 0; setSession(data.session); } });
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [router]);

  useEffect(() => { setMenu(false); }, [path]);

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

  const ativo = (href: string) =>
    href === "/" ? path === "/" : path === href || path + "/" === href;

  return (
    <>
      <header className="topo"><div className="topo-in">
        <a className="marca" href="/">COC <span>Metas</span></a>
        <button className="menu-botao" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? "×" : "≡"}
        </button>
        <nav className={"nav" + (menu ? " aberto" : "")}>
          {MENU.filter((m) => admin || !m.soAdmin).map((m) => (
            <a key={m.href} href={m.href} className={ativo(m.href) ? "ativo" : ""}>{m.nome}</a>
          ))}
        </nav>
        <button className="sair" onClick={sair}>Sair</button>
      </div></header>
      <main>{children({ admin, session: session! })}</main>
    </>
  );
}
