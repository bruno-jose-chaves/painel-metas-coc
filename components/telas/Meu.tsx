"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Detalhe, { type Recorte } from "@/components/Detalhe";
import Ajuda from "@/components/Ajuda";
import SeletorPeriodo from "@/components/Periodo";
import { useUltima } from "@/lib/consulta";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, pct, duracao, dataCurta } from "@/lib/formato";
import { ultimosDias, hojeSP, type Periodo } from "@/lib/periodo";

// A tela do vendedor.
//
// O painel inteiro foi feito para quem olha o time de cima. Quem vende precisa
// de outra coisa: o que é meu, o que está na minha mão agora e se eu estou bem
// ou mal. Até aqui ele tinha que procurar o próprio nome dentro de uma tabela
// de todo mundo, o que é lento e desconfortável.
//
// A comparação é contra a média do time, sem nome de ninguém. Comparação com
// nome vira ranking público e muda o comportamento de quem está embaixo; a
// média dá a referência sem expor colega. O melhor do time aparece como
// número, também sem nome, para existir um teto visível.

type Resumo = {
  vendedor: string; hoje: number; semana: number; mes: number; faturamento_mes: number;
  ticket_mes: number | null; carteira: number; parados: number; sem_resposta: number;
  atendidos_hoje: number; posicao: number; no_time: number;
};
type Linha = {
  indicador: string; rotulo: string; unidade: string; meu: number | null;
  media_time: number | null; melhor_do_time: number | null; maior_e_melhor: boolean; oque: string;
};
type Fila = {
  tipo: string; prioridade: number; pessoa: string; telefone: string | null; onde: string;
  dias: number; desde: string; ja_e_aluno: boolean; o_que_fazer: string;
};

const mostrar = (v: number | null, unidade: string) => {
  if (v == null) return "-";
  if (unidade === "brl") return brl(v);
  if (unidade === "pct") return pct(v);
  if (unidade === "min") return duracao(v);
  return num(Math.round(v * 10) / 10);
};

export default function Meu({ admin }: { admin?: boolean }) {
  const ultima = useUltima();
  const { volta, em, minutos } = useAtualizacao();
  const [periodo, setPeriodo] = useState<Periodo>(ultimosDias(30));
  const [resumo, setResumo] = useState<Resumo | null | "nenhum">(null);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [fila, setFila] = useState<Fila[] | null>(null);
  const [quem, setQuem] = useState<string>("");
  const [nomes, setNomes] = useState<string[]>([]);
  const [detalhe, setDetalhe] = useState<{ titulo: string; recorte: Recorte } | null>(null);

  useEffect(() => {
    if (!admin) return;
    supabase.rpc("painel_cursos").then(() => {});
    supabase.from("vendedores").select("nome").eq("papel", "comercial").eq("ativo", true)
      .order("nome").then(({ data }) => setNomes(((data as { nome: string }[]) ?? []).map((v) => v.nome)));
  }, [admin]);

  useEffect(() => {
    setResumo(null); setFila(null);
    const p = quem ? { p_vendedor: quem } : {};
    supabase.rpc("painel_meu_resumo", p).then(({ data }) => {
      const l = (data as Resumo[]) ?? [];
      setResumo(l.length ? l[0] : "nenhum");
    });
    supabase.rpc("painel_minha_fila", { ...p, p_limite: 60 })
      .then(({ data }) => setFila((data as Fila[]) ?? []));
  }, [quem, volta]);

  useEffect(() => {
    setLinhas(null);
    ultima("contra", supabase.rpc("painel_meu_contra_time", {
      p_de: periodo.de, p_ate: periodo.ate, ...(quem ? { p_vendedor: quem } : {}),
    }), ({ data }) => setLinhas((data as Linha[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, quem, volta]);

  if (resumo === "nenhum") {
    return (
      <>
        <div className="rotulo">Comercial</div>
        <h1>Meu painel</h1>
        <p className="aviso-leve">
          Seu login ainda não está ligado a um vendedor do cadastro, então não dá para montar a
          sua visão. Quem resolve isso é o admin, em Ajustes, ligando o seu e-mail ao seu nome.
          {admin && nomes.length > 0 && (
            <> Como admin, você pode escolher um comercial no seletor abaixo para ver a tela dele.</>
          )}
        </p>
        {admin && nomes.length > 0 && (
          <div className="filtros">
            <label>
              <span className="rotulo">Ver a tela de</span>
              <select value={quem} onChange={(e) => setQuem(e.target.value)}>
                <option value="">Ninguém</option>
                {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="rotulo">Comercial</div>
      <h1>{quem ? quem : "Meu painel"}</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      {admin && nomes.length > 0 && (
        <div className="filtros">
          <label>
            <span className="rotulo">Ver a tela de</span>
            <select value={quem} onChange={(e) => setQuem(e.target.value)}>
              <option value="">Eu mesmo</option>
              {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="mudo" style={{ marginLeft: "auto", alignSelf: "center" }}>
            Só você vê este seletor. Cada comercial entra e vê a própria tela.
          </span>
        </div>
      )}

      <h2><span className="idx" /> O seu dia</h2>
      {!resumo ? <p className="rotulo">Carregando</p> : (
        <>
          <div className="faixa">
            <div className="abre" onClick={() => setDetalhe({
              titulo: "Minhas matrículas de hoje",
              recorte: { p_de: hojeSP(), p_ate: hojeSP(), p_vendedor: resumo.vendedor },
            })}>
              <div className="rotulo">Matrículas hoje</div>
              <div className="valor num">{num(resumo.hoje)}</div>
              <div className="mudo num">{num(resumo.atendidos_hoje)} pessoas atendidas</div>
            </div>
            <div>
              <div className="rotulo">Na semana</div>
              <div className="valor num">{num(resumo.semana)}</div>
            </div>
            <div className="abre" onClick={() => setDetalhe({
              titulo: "Minhas matrículas do mês",
              recorte: { p_de: hojeSP().slice(0, 7) + "-01", p_ate: hojeSP(), p_vendedor: resumo.vendedor },
            })}>
              <div className="rotulo">No mês</div>
              <div className="valor num">{num(resumo.mes)}</div>
              <div className="mudo num">{brl(resumo.faturamento_mes)}</div>
            </div>
            <div>
              <div className="rotulo">Ticket do mês</div>
              <div className="valor num">{brl(resumo.ticket_mes)}</div>
            </div>
            <div>
              <div className="rotulo">Na sua mão</div>
              <div className="valor num">{num(resumo.carteira)}</div>
              <div className={"mudo num " + (resumo.parados > 0 ? "alerta" : "")}>
                {num(resumo.parados)} parad{resumo.parados === 1 ? "a" : "as"} há mais de 15 dias
              </div>
            </div>
          </div>
          {resumo.sem_resposta > 0 && (
            <p className="aviso-leve">
              <b>{num(resumo.sem_resposta)}</b> pessoas falaram com você nos últimos 14 dias e
              nunca responderam. Vale uma segunda mensagem antes de dar como perdida.
            </p>
          )}
        </>
      )}

      <h2><span className="idx" /> Você contra a média do time</h2>
      <p className="nota">
        Sem nome de ninguém, de propósito: a média serve de referência, e o melhor do time serve
        de teto. Quem é não muda o que você faz amanhã.
        <Ajuda titulo="Como ler esta tabela">
          A barra mostra onde você está entre a média e o melhor do time. Nos dois últimos
          indicadores, menor é melhor: tempo até responder e fatia de gente que nunca recebeu
          resposta.
          <br /><br />
          Nenhum destes números é meta individual. O COC não premia volume individual, e isso
          não mudou: a tabela existe para você saber onde está, não para ser cobrado por ela.
        </Ajuda>
      </p>
      <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />
      {!linhas ? <p className="rotulo">Carregando</p> : linhas.length === 0 ? (
        <p className="mudo">Sem dado no período.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Indicador</th><th className="n">Você</th><th className="n">Média do time</th>
                <th style={{ minWidth: 120 }} /><th className="n">Melhor do time</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const meu = l.meu == null ? null : Number(l.meu);
                const media = l.media_time == null ? null : Number(l.media_time);
                const melhor = l.melhor_do_time == null ? null : Number(l.melhor_do_time);
                const bom = meu != null && media != null
                  && (l.maior_e_melhor ? meu >= media : meu <= media);
                const fatia = meu != null && melhor ? Math.min(1, Math.max(0,
                  l.maior_e_melhor ? meu / melhor : melhor / Math.max(meu, 0.0001))) : 0;
                return (
                  <tr key={l.indicador}>
                    <td>
                      <b>{l.rotulo}</b>
                      <div className="rotulo">{l.oque}</div>
                    </td>
                    <td className={"n num " + (bom ? "ok" : "alerta")}>
                      <b>{mostrar(meu, l.unidade)}</b>
                    </td>
                    <td className="n num mudo">{mostrar(media, l.unidade)}</td>
                    <td><div className="mini"><i style={{ width: `${fatia * 100}%` }} /></div></td>
                    <td className="n num mudo">{mostrar(melhor, l.unidade)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2><span className="idx" /> O que está na sua mão agora</h2>
      <p className="nota">
        A mesma fila da tela O que está escapando, filtrada em você. Em ordem do que mais
        aperta, não do mais antigo.
      </p>
      {!fila ? <p className="rotulo">Carregando</p> : fila.length === 0 ? (
        <p className="mudo">Nada parado na sua mão. É uma boa notícia.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Pessoa</th><th>Situação</th><th className="n">Parada há</th><th>O que fazer</th>
              </tr>
            </thead>
            <tbody>
              {fila.map((f, i) => (
                <tr key={f.pessoa + i}>
                  <td>
                    <b>{f.pessoa}</b>
                    {f.ja_e_aluno && <div className="rotulo">já é aluno</div>}
                    {f.telefone && <div className="rotulo num">{f.telefone}</div>}
                  </td>
                  <td>
                    {f.tipo}
                    <div className="rotulo">{f.onde}</div>
                  </td>
                  <td className={"n num " + (f.dias > 30 ? "alerta" : "")}>
                    {num(f.dias)} d
                    <div className="rotulo num">desde {dataCurta(f.desde)}</div>
                  </td>
                  <td className="mudo">{f.o_que_fazer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && (
        <Detalhe titulo={detalhe.titulo} recorte={detalhe.recorte} aoFechar={() => setDetalhe(null)} />
      )}
    </>
  );
}
