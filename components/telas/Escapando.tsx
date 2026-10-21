"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, dataCurta } from "@/lib/formato";

// O que está escapando.
//
// Cada vazamento já existia em algum canto do painel, em tela diferente, com
// recorte diferente. Lead some por quatro caminhos distintos e nenhum deles
// tinha dono na rotina do dia: quem abre o painel de manhã não vai caçar
// problema em quatro telas para descobrir se existe problema.
//
// Aqui é uma fila só, ordenada por quanto custa deixar parado. Fila de
// trabalho, não relatório: tem nome, telefone, dono e o que fazer.

type Linha = {
  tipo: string; prioridade: number; pessoa: string | null; telefone: string | null;
  dono: string; onde: string; dias: number; desde: string;
  ja_e_aluno: boolean; o_que_fazer: string;
};
type Resumo = {
  tipo: string; prioridade: number; quantos: number; mediana_dias: number;
  mais_parado: number; na_fila: boolean; por_dono: Record<string, number> | null;
};

// Quanto custa cada tipo, em uma frase. O número sozinho não move ninguém.
const PORQUE: Record<string, string> = {
  "Pagamento pendente": "O cliente disse que ia comprar e o link foi enviado. É a venda mais perto de acontecer que existe, e está parada.",
  "Conversa sem card": "Falou com o comercial no WhatsApp e não tem negociação nenhuma no CRM. Não aparece em lista, em relatório, nem em follow-up de ninguém.",
  "Negociação parada": "Chegou até a negociação e dormiu. Ou volta para a mesa, ou vira perdida com motivo, que pelo menos ensina alguma coisa.",
  "Qualificação parada": "Base velha que ninguém mexe. Não é tarefa da semana, é faxina, por isso fica fora da fila.",
  "Lead do SDR sem contato": "Lead que entrou no funil de pré-vendas e nunca foi tocado. O volume aqui é grande demais para fila: é decisão de campanha, não de pessoa.",
};

const TIPOS = ["Pagamento pendente", "Conversa sem card", "Negociação parada"];

export default function Escapando() {
  const { volta, em, minutos } = useAtualizacao();
  const [resumo, setResumo] = useState<Resumo[] | null>(null);
  const [fila, setFila] = useState<Linha[] | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("painel_escapando_resumo").then(({ data }) => setResumo((data as Resumo[]) ?? []));
    supabase.rpc("painel_escapando", { p_limite: 400 }).then(({ data }) => setFila((data as Linha[]) ?? []));
  }, [volta]);

  const lista = useMemo(
    () => (fila ?? []).filter((l) => !tipo || l.tipo === tipo),
    [fila, tipo],
  );
  const naFila = (resumo ?? []).filter((r) => r.na_fila);
  const fora = (resumo ?? []).filter((r) => !r.na_fila);
  const total = naFila.reduce((s, r) => s + Number(r.quantos), 0);

  return (
    <>
      <div className="rotulo">O que está escapando</div>
      <h1>A fila do que ninguém está olhando</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <p className="nota">
        Lead some por caminhos diferentes, e cada caminho morava em uma tela diferente. Aqui é uma fila só.
        <Ajuda titulo="Como a fila é montada"
          fontes={["Pagamento pendente e negociação parada: RD Station CRM (rd_negociacoes), campo etapa_desde",
                   "Conversa sem card: conversas do Pigeon cruzadas com negociações do CRM pelo telefone",
                   "Já é aluno: planilha comercial (tabela vendas)"]}>
          A ordem é por quanto custa deixar parado, não por quando apareceu. <b>Pagamento pendente</b> vem
          primeiro porque é a venda mais perto de acontecer. O valor da negociação ficou de fora da
          ordenação de propósito: está preenchido em 1 de 1.991 negociações abertas, e ordenar por um
          campo que o time não preenche é inventar prioridade.
        </Ajuda>
      </p>

      <p className="nota" style={{ marginTop: 0 }}>
        Esta tela não tem filtro de período de propósito: ela é a foto de agora. Card parado está
        parado hoje, e conversa sem card olha sempre os últimos 14 dias.
      </p>

      {!resumo ? <p className="rotulo">Carregando</p> : (
        <>
          <h2><span className="idx" /> O tamanho de cada buraco</h2>
          <div className="faixa">
            {naFila.map((r) => (
              <div key={r.tipo}>
                <div className="rotulo">{r.tipo}</div>
                <div className={"valor num " + (Number(r.quantos) > 0 ? "alerta" : "ok")}>
                  {num(r.quantos)}
                </div>
                <div className="mudo num">
                  parado há {num(r.mediana_dias)} dias na mediana
                </div>
              </div>
            ))}
            <div>
              <div className="rotulo">Na fila</div>
              <div className="valor num">{num(total)}</div>
              <div className="mudo">itens para alguém tocar</div>
            </div>
          </div>

          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="n">Quantos</th>
                  <th className="n">Mediana</th>
                  <th className="n">Mais parado</th>
                  <th>Por dono</th>
                  <th>Por que importa</th>
                </tr>
              </thead>
              <tbody>
                {resumo.map((r) => (
                  <tr key={r.tipo} className={r.na_fila ? "fora" : undefined}>
                    <td>
                      <b>{r.tipo}</b>
                      {!r.na_fila && <div className="ids">fora da fila</div>}
                    </td>
                    <td className="n"><b>{num(r.quantos)}</b></td>
                    <td className="n num">{num(r.mediana_dias)} dias</td>
                    <td className="n mudo num">{num(r.mais_parado)} dias</td>
                    <td className="mudo" style={{ maxWidth: 220 }}>
                      {Object.entries(r.por_dono ?? {}).sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => `${k} ${v}`).join(" · ")}
                    </td>
                    <td className="mudo" style={{ maxWidth: 320 }}>{PORQUE[r.tipo] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="secao-topo">
            <h2><span className="idx" /> A fila</h2>
            <div className="atalhos">
              <button className={tipo === null ? "ativo" : ""} onClick={() => setTipo(null)}>
                Tudo
              </button>
              {TIPOS.map((t) => (
                <button key={t} className={tipo === t ? "ativo" : ""} onClick={() => setTipo(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {!fila ? <p className="rotulo">Carregando</p> : lista.length === 0 ? (
            <p className="mudo">Nada escapando neste recorte.</p>
          ) : (
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Pessoa</th>
                    <th>Telefone</th>
                    <th>Dono</th>
                    <th>Onde está</th>
                    <th className="n">Parado há</th>
                    <th>O que fazer</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((l, i) => (
                    <tr key={l.tipo + (l.telefone ?? "") + l.desde + i}
                        className={l.prioridade === 1 ? "fora" : undefined}>
                      <td>
                        <span className={"selo " + (l.prioridade === 1 ? "atras" : "atencao")}>
                          {l.tipo}
                        </span>
                      </td>
                      <td>
                        <b>{l.pessoa ?? "(sem nome)"}</b>
                        {l.ja_e_aluno && <div className="ids">já é aluno</div>}
                      </td>
                      <td className="num">{l.telefone ?? "-"}</td>
                      <td className="mudo">{l.dono}</td>
                      <td className="mudo">{l.onde}</td>
                      <td className="n num">
                        <b>{num(l.dias)}</b> dias
                        <div className="ids">desde {dataCurta(l.desde)}</div>
                      </td>
                      <td className="mudo" style={{ maxWidth: 280 }}>{l.o_que_fazer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="rodape">
            {fora.length > 0 && (
              <>Fora da fila de propósito: {fora.map((r) => `${r.tipo} (${num(r.quantos)})`).join(", ")}.
              Volume desse tamanho não é tarefa de pessoa, é decisão de base. </>
            )}
            A conversa sem card olha os últimos 14 dias e deixa o dia de hoje de fora, porque card aberto
            no fim do dia é normal.
          </p>
        </>
      )}
    </>
  );
}
