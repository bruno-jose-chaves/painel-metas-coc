"use client";
import { useState } from "react";
import Escapando from "@/components/telas/Escapando";
import FunilWhats from "@/components/telas/FunilWhats";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";

// Eram duas telas em cima do mesmo vazamento: a fila do que ninguém está
// olhando e o diagnóstico de conversa que não virou card. Como os recortes são
// diferentes de propósito (a fila é a foto de agora, o diagnóstico segue o
// período escolhido), as duas davam números diferentes para a mesma coisa e
// cada uma precisava de um parágrafo explicando a outra. Mesmo lugar, dois
// modos, e a explicação vira uma frase só.
const MODOS = [
  { id: "fila", nome: "Fila para trabalhar" },
  { id: "diagnostico", nome: "Diagnóstico" },
] as const;

type Modo = (typeof MODOS)[number]["id"];

export default function Atendimento() {
  const { em, minutos } = useAtualizacao();
  const [modo, setModo] = useState<Modo>("fila");

  return (
    <>
      <div className="rotulo">Atendimento</div>
      <h1>O que está escapando</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <div className="filtros">
        <div className="atalhos">
          {MODOS.map((m) => (
            <button key={m.id} className={modo === m.id ? "ativo" : ""} onClick={() => setModo(m.id)}>
              {m.nome}
            </button>
          ))}
        </div>
        <span className="mudo" style={{ marginLeft: "auto", alignSelf: "center" }}>
          {modo === "fila"
            ? "Nome, dono e o que fazer, na foto de agora."
            : "O tamanho do buraco no período que você escolher."}
        </span>
      </div>

      {modo === "fila" ? <Escapando embutido /> : <FunilWhats embutido />}
    </>
  );
}
