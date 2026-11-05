"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import { useUltima } from "@/lib/consulta";
import { brl, num, pct } from "@/lib/formato";

// De onde veio quem fechou.
//
// O painel já dizia quantas matrículas saíram e quem vendeu. O que faltava era
// a pergunta de marketing: essa gente já era nossa ou chegou agora? Comprou no
// impulso ou namorou a COC por seis meses?
//
// São três relógios de propósito, porque a diferença entre eles é a informação:
// o tempo da negociação é o ciclo que o comercial controla, e o tempo na base é
// quanto a captação segurou a pessoa antes de ela abrir negociação. Quando o
// segundo é muito maior que o primeiro, a venda não nasceu do anúncio daquela
// semana: nasceu de alguém que já estava ali.

type Linha = {
  grupo: string; ordem: number; matriculas: number; fatia: number; faturamento: number;
  ticket: number | null; dias_fechar: number | null; dias_contato: number | null;
  dias_base: number | null; sem_rastro: number;
};

const VISTAS = [
  { id: "faixa", nome: "Por tempo até fechar" },
  { id: "fonte", nome: "Por fonte" },
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
        Quem matriculou no período, olhado pela história da pessoa e não pela venda: quanto tempo ela
        levou para fechar, de onde veio, por qual campanha, e há quanto tempo já falava com a gente.
        Serve para separar venda que o anúncio desta semana trouxe de venda que a base já tinha.
        <Ajuda titulo="Os três relógios, e por que eles discordam"
          fontes={["Matrículas, valor e data: planilha comercial",
                   "Negócio de origem, fonte e campanha: RD Station CRM, pela negociação ligada à venda",
                   "Ligação venda e negócio: e-mail, telefone e nome normalizados",
                   "Primeira conversa: Pigeon Post, pelo telefone, com histórico a partir de 01/08/2026",
                   "Na base desde: o mais antigo entre primeira negociação, primeira conversa e compra anterior"]}>
          <b>Levou para fechar</b> conta da negociação que originou a venda até a matrícula: é o ciclo
          que o comercial controla. <b>Em contato há</b> conta da primeira conversa de WhatsApp até a
          matrícula. <b>Na base há</b> conta do primeiro registro da pessoa em qualquer base nossa, seja
          negociação antiga, conversa antiga ou compra anterior.
          <br /><br />
          A diferença entre o primeiro e o terceiro é a informação que interessa: quando <b>na base há</b>
          é muito maior que <b>levou para fechar</b>, a venda não nasceu da campanha daquela semana,
          nasceu de alguém que já estava com a gente e finalmente decidiu. Todos os três valores são
          <b> mediana</b>, o caso do meio, porque um lead de dois anos atrás puxaria qualquer média.
          <br /><br />
          Os três relógios só olham o que aconteceu antes da matrícula. O histórico de conversa começa em
          01/08/2026, então em venda mais antiga o <b>em contato há</b> aparece vazio em vez de errado.
        </Ajuda>
      </p>

      {!linhas ? <p className="rotulo">Carregando</p> : linhas.length === 0 ? (
        <p className="mudo">Nenhuma matrícula no período.</p>
      ) : (
        <>
          {vista === "fonte" && semRastro === 0 && linhas[0]?.grupo === "Sem origem"
            && Number(linhas[0].fatia) > 0.5 && (
            <p className="aviso-leve ruim">
              {pct(Number(linhas[0].fatia))} das matrículas do período vêm de negócio <b>sem fonte
              preenchida</b> no CRM. Enquanto esse campo não for preenchido, nenhuma leitura de canal
              deste painel vale decisão de verba: a visão por campanha, ao lado, é a que dá para usar.
            </p>
          )}
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>{vista === "faixa" ? "Levou para fechar" : vista === "fonte" ? "Fonte" : "Campanha no CRM"}</th>
                  <th className="n">Matrículas</th>
                  <th style={{ minWidth: 110 }}>Fatia</th>
                  <th className="n">Faturamento</th>
                  <th className="n">Ticket</th>
                  {vista !== "faixa" && <th className="n">Levou para fechar</th>}
                  <th className="n">Em contato há</th>
                  <th className="n">Na base há</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.grupo} className={l.grupo === "Sem negócio no CRM" || l.grupo === "Sem origem" ? "fora" : undefined}>
                    <td><b>{l.grupo}</b></td>
                    <td className="n"><b>{num(l.matriculas)}</b></td>
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
                com dado diferente nos dois lugares. Ela aparece na linha própria e não some da conta.
              </>
            ) : (
              <>Toda matrícula do período tem negócio ligado no CRM.</>
            )}
          </p>
        </>
      )}
    </>
  );
}
