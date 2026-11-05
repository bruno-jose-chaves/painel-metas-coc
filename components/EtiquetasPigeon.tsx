"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import Chave from "@/components/Chave";
import { num, dataCurta } from "@/lib/formato";
import { inicioDoAno } from "@/lib/periodo";

// As etiquetas que o time coloca no Pigeon não são enfeite: são elas que o
// painel usa para saber de quem é o contato e que curso a pessoa quer. A
// função que lê isso existia no banco desde outubro e nenhuma tela mostrava,
// então ninguém via quando uma etiqueta nova entrava em uso sem significado
// nenhum para o painel.

type Destino = { tipo: string; valor: string; rotulo: string };
type Linha = {
  etiqueta: string; etiqueta_norm: string; tipo: string | null;
  valor: string | null; pessoas: number; ultima: string | null;
};

const NOME_TIPO: Record<string, string> = {
  vendedor: "Dono do contato", curso: "Curso de interesse", etapa: "Etapa do funil",
};

export default function EtiquetasPigeon({ admin }: { admin?: boolean }) {
  const [lista, setLista] = useState<Linha[] | null>(null);
  const [soSemUso, setSoSemUso] = useState(false);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");

  function carregar() {
    supabase.rpc("painel_etiquetas_whats", { p_desde: inicioDoAno() })
      .then(({ data }) => setLista((data as Linha[]) ?? []));
  }

  useEffect(() => {
    carregar();
    if (admin) {
      supabase.rpc("painel_etiqueta_destinos")
        .then(({ data }) => setDestinos((data as Destino[]) ?? []));
    }
  }, [admin]);

  // Apontar é o que faltava: até aqui a tela só dizia que a etiqueta não tinha
  // uso, e consertar dependia de abrir o banco.
  async function apontar(etiqueta: string) {
    const escolhido = escolha[etiqueta];
    if (!escolhido) return;
    const [tipo, valor] = escolhido.split("|");
    const { error } = await supabase.rpc("apontar_etiqueta_whats", {
      p_etiqueta: etiqueta, p_tipo: tipo, p_valor: valor,
    });
    setAviso(error ? error.message : `"${etiqueta}" passou a valer como ${valor}.`);
    if (!error) { setEscolha({ ...escolha, [etiqueta]: "" }); carregar(); }
  }

  const { mostrar, soltas } = useMemo(() => {
    const l = lista ?? [];
    const sem = l.filter((e) => !e.tipo);
    return { mostrar: soSemUso ? sem : l, soltas: sem.length };
  }, [lista, soSemUso]);

  return (
    <>
      <h2><span className="idx" /> Etiquetas do Pigeon</h2>
      <p className="nota">
        Etiqueta aqui não é enfeite: é ela que diz ao painel de quem é o contato e que curso a
        pessoa quer.
        <Ajuda titulo="O que o painel faz com cada tipo">
          <b>Dono do contato</b> alimenta a fila do que está escapando quando o CRM não tem dono
          registrado. <b>Curso de interesse</b> classifica o lead quando nenhuma outra regra
          pegou. <b>Etapa do funil</b> serve de conferência contra o CRM.
          <br /><br />
          Etiqueta <b>sem uso no painel</b> é etiqueta que o time criou e o painel não sabe ler.
          Ela não quebra nada, só não vira informação. Quando aparecer uma com muita gente, vale
          apontar o que ela significa.
        </Ajuda>
      </p>
      {soltas > 0 && (
        <p className="aviso-leve">
          <b>{num(soltas)}</b> etiqueta{soltas > 1 ? "s" : ""} em uso que o painel não sabe ler.
        </p>
      )}
      <div className="filtros">
        <div className="chaves-filtro">
          <Chave ligada={soSemUso} aoMudar={setSoSemUso}
                 ajuda="Ligado, mostra só as etiquetas que o painel ainda não sabe ler.">
            Só as sem uso no painel
          </Chave>
        </div>
      </div>
      {aviso && <div className="aviso ok">{aviso}</div>}
      {!lista ? <p className="rotulo">Carregando</p> : mostrar.length === 0 ? (
        <p className="mudo">Nenhuma etiqueta registrada no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Etiqueta</th><th>O painel lê como</th><th>Aponta para</th>
                <th className="n">Pessoas</th><th className="n">Última vez</th>
                {admin && <th style={{ minWidth: 260 }}>Apontar</th>}
              </tr>
            </thead>
            <tbody>
              {mostrar.map((e) => (
                <tr key={e.etiqueta} className={e.tipo ? undefined : "fora"}>
                  <td><b>{e.etiqueta_norm || e.etiqueta}</b></td>
                  <td className={e.tipo ? "" : "mudo"}>
                    {e.tipo ? NOME_TIPO[e.tipo] ?? e.tipo : "sem uso no painel"}
                  </td>
                  <td className="mudo">{e.valor ?? ""}</td>
                  <td className="n">{num(e.pessoas)}</td>
                  <td className="n num mudo">{dataCurta(e.ultima)}</td>
                  {admin && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <select
                          value={escolha[e.etiqueta] ?? ""}
                          onChange={(ev) => setEscolha({ ...escolha, [e.etiqueta]: ev.target.value })}
                        >
                          <option value="">{e.tipo ? "Trocar para" : "Escolher"}</option>
                          {["curso", "vendedor", "etapa"].map((t) => (
                            <optgroup key={t} label={NOME_TIPO[t] ?? t}>
                              {destinos.filter((d) => d.tipo === t).map((d) => (
                                <option key={t + d.valor} value={t + "|" + d.valor}>{d.rotulo}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <button className="btn claro" disabled={!escolha[e.etiqueta]}
                                onClick={() => apontar(e.etiqueta)}>
                          Apontar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
