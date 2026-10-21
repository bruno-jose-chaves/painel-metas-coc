"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Curva from "@/components/Curva";
import Ajuda from "@/components/Ajuda";
import SeletorPeriodo from "@/components/Periodo";
import { ultimosDias, type Periodo } from "@/lib/periodo";
import { COR } from "@/lib/cores";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, pct, dataCurta } from "@/lib/formato";

// Agente de Pré-vendas, pelo lado da conversa.
//
// O bloco que já existe em Comercial mede pelo CRM: quantos entraram no funil
// SDR e quantos saíram dele. Esta tela responde outra pergunta, que é a que o
// Bruno fez: a qualidade do agente. De tudo que ele abriu, quanto respondeu,
// quanto virou conversa de verdade, quanto ele entregou e quanto fechou.
//
// Volume sozinho premia quem dispara mais. Por isso o número grande aqui nunca
// é o de atendimentos: é a taxa.

type Dia = {
  dia: string; atendidos: number; responderam: number; aqueceu: number;
  entregue_crm: number; entregue_whats: number; matriculas: number;
};

// As duas datas em que cada medição passou a existir. Antes delas o número não
// é zero, é desconhecido, e a tela precisa dizer isso em vez de desenhar uma
// linha no chão.
// O outro lado da mesma história: o funil SDR no CRM. Vinha de um bloco solto
// em Comercial > Time, e estar em duas telas fazia a pessoa ver metade da
// história conforme onde clicasse.
type PreVenda = {
  captados: number; contatados: number; sem_contato: number;
  entregues: number; ganhos: number; ganhos_de_antes: number;
  parados_7d: number; parados_30d: number;
};

const DESDE_MENSAGEM = "2026-10-05";
const DESDE_FUNIL = "2026-09-30";

const soma = (l: Dia[], campo: keyof Dia) =>
  l.reduce((s, d) => s + Number(d[campo] ?? 0), 0);

export default function Agente() {
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(() => ultimosDias(30));
  const [dias, setDias] = useState<Dia[] | null>(null);
  const [crm, setCrm] = useState<PreVenda | null>(null);

  useEffect(() => {
    setDias(null);
    setCrm(null);
    supabase.rpc("painel_apv_dia", { p_de: periodo.de, p_ate: periodo.ate })
      .then(({ data }) => setDias((data as Dia[]) ?? []));
    supabase.rpc("painel_pre_venda", { p_de: periodo.de, p_ate: periodo.ate, p_produto: null })
      .then(({ data }) => setCrm(((data as PreVenda[]) ?? [])[0] ?? null));
  }, [periodo, volta]);

  // Dentro da janela de medição de mensagem, que é o único recorte em que
  // "respondeu" e "aqueceu" significam alguma coisa.
  const medidos = useMemo(
    () => (dias ?? []).filter((d) => d.dia >= DESDE_MENSAGEM),
    [dias],
  );

  const atendidos = soma(medidos, "atendidos");
  const responderam = soma(medidos, "responderam");
  const aqueceu = soma(medidos, "aqueceu");
  const entregueCrm = soma((dias ?? []).filter((d) => d.dia >= DESDE_FUNIL), "entregue_crm");
  const matriculas = soma(medidos, "matriculas");
  const parcial = (dias ?? []).some((d) => d.dia < DESDE_MENSAGEM);

  return (
    <>
      <div className="rotulo">Agente de Pré-vendas</div>
      <h1>O agente está aquecendo ou só disparando?</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <p className="nota">
        De tudo que o agente abriu, quanto o cliente respondeu e quanto chegou no comercial.
        <Ajuda titulo="O que cada número conta"
          fontes={[
            "Atendidos: conversas abertas no número do agente (tabela pigeon_conversas, canal pre_venda)",
            "Responderam e aqueceu: mensagens do cliente (tabela conversas_eventos), a partir de 05/10/2026",
            "Entregue no CRM: negociação que saiu do funil SDR (tabela rd_eventos), a partir de 30/09/2026",
            "Entregue no WhatsApp: o mesmo telefone abriu conversa no número do comercial depois",
            "Virou matrícula: o telefone aparece na planilha comercial depois do atendimento",
          ]}>
          <b>Atendido</b> é toda conversa que o agente abriu. <b>Respondeu</b> é aquela em que o cliente
          mandou ao menos uma mensagem de volta. <b>Aqueceu</b> exige três ou mais, que é quando deixa de
          ser educação e vira conversa. <b>Entregue</b> aparece em dois caminhos porque a passagem
          acontece de dois jeitos: pelo CRM, quando a negociação sai do funil SDR, e pelo WhatsApp, quando
          o comercial abre conversa com o mesmo telefone. Os dois contam, e nem sempre coincidem.
        </Ajuda>
      </p>

      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />

      {parcial && (
        <p className="aviso-leve">
          A medição de mensagem começa em {dataCurta(DESDE_MENSAGEM)} e a de passagem pelo CRM em{" "}
          {dataCurta(DESDE_FUNIL)}, que é quando cada webhook entrou no ar. Antes dessas datas o número
          não é zero, é desconhecido, e por isso as taxas abaixo contam só o período já medido.
        </p>
      )}

      {!dias ? <p className="rotulo">Carregando</p> : (
        <>
          <h2><span className="idx" /> A qualidade do agente</h2>
          <div className="faixa">
            <div>
              <div className="rotulo">Respondeu</div>
              <div className="valor num">{atendidos ? pct(responderam / atendidos) : "-"}</div>
              <div className="mudo num">{num(responderam)} de {num(atendidos)} atendidos</div>
            </div>
            <div>
              <div className="rotulo">Virou conversa</div>
              <div className="valor num">{atendidos ? pct(aqueceu / atendidos) : "-"}</div>
              <div className="mudo num">{num(aqueceu)} com três ou mais respostas</div>
            </div>
            <div>
              <div className="rotulo">Chegou no comercial</div>
              <div className="valor num">{num(entregueCrm)}</div>
              <div className="mudo">saíram do funil SDR</div>
            </div>
            <div>
              <div className="rotulo">Virou matrícula</div>
              <div className="valor num">{num(matriculas)}</div>
              <div className="mudo num">
                {atendidos ? pct(matriculas / atendidos, 2) + " do atendido" : ""}
              </div>
            </div>
            <div>
              <div className="rotulo">Atendidos</div>
              <div className="valor num">{num(atendidos)}</div>
              <div className="mudo">no período já medido</div>
            </div>
          </div>

          <h2><span className="idx" /> Dia a dia</h2>
          <p className="nota">
            A linha cheia é o que o agente abriu. A tracejada é o que respondeu.
            <Ajuda titulo="Por que as duas juntas">
              Separadas, uma esconde a outra: num dia de disparo em massa o volume sobe e a resposta não,
              e isso só aparece quando as duas estão no mesmo eixo. Distância grande entre as linhas é
              disparo sem retorno.
            </Ajuda>
          </p>
          <Curva
            rotulos={medidos.map((d) => dataCurta(d.dia))}
            series={[
              { nome: "Atendidos", cor: COR.tinta, pontos: medidos.map((d) => Number(d.atendidos)) },
              { nome: "Responderam", cor: COR.cinza, tracejada: true, pontos: medidos.map((d) => Number(d.responderam)) },
            ]}
            altura={240}
          />

          <h2><span className="idx" /> Cada dia por inteiro</h2>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th className="n">Atendidos</th>
                  <th className="n">Responderam</th>
                  <th className="n">Aqueceu</th>
                  <th className="n">Saiu do SDR</th>
                  <th className="n">Foi ao comercial</th>
                  <th className="n">Matrículas</th>
                </tr>
              </thead>
              <tbody>
                {[...(dias ?? [])].reverse().map((d) => {
                  const medido = d.dia >= DESDE_MENSAGEM;
                  return (
                    <tr key={d.dia}>
                      <td className="num">{dataCurta(d.dia)}</td>
                      <td className="n"><b>{num(d.atendidos)}</b></td>
                      <td className="n">{medido ? num(d.responderam) : <span className="mudo">-</span>}</td>
                      <td className="n">{medido ? num(d.aqueceu) : <span className="mudo">-</span>}</td>
                      <td className="n">{d.dia >= DESDE_FUNIL ? num(d.entregue_crm) : <span className="mudo">-</span>}</td>
                      <td className="n">{num(d.entregue_whats)}</td>
                      <td className="n">{num(d.matriculas)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="rodape">
            Traço quer dizer que naquele dia a medição ainda não existia, não que o número foi zero.
          </p>

          <h2><span className="idx" /> O mesmo agente, pelo funil do CRM</h2>
          <p className="nota">
            A conversa mostra o esforço. O funil mostra o que sobrou dele dentro do CRM.
            <Ajuda titulo="Por que as duas leituras convivem"
              fontes={["Funil SDR: RD Station CRM (tabela rd_negociacoes, funil SDR)",
                       "Entrega: existe negociação do mesmo contato fora do funil SDR, criada depois",
                       "Curso de um lead de pré-vendas vem do contato, porque o funil SDR não é classificado"]}>
              Este bloco conta pelo CRM e o de cima conta pela conversa. Os dois medem o mesmo agente por
              caminhos diferentes e não precisam bater: um lead pode ter respondido no WhatsApp e nunca
              ter virado negociação, e o contrário também acontece. Diferença grande entre os dois é
              sinal de passagem perdida, não de erro de conta.
            </Ajuda>
          </p>
          {!crm ? <p className="rotulo">Carregando</p> : (
            <div className="faixa">
              <div>
                <div className="rotulo">Leads captados</div>
                <div className="valor num">{num(crm.captados)}</div>
                <div className="mudo">material rico</div>
              </div>
              <div>
                <div className="rotulo">Entregues ao comercial</div>
                <div className="valor num">{num(crm.entregues)}</div>
                <div className="mudo num">
                  {crm.captados ? pct(Number(crm.entregues) / Number(crm.captados), 1) + " do captado" : ""}
                </div>
              </div>
              <div>
                <div className="rotulo">Viraram matrícula</div>
                <div className="valor num">{num(crm.ganhos)}</div>
                <div className="mudo num">
                  {Number(crm.ganhos_de_antes) > 0
                    ? num(crm.ganhos_de_antes) + " vieram de antes do período"
                    : "todas captadas no período"}
                </div>
              </div>
              <div>
                <div className="rotulo">Trabalhados pelo agente</div>
                <div className="valor num">{num(crm.contatados)}</div>
                <div className="mudo">saíram de Sem contato</div>
              </div>
              <div>
                <div className="rotulo">Parados +7 dias</div>
                <div className="valor num">{num(crm.parados_7d)}</div>
              </div>
              <div>
                <div className="rotulo">Parados +30 dias</div>
                <div className="valor num">{num(crm.parados_30d)}</div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
