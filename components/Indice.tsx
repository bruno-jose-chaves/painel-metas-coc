"use client";
import { useEffect, useState } from "react";

type Secao = { id: string; nome: string };

// Barra de seções da tela. Ela não é decoração: as telas do painel têm cinco,
// seis, oito blocos, e sem isso a única forma de ir do primeiro ao último é
// rolar e perder o fio. Aparece depois que o título sai de vista, fica colada
// no topo e marca em qual bloco a pessoa está.
//
// Também é aqui que a numeração dos blocos é acertada. Cada tela escreve o
// número à mão no seu próprio arquivo, e depois que as telas viraram abas de
// cinco áreas isso passou a repetir número e pular número. Renumerar lendo a
// página resolve em um lugar só, e nenhuma tela precisa saber a ordem.
export default function Indice() {
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [atual, setAtual] = useState<string>("");
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    let observador: IntersectionObserver | null = null;

    const ler = () => {
      const hs = Array.from(main.querySelectorAll("h2"));
      const achadas: Secao[] = hs.map((h, i) => {
        // Escrever sempre, mesmo o mesmo valor, troca o nó de texto e acorda o
        // MutationObserver de novo, o que vira laço infinito. Só mexe se mudou.
        const idx = h.querySelector(".idx");
        const numero = String(i + 1).padStart(2, "0");
        if (idx && idx.textContent !== numero) idx.textContent = numero;
        const nome = (h.textContent ?? "").replace(/^\d+\s*/, "").trim();
        const id = "s" + (i + 1);
        if (h.id !== id) h.id = id;
        return { id, nome };
      });
      setSecoes((antes) =>
        antes.length === achadas.length && antes.every((a, i) => a.nome === achadas[i].nome)
          ? antes
          : achadas,
      );

      observador?.disconnect();
      observador = new IntersectionObserver(
        (entradas) => {
          const dentro = entradas.filter((e) => e.isIntersecting);
          if (dentro.length) setAtual(dentro[0].target.id);
        },
        { rootMargin: "-70px 0px -72% 0px" },
      );
      hs.forEach((h) => observador!.observe(h));
    };

    ler();
    const mo = new MutationObserver(() => ler());
    mo.observe(main, { childList: true, subtree: true });

    const aoRolar = () => setVisivel(window.scrollY > 190);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });

    return () => {
      mo.disconnect();
      observador?.disconnect();
      window.removeEventListener("scroll", aoRolar);
    };
  }, []);

  if (secoes.length < 3) return null;

  return (
    <div className={"indice" + (visivel ? " visivel" : "")}>
      <div className="indice-in">
        {secoes.map((s) => (
          <button
            key={s.id}
            className={atual === s.id ? "ativo" : ""}
            onClick={() => {
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {s.nome}
          </button>
        ))}
        <button
          className="topo-de-novo"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
