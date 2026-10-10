"use client";
import { useState } from "react";

// A tela de "por onde começo".
//
// O painel tem cinco áreas e dezenove blocos, e quem chega não sabe se o que
// procura está em Campanha ou em Comercial. Em vez de um manual, que ninguém
// lê, duas perguntas: o que você faz, e o que quer saber agora. O resultado é
// uma lista curta de telas, na ordem em que vale abrir.

type Papel = "comercial" | "marketing" | "diretoria" | "pedagogico";
type Pergunta =
  | "como_vamos" | "o_que_fazer_hoje" | "de_onde_vem" | "quem_vende"
  | "comparar" | "conferir_dado";

const PAPEIS: { id: Papel; nome: string; oque: string }[] = [
  { id: "comercial", nome: "Comercial", oque: "Falo com lead e fecho matrícula" },
  { id: "marketing", nome: "Marketing", oque: "Trago lead e cuido de campanha" },
  { id: "diretoria", nome: "Diretoria", oque: "Acompanho meta e decido rumo" },
  { id: "pedagogico", nome: "Outra área", oque: "Só preciso olhar número de vez em quando" },
];

const PERGUNTAS: { id: Pergunta; nome: string }[] = [
  { id: "como_vamos", nome: "Como estamos indo contra a meta" },
  { id: "o_que_fazer_hoje", nome: "O que eu preciso fazer hoje" },
  { id: "de_onde_vem", nome: "De onde está vindo o lead" },
  { id: "quem_vende", nome: "Quem está vendendo, e quanto" },
  { id: "comparar", nome: "Comparar com o ano passado" },
  { id: "conferir_dado", nome: "Conferir se um número está certo" },
];

type Sugestao = { tela: string; link: string; porque: string };

// A regra é a mesma para todo mundo: a pergunta manda, o papel ajusta a ordem e
// acrescenta o que é do dia a dia daquela pessoa.
const POR_PERGUNTA: Record<Pergunta, Sugestao[]> = {
  como_vamos: [
    { tela: "Hoje · Resumo", link: "/", porque: "O cartão de cada campanha no ar, com meta, ritmo e projeção" },
    { tela: "Campanha · Campanha em curso", link: "/campanha/", porque: "A mesma campanha por dentro: projeção de fechamento, ritmo por dia útil e escada de fases" },
  ],
  o_que_fazer_hoje: [
    { tela: "A estrela, no canto superior direito", link: "/", porque: "O que está aberto agora e some sozinho quando alguém resolve" },
    { tela: "Hoje · Operação do dia", link: "/?v=operacao", porque: "Lead novo, lead requentado e conversa do dia, pessoa por pessoa" },
  ],
  de_onde_vem: [
    { tela: "Marketing · Captação", link: "/marketing/", porque: "Quantos leads entraram por dia e por página, contra a meta" },
    { tela: "Marketing · Passagem para o CRM", link: "/marketing/?v=passagem", porque: "Se o lead que o formulário captou virou mesmo negociação" },
    { tela: "Marketing · Anúncios", link: "/marketing/?v=anuncios", porque: "Quem chegou por peça de clique para WhatsApp" },
    { tela: "Campanha · Da origem à matrícula", link: "/campanha/", porque: "Qual origem virou aluno de verdade, não só lead" },
  ],
  quem_vende: [
    { tela: "Comercial · Time", link: "/comercial/", porque: "Quanto cada um recebeu de lead, fechou e deixou pendurado" },
    { tela: "Comercial · Lançamentos", link: "/comercial/?v=lancamentos", porque: "A matrícula como foi lançada: aluno, curso, valor e desconto" },
  ],
  comparar: [
    { tela: "Campanha · Histórico entre anos", link: "/campanha/?v=historico", porque: "O mesmo curso em anos diferentes, com curva sobreposta" },
    { tela: "Campanha · Upsell entre cursos", link: "/campanha/?v=upsell", porque: "Quem comprou um curso e comprou outro, com o ano anterior ao lado" },
    { tela: "Comercial · Vendas dia a dia", link: "/comercial/", porque: "Escolha a comparação com o período anterior ou com o ano passado" },
  ],
  conferir_dado: [
    { tela: "O Ⓘ ao lado de cada bloco", link: "/", porque: "Diz de onde o número vem e quais bases foram cruzadas" },
    { tela: "Clicar no número", link: "/comercial/", porque: "Onde o painel conta matrícula, clicar abre a lista nome por nome" },
    { tela: "Comercial · O que conferir", link: "/comercial/?v=conferir", porque: "Casos que o painel marcou como estranhos e pedem olho humano" },
    { tela: "Ajustes · Acesso e integrações", link: "/ajustes/?v=sistema", porque: "Última sincronização de cada fonte e saúde dos dados" },
  ],
};

const DO_DIA: Record<Papel, Sugestao[]> = {
  comercial: [
    { tela: "A estrela, no canto superior direito", link: "/", porque: "Mostra só o que é seu: conversa sem resposta, lead que voltou a falar, virada de preço" },
  ],
  marketing: [
    { tela: "Marketing · Páginas a classificar", link: "/marketing/?v=paginas", porque: "Formulário captando sem curso apontado não entra na conta de campanha nenhuma" },
  ],
  diretoria: [
    { tela: "Ajustes · Campanhas e metas", link: "/ajustes/", porque: "Cadastro de campanha, fases, metas e turmas por ano" },
  ],
  pedagogico: [],
};

export default function Guia() {
  const [papel, setPapel] = useState<Papel | null>(null);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);

  const sugestoes = pergunta
    ? [...POR_PERGUNTA[pergunta], ...(papel ? DO_DIA[papel] : [])]
        .filter((s, i, lista) => lista.findIndex((x) => x.tela === s.tela) === i)
    : [];

  return (
    <>
      <div className="rotulo">Por onde começar</div>
      <h1>O que você quer saber?</h1>
      <p className="nota">
        Duas perguntas e o painel diz quais telas abrir, na ordem. Nada aqui muda dado nenhum.
      </p>

      <h2><span className="idx">001</span> O que você faz</h2>
      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {PAPEIS.map((p) => (
          <button
            key={p.id}
            className={"escolha" + (papel === p.id ? " ativa" : "")}
            onClick={() => setPapel(p.id)}
          >
            <b>{p.nome}</b>
            <span>{p.oque}</span>
          </button>
        ))}
      </div>

      <h2><span className="idx">002</span> O que você quer saber agora</h2>
      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {PERGUNTAS.map((p) => (
          <button
            key={p.id}
            className={"escolha" + (pergunta === p.id ? " ativa" : "")}
            onClick={() => setPergunta(p.id)}
          >
            <b>{p.nome}</b>
          </button>
        ))}
      </div>

      <h2><span className="idx">003</span> Onde olhar</h2>
      {!pergunta ? (
        <p className="mudo">Escolha o que você quer saber e a lista aparece aqui.</p>
      ) : (
        <div className="marcos">
          {sugestoes.map((s, i) => (
            <div key={s.tela}>
              <span className="quando num">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <a href={s.link}><b>{s.tela}</b></a>
                <div className="mudo">{s.porque}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2><span className="idx">004</span> Três coisas que valem para o painel inteiro</h2>
      <div className="marcos">
        <div>
          <span className="quando">Ⓘ</span>
          <div>
            <b>O Ⓘ conta de onde o número vem</b>
            <div className="mudo">Passe o mouse e ele mostra a explicação completa e quais bases foram cruzadas.</div>
          </div>
        </div>
        <div>
          <span className="quando">Clique</span>
          <div>
            <b>Número de matrícula abre a lista</b>
            <div className="mudo">No resumo, no cartão de campanha, na fase, no vendedor e no ponto do gráfico.</div>
          </div>
        </div>
        <div>
          <span className="quando">Filtro</span>
          <div>
            <b>O filtro vale para a página inteira</b>
            <div className="mudo">Trocar curso ou período muda todos os blocos daquela tela, não só o de baixo.</div>
          </div>
        </div>
      </div>
    </>
  );
}
