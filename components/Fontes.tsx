"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import { dataHora } from "@/lib/formato";

// Saúde das fontes.
//
// O risco que isso cobre não é o painel cair: é o painel continuar de pé
// mostrando número de ontem com cara de número de agora. Quem olha não tem como
// saber. Então cada carga declara de quanto em quanto tempo deveria rodar, e
// quando passa do dobro disso a fonte está fora e o painel avisa.
//
// A lista inteira fica em Ajustes, que é onde se resolve. No resto do site só
// aparece a tarja, e só quando tem algo fora, para não virar enfeite que todo
// mundo aprende a ignorar.

export type Fonte = {
  fonte: string; o_que: string; ultima: string | null; atraso_min: number | null;
  limite_min: number; situacao: "ok" | "atencao" | "fora"; detalhe: string | null;
};

export function useFontes() {
  const [fontes, setFontes] = useState<Fonte[] | null>(null);

  useEffect(() => {
    let vivo = true;
    const ler = () =>
      supabase.rpc("painel_saude_fontes").then(({ data }) => { if (vivo) setFontes((data as Fonte[]) ?? []); });
    ler();
    const t = setInterval(ler, 5 * 60 * 1000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  return fontes;
}

export function tempo(min: number | null) {
  if (min == null) return "nunca";
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

// A tarja. Mora no topo de toda tela e só existe quando alguma fonte está fora.
export function TarjaFontes() {
  const fontes = useFontes();
  const [fechada, setFechada] = useState(false);
  const fora = (fontes ?? []).filter((f) => f.situacao === "fora");
  if (fora.length === 0 || fechada) return null;

  const nomes = fora.map((f) => f.fonte).join(", ");
  return (
    <div className="tarja" role="status">
      <div className="tarja-in">
        <b>Dado desatualizado.</b>{" "}
        {fora.length === 1
          ? <>A fonte <b>{fora[0].fonte}</b> não atualiza há {tempo(fora[0].atraso_min)}.</>
          : <>{fora.length} fontes estão sem atualizar: {nomes}.</>}{" "}
        O que está na tela pode estar velho.
        <a href="/ajustes/?v=sistema">Ver em Ajustes</a>
        <button onClick={() => setFechada(true)} aria-label="Fechar aviso">×</button>
      </div>
    </div>
  );
}

const SELO: Record<string, string> = { ok: "Em dia", atencao: "Atrasada", fora: "Fora" };
const CLASSE: Record<string, string> = { ok: "no_ritmo", atencao: "atencao", fora: "atras" };

// O bloco de Ajustes: a lista inteira, inclusive o que está em dia, porque
// saber que está em dia é metade da informação.
export default function Fontes() {
  const fontes = useFontes();

  return (
    <>
      <h2><span className="idx">008</span> Saúde das fontes</h2>
      <p className="nota">
        De quanto em quanto tempo cada carga deveria rodar, e quando ela rodou pela última vez.
        <Ajuda titulo="Como a situação é decidida"
          fontes={["Marca de tempo de cada carga: tabela sync_estado",
                   "Planilha comercial: tabela vendas, campo atualizado_em",
                   "Pigeon Post: tabela pigeon_sync_estado",
                   "Rotinas do banco: histórico do cron (cron.job_run_details)"]}>
          Dentro do limite a fonte está em dia. Entre uma e duas vezes o limite ela aparece como
          atrasada, que costuma ser uma corrida que demorou. Acima do dobro, ou com a última corrida
          falhando, ela entra como fora e o painel mostra uma tarja em todas as telas, porque a essa
          altura o número que está na tela já não é o de agora.
        </Ajuda>
      </p>
      {!fontes ? <p className="rotulo">Carregando</p> : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>O que alimenta</th>
                <th className="n">Última vez</th>
                <th className="n">Há quanto</th>
                <th className="n">Limite</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {fontes.map((f) => (
                <tr key={f.fonte} className={f.situacao === "fora" ? "fora" : undefined}>
                  <td><b>{f.fonte}</b>{f.detalhe && <div className="ids">{f.detalhe}</div>}</td>
                  <td>{f.o_que}</td>
                  <td className="n">{f.ultima ? dataHora(f.ultima) : "-"}</td>
                  <td className="n">{tempo(f.atraso_min)}</td>
                  <td className="n">{tempo(f.limite_min)}</td>
                  <td><span className={"selo " + CLASSE[f.situacao]}>{SELO[f.situacao]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
