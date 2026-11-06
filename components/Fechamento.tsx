"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import FechamentoLista from "@/components/FechamentoLista";
import { useUltima } from "@/lib/consulta";
import { brl, num, pct } from "@/lib/formato";

// De onde veio quem fechou.
//
// O painel já dizia quantas matrículas saíram e quem vendeu. O que faltava era
// a pergunta de marketing: essa gente já era nossa ou chegou agora?
//
// São três relógios de propósito, porque a diferença entre eles é a informação.
// Os dois primeiros andam quase juntos e por isso parecem o mesmo: a conversa e
// o card nascem no mesmo dia na maior parte dos casos. O terceiro é o que muda
// a leitura, porque ele não começa no card nem na conversa, começa na primeira
// vez que a pessoa existiu em qualquer base nossa.
//
// A fonte do CRM ficou de fora: 87,7% das negociações de 2026 estão sem fonte
// preenchida, contra 11,7% sem campanha. Agrupar por um campo vazio em nove de
// cada dez casos não é leitura, é ruído com aparência de número.

type Linha = {
  grupo: string; ordem: number; matriculas: number; fatia: number; faturamento: number;
  ticket: number | null; dias_fechar: number | null; dias_contato: number | null;
  dias_base: number | null; sem_rastro: number;
};

const VISTAS = [
  { id: "faixa", nome: "Por tempo de negociação" },
  { id: "campanha", nome: "Por campanha do CRM" },
] as const;
type Vista = (typeof VISTAS)[number]["id"];

const dias = (v: number | null) => (v == null ? "-" : num(v) + (Number(v) === 1 ? " dia" : " dias"));

export default function Fechamento({
  de, ate, produto, campanha,
}: { de: string; ate: string; produto?: string | null; campanha?: string | null }) {
  const ultima = useUltima();
  const [vista, setVista] = useState<Vista>("faixa");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [gaveta, setGaveta] = useState<{ titulo: string; params: Record<string, unknown> } | null>(null);

  useEffect(() => {
    setLinhas(null);
    ultima("fechamento", supabase.rpc("painel_fechamento_origem", {
      p_de: de, p_ate: ate, p_produto: produto ?? null, p_campanha: campanha ?? null, p_por: vista,
    }), ({ data }) => setLinhas((data as Linha[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate, produto, campanha, vista]);

  const total = (linhas ?? []).reduce((s, l) => s + Number(l.matriculas), 0);
  const maior = Math.max(1, ...(linhas ?? []).map((l) => Number(l.matriculas)));
  const semRastro = (linhas ?? []).reduce((s, l) => s + Number(l.sem_rastro), 0);

  const abrir = (g: string) => setGaveta({
    titulo: g,
    params: { p_de: de, p_ate: ate, p_produto: produto ?? null, p_campanha: campanha ?? null,
              p_por: vista, p_grupo: g },
  });

  return (
    <>
      <div className="secao-topo">
        <h2><span className="idx" /> De onde veio quem fechou</h2>
        <div className="atalhos">
          {VISTAS.map((v) => (
            <button key={v.id} className={vista === v.id ? "ativo" : ""} onClick={() => setVista(v.id)}>
              {v.nome}
            </button>
          ))}
        </div>
      </div>
      <p className="nota">
        Quem matriculou no período, olhado pela história da pessoa e não pela venda. Serve para separar
        venda que a campanha desta semana trouxe de venda que a base já tinha: são duas e pedem verba
        em lugares diferentes. Clique no número de matrículas para ver a lista uma por uma e conferir se
        a mediana conta a verdade.
        <Ajuda titulo="Os três relógios, e por que os dois primeiros parecem iguais"
          fontes={["Matrículas, valor e data: planilha comercial",
                   "Negócio de origem e campanha: RD Station CRM, pela negociação ligada à venda",
                   "Ligação venda e negócio: e-mail, telefone e nome normalizados",
                   "Conversando há: Pigeon Post, pelo telefone, com histórico a partir de 04/03/2026",
                   "Na base há: o mais antigo entre contato criado no RD (desde 19/09/2024), conversão de formulário, primeira conversa e compra anterior"]}>
          <b>Negócio aberto há</b> conta do card criado no CRM até a matrícula: é o ciclo que o comercial
          trabalha, do card aberto até o fechamento. <b>Conversando há</b> conta da primeira conversa de
          WhatsApp até a matrícula. Os dois andam quase juntos e por isso parecem a mesma informação,
          mas não são: existe conversa meses antes de alguém abrir card, e existe card aberto por lista,
          sem nenhuma conversa, e aí um dos dois fica vazio.
          <br /><br />
          <b>Na base há</b> é o relógio do marketing, e é o que muda a leitura. Ele não começa no card
          nem na conversa: começa na primeira vez que a pessoa existiu em qualquer base nossa, seja o
          cadastro de contato criado no RD, uma conversão de formulário, uma conversa antiga ou uma
          compra anterior. Vale a mais antiga das quatro. Quando ele é muito maior que os outros dois, a
          venda não nasceu da campanha daquela semana: nasceu de alguém que já estava com a gente.
          <br /><br />
          Todos os três valores são <b>mediana</b>, o caso do meio, porque um lead de dois anos atrás
          puxaria qualquer média. Por isso vale abrir a lista. Os três relógios só olham o que aconteceu
          antes da matrícula, e o <b>na base há</b> está limitado a 19/09/2024, que é onde começa o
          cadastro de contato que o painel recebe: quem é cliente desde antes disso aparece mais novo do
          que é.
        </Ajuda>
      </p>

      {!linhas ? <p className="rotulo">Carregando</p> : linhas.length === 0 ? (
        <p className="mudo">Nenhuma matrícula no período.</p>
      ) : (
        <>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>{vista === "faixa" ? "Tempo de negociação" : "Campanha no CRM"}</th>
                  <th className="n">Matrículas</th>
                  <th style={{ minWidth: 110 }}>Fatia</th>
                  <th className="n">Faturamento</th>
                  <th className="n">Ticket</th>
                  {vista !== "faixa" && <th className="n">Negócio aberto há</th>}
                  <th className="n">Conversando há</th>
                  <th className="n">Na base há</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.grupo} className={l.grupo === "Sem negócio no CRM" ? "fora" : undefined}>
                    <td><b>{l.grupo}</b></td>
                    <td className="n abre" title="Ver as matrículas uma por uma"
                        onClick={() => abrir(l.grupo)}>
                      <b>{num(l.matriculas)}</b>
                    </td>
                    <td>
                      <div className="mini" title={pct(Number(l.fatia))}>
                        <i style={{ width: `${(Number(l.matriculas) / maior) * 100}%` }} />
                      </div>
                      <div className="ids num">{pct(Number(l.fatia))}</div>
                    </td>
                    <td className="n num">{brl(l.faturamento)}</td>
                    <td className="n num mudo">{l.ticket == null ? "-" : brl(l.ticket)}</td>
                    {vista !== "faixa" && <td className="n num">{dias(l.dias_fechar)}</td>}
                    <td className="n num">{dias(l.dias_contato)}</td>
                    <td className="n num"><b>{dias(l.dias_base)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><b>Total</b></td>
                  <td className="n"><b>{num(total)}</b></td>
                  <td />
                  <td className="n num">
                    <b>{brl((linhas ?? []).reduce((s, l) => s + Number(l.faturamento), 0))}</b>
                  </td>
                  <td colSpan={vista !== "faixa" ? 4 : 3} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="rodape">
            {semRastro > 0 ? (
              <>
                {num(semRastro)} matrícula{semRastro > 1 ? "s" : ""} do período não tem negócio nenhum no
                CRM: é venda que entrou sem passar por lá, quase sempre compra direta pelo site, ou venda
                com dado diferente nos dois lugares. Ela aparece na linha própria e não some da conta.{" "}
              </>
            ) : (
              <>Toda matrícula do período tem negócio ligado no CRM. </>
            )}
            A fonte do CRM ficou de fora deste bloco de propósito.
            <Ajuda titulo="Por que não existe visão por fonte aqui"
              fontes={["RD Station CRM, negociações criadas em 2026, fora do funil de pré-vendas"]}>
              Das 10.029 negociações de 2026, <b>87,7% estão sem fonte preenchida</b>, contra 11,7% sem
              campanha. Agrupar por um campo que está vazio em nove de cada dez casos joga quase tudo em
              uma linha de "sem origem" e dá aparência de número a um dado que não existe. Enquanto a
              fonte não for preenchida na entrada do lead, a campanha é a leitura de origem que sustenta
              decisão.
            </Ajuda>
          </p>
        </>
      )}

      {gaveta && (
        <FechamentoLista titulo={gaveta.titulo} params={gaveta.params} aoFechar={() => setGaveta(null)} />
      )}
    </>
  );
}
