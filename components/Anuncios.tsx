"use client";
import { useEffect, useState } from "react";
import FiltroCampanha, { type Campanha } from "@/components/FiltroCampanha";
import { supabase } from "@/lib/supabase";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num } from "@/lib/formato";
import { ultimosDias, type Periodo } from "@/lib/periodo";

type Anuncio = {
  anuncio: string; rede: string | null; anuncio_id: string | null;
  pessoas: number; conversas: number; matriculas: number;
  faturamento: number; pessoas_por_matricula: number | null; link: string | null;
};

const REDE: Record<string, string> = {
  INSTAGRAM: "Instagram", FACEBOOK: "Facebook", "WHATSAPP BUSINESS APP": "WhatsApp",
};

const nomeRede = (r: string | null) => {
  if (!r) return "-";
  if (REDE[r]) return REDE[r];
  // O Pigeon às vezes devolve "AD - 1202513780...", que é o id da peça.
  if (r.startsWith("AD - ")) return "Anúncio avulso";
  return r;
};

export default function Anuncios() {
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(60));
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [campanha, setCampanha] = useState<string | null>(null);
  const [lista, setLista] = useState<Anuncio[] | null>(null);

  useEffect(() => {
    supabase.from("resumo_campanhas").select("id,nome,inicio,fim,produto_id").order("inicio")
      .then(({ data }) => setCampanhas((data as Campanha[]) ?? []));
  }, [volta]);

  const produto = campanhas.find((c) => c.id === campanha)?.produto_id ?? null;

  useEffect(() => {
    setLista(null);
    supabase.rpc("painel_anuncios", { p_de: periodo.de, p_ate: periodo.ate, p_produto: produto })
      .then(({ data }) => setLista((data as Anuncio[]) ?? []));
  }, [periodo, produto, volta]);

  const pessoas = lista?.reduce((s, a) => s + Number(a.pessoas), 0) ?? 0;
  const matriculas = lista?.reduce((s, a) => s + Number(a.matriculas), 0) ?? 0;
  const faturamento = lista?.reduce((s, a) => s + Number(a.faturamento), 0) ?? 0;
  const maior = Math.max(1, ...(lista ?? []).map((a) => Number(a.pessoas)));

  return (
    <>
      <div className="rotulo">027 · Anúncios</div>
      <h1>Quem chega pelo anúncio</h1>
      <p className="mudo num" style={{ marginTop: -8, marginBottom: 16 }}>
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <FiltroCampanha
        campanhas={campanhas}
        campanha={campanha}
        aoMudarCampanha={setCampanha}
        periodo={periodo}
        aoMudarPeriodo={setPeriodo}
      />

      <div className="faixa">
        <div>
          <div className="rotulo">Pessoas que chamaram</div>
          <div className="valor num">{lista ? num(pessoas) : "..."}</div>
          <div className="mudo">clicaram no anúncio e abriram conversa</div>
        </div>
        <div>
          <div className="rotulo">Matrículas</div>
          <div className="valor num">{lista ? num(matriculas) : "..."}</div>
        </div>
        <div>
          <div className="rotulo">Faturamento</div>
          <div className="valor num">{lista ? brl(faturamento) : "..."}</div>
        </div>
        <div>
          <div className="rotulo">Pessoas por matrícula</div>
          <div className="valor num">{lista && matriculas ? (pessoas / matriculas).toFixed(1).replace(".", ",") : "-"}</div>
          <div className="mudo">quanto menor, melhor</div>
        </div>
      </div>

      <h2><span className="idx">028</span> Peça por peça</h2>
      <p className="mudo" style={{ marginBottom: 16 }}>
        O lead de anúncio de clique para WhatsApp não passa por formulário, então o RD não o vê. Quem registra é o
        Pigeon, que guarda a peça que originou a conversa. A matrícula é ligada por telefone, até sessenta dias depois
        do contato.
      </p>
      {!lista ? <p className="rotulo">Carregando</p> : lista.length === 0 ? (
        <p className="mudo">
          Nenhuma conversa de anúncio no período. Só entra conversa que chegou por peça de clique para WhatsApp.
        </p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Peça</th><th>Rede</th><th className="n">Pessoas</th><th>Volume</th>
                <th className="n">Conversas</th><th className="n">Matrículas</th>
                <th className="n">Pessoas por matrícula</th><th className="n">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.anuncio + (a.anuncio_id ?? "")}>
                  <td style={{ maxWidth: 300 }}>
                    <b>{a.anuncio}</b>
                    {a.link && (
                      <div className="rotulo" style={{ marginTop: 3 }}>
                        <a href={a.link} target="_blank" rel="noreferrer">ver a peça</a>
                      </div>
                    )}
                  </td>
                  <td className="mudo">{nomeRede(a.rede)}</td>
                  <td className="n"><b>{num(a.pessoas)}</b></td>
                  <td><div className="mini"><i style={{ width: `${(Number(a.pessoas) / maior) * 100}%` }} /></div></td>
                  <td className="n">{num(a.conversas)}</td>
                  <td className="n">{Number(a.matriculas) > 0 ? <b>{num(a.matriculas)}</b> : "-"}</td>
                  <td className="n">
                    {a.pessoas_por_matricula == null ? "-" : Number(a.pessoas_por_matricula).toFixed(1).replace(".", ",")}
                  </td>
                  <td className="n">{Number(a.faturamento) > 0 ? brl(a.faturamento) : "-"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td><td /><td className="n">{num(pessoas)}</td><td />
                <td className="n">{num(lista.reduce((s, a) => s + Number(a.conversas), 0))}</td>
                <td className="n">{num(matriculas)}</td>
                <td className="n">{matriculas ? (pessoas / matriculas).toFixed(1).replace(".", ",") : "-"}</td>
                <td className="n">{brl(faturamento)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mudo" style={{ marginTop: 14 }}>
        Pessoas por matrícula não é custo: para custo falta a verba de cada peça, que o painel não recebe. O que esta
        coluna diz é quantas conversas a peça precisa gerar para sair uma matrícula, o que já separa peça que traz
        volume de peça que traz aluno.
      </p>
    </>
  );
}
