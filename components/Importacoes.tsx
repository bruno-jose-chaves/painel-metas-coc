"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import { dataHora, num } from "@/lib/formato";

// A importação da planilha comercial, aba por aba.
//
// A planilha é a fonte firme da venda, e a importação era uma caixa preta:
// linha com data ilegível saía descartada em silêncio, e não havia como saber
// que a venda existia na planilha e não no painel. São 16 linhas assim, todas
// de 2021 e 2022, e ninguém sabia porque nada mostrava.

type Importacao = {
  fonte: string; aba: string; quando: string;
  lidas: number; importadas: number; em_branco: number; rejeitadas: number;
  status: string; motivos: string | null; linhas: string | null; avisos: string | null;
};

export default function Importacoes() {
  const [lista, setLista] = useState<Importacao[] | null>(null);

  useEffect(() => {
    supabase.rpc("painel_importacoes").then(({ data }) => setLista((data as Importacao[]) ?? []));
  }, []);

  const recusadas = (lista ?? []).reduce((s, i) => s + Number(i.rejeitadas ?? 0), 0);
  const motivos = Array.from(new Set((lista ?? []).filter((i) => Number(i.rejeitadas) > 0)
    .flatMap((i) => (i.motivos ?? "").split(", ")).filter(Boolean)));

  return (
    <>
      <h2><span className="idx" /> Importação da planilha</h2>
      <p className="nota">
        Serve para saber se a venda que está na planilha também está no painel. Cada linha é a
        última vez que o painel leu aquela aba: quantas linhas vieram, quantas viraram matrícula e
        quantas ficaram de fora, com o número da linha para corrigir na origem.
        <Ajuda titulo="O que cada coluna conta"
          fontes={["Registro de cada importação: tabela sincronizacoes",
                   "Quem envia: o Apps Script dentro da planilha, a cada 15 minutos",
                   "Abas enviadas: toda aba chamada Vendas <ano>, do ano corrente em diante"]}>
          <b>Lidas</b> é tudo que veio da aba, inclusive linha de formatação vazia. <b>Em branco</b> é
          linha sem nome e sem data, que é só sobra de planilha e não preocupa. <b>Recusada</b> é linha
          que tem conteúdo mas a data não dá para ler: essa é venda que existe na planilha e não existe
          no painel, e o número da linha aparece aqui para ser corrigido na origem.
          <b>Observações da leitura</b> é o que a importação percebeu mas não impediu de entrar:
          número repetido, linha lançada duas vezes, data corrigida à mão.
        </Ajuda>
      </p>

      {recusadas > 0 && (
        <p className="aviso-leve ruim">
          {num(recusadas)} linha{recusadas > 1 ? "s" : ""} recusada{recusadas > 1 ? "s" : ""}
          {motivos.length ? ` (${motivos.join(", ")})` : ""}. São matrículas que estão na planilha e
          não entram em conta nenhuma do painel. Corrigir a linha na planilha resolve na importação
          seguinte.
        </p>
      )}

      {!lista ? <p className="rotulo">Carregando</p> : lista.length === 0 ? (
        <p className="mudo">Nenhuma importação registrada.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Aba</th>
                <th>Última leitura</th>
                <th className="n">Lidas</th>
                <th className="n">Importadas</th>
                <th className="n">Em branco</th>
                <th className="n">Recusadas</th>
                <th>Linhas a corrigir</th>
                <th>Observações da leitura</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.fonte} className={Number(i.rejeitadas) > 0 ? "fora" : undefined}>
                  <td><b>{i.aba}</b></td>
                  <td className="num mudo">{dataHora(i.quando)}</td>
                  <td className="n">{num(i.lidas)}</td>
                  <td className="n"><b>{num(i.importadas)}</b></td>
                  <td className="n mudo">{num(i.em_branco)}</td>
                  <td className="n">
                    {Number(i.rejeitadas) > 0
                      ? <span className="selo atras">{num(i.rejeitadas)}</span>
                      : <span className="mudo">0</span>}
                  </td>
                  <td className="mudo num" style={{ maxWidth: 260 }}>
                    {i.linhas ? `linha ${i.linhas}${i.motivos ? " · " + i.motivos : ""}` : "-"}
                  </td>
                  <td className="mudo" style={{ maxWidth: 420 }} title={i.avisos ?? undefined}>
                    {i.avisos ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="rodape">
        As abas do ano corrente em diante chegam sozinhas a cada 15 minutos, enviadas pelo Apps Script
        que vive dentro da planilha. As de anos fechados só são relidas quando alguém roda a importação
        do histórico, por isso uma recusa antiga pode ficar parada ali mesmo depois de a planilha ter
        sido corrigida.
      </p>
    </>
  );
}
