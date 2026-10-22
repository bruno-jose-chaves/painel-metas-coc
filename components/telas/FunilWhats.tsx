"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import SeletorPeriodo from "@/components/Periodo";
import { ultimosDias, type Periodo } from "@/lib/periodo";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, pct } from "@/lib/formato";

// Conversa do WhatsApp contra card no CRM.
//
// Esta tela media etapa do funil pela etiqueta do Pigeon. Estava errada na raiz.
// A etiqueta não é estado: o comercial põe a etiqueta só para disparar a
// automação que move o card no CRM, e tira em seguida, porque se o cliente
// responde de novo com a etiqueta no contato a automação dispara outra vez.
// Etiqueta é botão, não lugar.
//
// Então "contato sem etapa marcada" nunca foi desleixo, era o funcionamento
// normal. A pergunta que sobra, e que é a que importa: toda conversa do
// WhatsApp virou card no CRM? Quem conversou e não tem card está fora de
// qualquer acompanhamento, e some.

type Pessoa = {
  telefone: string; nome: string | null; atendente: string | null;
  conversas: number; primeira: string; ultima: string;
  tem_negociacao: boolean; funil: string | null; etapa: string | null;
  etapa_desde: string | null; dias_na_etapa: number | null;
  status_negociacao: string | null; virou_matricula: boolean;
};

// A tabela "Pessoa a pessoa" saiu daqui: repetia, sem dono e sem o que fazer, a
// mesma gente que a fila ao lado ja lista com nome, telefone e acao.
type Etapa = {
  funil: string; etapa: string; abertas: number;
  mediana_dias: number; media_dias: number;
  parados_14d: number; parados_30d: number; mais_antigo: number;
  por_dono: Record<string, number> | null;
};

export default function FunilWhats({ embutido }: { embutido?: boolean } = {}) {
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(() => ultimosDias(14));
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [etapas, setEtapas] = useState<Etapa[] | null>(null);

  useEffect(() => {
    setPessoas(null);
    supabase.rpc("painel_whats_crm", { p_de: periodo.de, p_ate: periodo.ate })
      .then(({ data }) => setPessoas((data as Pessoa[]) ?? []));
    // Este bloco não recebe período de propósito: card parado está parado
    // agora, não "no período". Antes isso não estava escrito em lugar nenhum e
    // quem trocava o filtro achava que a tabela tinha mudado junto.
    supabase.rpc("painel_tempo_etapa", { p_funil: null })
      .then(({ data }) => setEtapas((data as Etapa[]) ?? []));
  }, [periodo, volta]);

  const total = pessoas?.length ?? 0;
  const fora = useMemo(() => (pessoas ?? []).filter((p) => !p.tem_negociacao), [pessoas]);
  const dentro = total - fora.length;

  // Quem conversa muito e não abre card. Por atendente, porque é aí que a
  // conversa com a pessoa acontece.
  const porAtendente = useMemo(() => {
    const m = new Map<string, { total: number; fora: number }>();
    for (const p of pessoas ?? []) {
      const k = p.atendente ?? "sem atendente";
      const a = m.get(k) ?? { total: 0, fora: 0 };
      a.total += 1; if (!p.tem_negociacao) a.fora += 1;
      m.set(k, a);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [pessoas]);

  return (
    <>
      {!embutido && (
        <>
          <div className="rotulo">WhatsApp e CRM</div>
          <h1>Toda conversa virou card?</h1>
          <p className="carimbo num">
            Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
          </p>
        </>
      )}

      <p className="nota">
        Quem conversou no WhatsApp no período e se existe negociação no CRM para essa pessoa.
        <Ajuda titulo="Por que a leitura mudou"
          fontes={["Conversas: tabela pigeon_conversas, telefone vindo dos eventos de sessão do Pigeon",
                   "Negociação, etapa e tempo: RD Station CRM (tabelas rd_negociacoes e rd_contatos)",
                   "Virou matrícula: planilha comercial (tabela vendas), cruzando por telefone"]}>
          Esta tela mostrava etapa do funil pela etiqueta do Pigeon, e isso estava errado na raiz. A
          etiqueta é usada como botão: o comercial põe a etiqueta só para disparar a automação que move o
          card no CRM e tira logo depois, senão a automação dispara de novo a cada resposta do cliente.
          Contato sem etiqueta nunca foi descuido, era o funcionamento normal. A conta que resta é esta:
          conversa que não virou card fica fora de qualquer acompanhamento.
        </Ajuda>
      </p>

      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />

      {!pessoas ? <p className="rotulo">Carregando</p> : (
        <>
          <h2><span className="idx" /> A passagem</h2>
          <div className="faixa">
            <div>
              <div className="rotulo">Conversaram</div>
              <div className="valor num">{num(total)}</div>
              <div className="mudo">pessoas no período</div>
            </div>
            <div>
              <div className="rotulo">Têm card no CRM</div>
              <div className="valor num">{num(dentro)}</div>
              <div className="mudo num">{total ? pct(dentro / total) : ""}</div>
            </div>
            <div>
              <div className="rotulo">Sem card nenhum</div>
              <div className={"valor num " + (fora.length ? "alerta" : "ok")}>{num(fora.length)}</div>
              <div className="mudo">conversaram e sumiram</div>
            </div>
            <div>
              <div className="rotulo">Já são matrícula</div>
              <div className="valor num">{num((pessoas ?? []).filter((p) => p.virou_matricula).length)}</div>
              <div className="mudo">entre quem conversou</div>
            </div>
          </div>

          {fora.length > 0 && (
            <p className="aviso-leve ruim">
              {num(fora.length)} {fora.length > 1 ? "pessoas conversaram" : "pessoa conversou"} no
              WhatsApp e não tem negociação no CRM. Sem card, ninguém acompanha, e a pessoa não
              aparece em nenhuma conta de funil.
              <br />
              Este é o diagnóstico, com o período que você escolher. Para trabalhar a lista com nome,
              dono e o que fazer, troque para <b>Fila para trabalhar</b>, ali em cima, que olha sempre
              os últimos 14 dias e deixa o dia de hoje de fora, porque card aberto no fim do dia é
              normal. Por isso os dois números não são iguais.
            </p>
          )}

          <h2><span className="idx" /> Por atendente</h2>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Atendente</th>
                  <th className="n">Conversou com</th>
                  <th className="n">Sem card</th>
                  <th className="n">Fora do CRM</th>
                </tr>
              </thead>
              <tbody>
                {porAtendente.map(([k, a]) => (
                  <tr key={k} className={a.fora > 0 ? "fora" : undefined}>
                    <td><b>{k}</b></td>
                    <td className="n">{num(a.total)}</td>
                    <td className="n">{num(a.fora)}</td>
                    <td className="n">{a.total ? pct(a.fora / a.total) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2><span className="idx" /> Quanto tempo o card fica parado</h2>
          <p className="nota">
            Negociação aberta no CRM, por etapa, e há quantos dias ela não sai do lugar.
            <b> Este bloco não segue o período escolhido acima</b>: card parado está parado agora.
            <Ajuda titulo="Por que tempo, e não conversão"
              fontes={["RD Station CRM, tabela rd_negociacoes, campo etapa_desde",
                       "Só negociação com status aberta",
                       "Histórico desde setembro de 2024, preenchido em todas as linhas"]}>
              Conversão por etapa não diz nada aqui, porque <b>Aguardando Pagamento</b> quer dizer link
              enviado e não dinheiro na conta: o card entra nessa etapa quando o cliente avisa que vai
              comprar. Já o tempo parado diz muito. Mediana alta numa etapa é lead morto ocupando funil,
              e card parado em Aguardando Pagamento é venda que foi dada como feita e não aconteceu.
            </Ajuda>
          </p>
          {!etapas ? <p className="rotulo">Carregando</p> : (
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Funil</th>
                    <th>Etapa</th>
                    <th className="n">Abertas</th>
                    <th className="n">Mediana parada</th>
                    <th className="n">Parados +14d</th>
                    <th className="n">Parados +30d</th>
                    <th className="n">Mais antigo</th>
                    <th>Por dono</th>
                  </tr>
                </thead>
                <tbody>
                  {etapas.map((e) => (
                    <tr key={e.funil + e.etapa} className={Number(e.mediana_dias) > 30 ? "fora" : undefined}>
                      <td className="mudo">{e.funil}</td>
                      <td><b>{e.etapa}</b></td>
                      <td className="n">{num(e.abertas)}</td>
                      <td className="n"><b>{num(e.mediana_dias)}</b> <span className="mudo">dias</span></td>
                      <td className="n">{num(e.parados_14d)}</td>
                      <td className="n">{num(e.parados_30d)}</td>
                      <td className="n mudo">{num(e.mais_antigo)} dias</td>
                      <td className="mudo" style={{ maxWidth: 240 }}>
                        {Object.entries(e.por_dono ?? {}).sort((a, b) => b[1] - a[1])
                          .map(([k, v]) => `${k} ${v}`).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="rodape">
            O telefone da conversa vem dos eventos de sessão do Pigeon, que começaram a chegar em
            30/09/2026. Conversa anterior a isso não tem telefone guardado e fica fora desta conta.
          </p>
        </>
      )}
    </>
  );
}
