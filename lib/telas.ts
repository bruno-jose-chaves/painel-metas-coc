// O mapa do painel, em um lugar só.
//
// Cada área e cada sub-aba viviam escritas dentro da própria página, então
// ninguém conseguia perguntar ao painel "onde fica desconto?" sem abrir aba por
// aba. Aqui o mapa é dado: a navegação de cima, as sub-abas de cada área e a
// busca leem todos desta lista.
//
// "termos" são as palavras que a pessoa usa quando procura, e que não aparecem
// no nome da aba: ninguém procura por "Time", procura por "comissão".

export type Tela = {
  id: string;
  codigo: number;
  nome: string;
  oque: string;
  termos?: string[];
};

export type Area = {
  id: string;
  codigo: number;
  nome: string;
  href: string;
  oque: string;
  soAdmin?: boolean;
  telas: Tela[];
};

export const AREAS: Area[] = [
  {
    id: "hoje", codigo: 100, nome: "Hoje", href: "/",
    oque: "O dia de hoje e o cartão de cada campanha no ar",
    telas: [
      { id: "resumo", codigo: 110, nome: "Resumo",
        oque: "Matrículas, faturamento e leads do período, e o cartão de cada campanha no ar com meta, ritmo e projeção.",
        termos: ["meta", "faturamento", "matrículas", "ritmo", "projeção", "fatia de mercado", "ticket"] },
      { id: "operacao", codigo: 120, nome: "Operação do dia",
        oque: "Lead novo, lead requentado e conversa do dia, pessoa por pessoa. Leitura de diretoria.",
        termos: ["lead novo", "requentado", "conversa do dia", "sem resposta", "hoje"] },
    ],
  },
  {
    id: "campanha", codigo: 200, nome: "Campanha", href: "/campanha/",
    oque: "Uma campanha por dentro: fases, funil, origem, histórico e upsell",
    telas: [
      { id: "atual", codigo: 210, nome: "Campanha em curso",
        oque: "Uma campanha por dentro: meta, projeção, escada de fases, funil e origem das matrículas.",
        termos: ["fases", "preço", "lote", "funil", "origem", "quem já era da casa", "primeira compra"] },
      { id: "historico", codigo: 220, nome: "Histórico entre anos",
        oque: "O mesmo curso em anos diferentes, com curva sobreposta e variação de alunos, ticket e desconto.",
        termos: ["ano passado", "2025", "curva", "histórico", "variação"] },
      { id: "comparar", codigo: 230, nome: "Turma contra turma",
        oque: "Duas turmas sobrepostas pelo dia da turma, para ver qual vendeu mais rápido no mesmo ponto.",
        termos: ["comparar", "turma", "sobreposta", "mesmo ponto"] },
      { id: "upsell", codigo: 240, nome: "Upsell entre cursos",
        oque: "Quanto da base de um curso comprou o outro, contra o mesmo recorte do ano anterior.",
        termos: ["upsell", "recompra", "acafe e ufsc", "comprou os dois", "base"] },
    ],
  },
  {
    id: "comercial", codigo: 300, nome: "Comercial", href: "/comercial/",
    oque: "Quem vende, o que foi vendido e o que está parado na mão de quem",
    telas: [
      { id: "time", codigo: 310, nome: "Time",
        oque: "Quanto cada vendedor recebeu de lead, quanto fechou e quanto está pendurado, com comissão e bônus no período.",
        termos: ["comissão", "bônus", "vendedor", "meta do time", "conversão"] },
      { id: "lancamentos", codigo: 320, nome: "Lançamentos",
        oque: "A matrícula como ela foi lançada (aluno, curso, valor de tabela, desconto e vendedor), e o que saiu estranho e vale conferir.",
        termos: ["desconto", "valor de tabela", "aluno", "matrícula", "cancelado", "conferir", "estranho", "erro na planilha"] },
      { id: "agente", codigo: 330, nome: "Agente de Pré-vendas",
        oque: "A qualidade do agente: de tudo que ele abriu, quanto respondeu, quanto virou conversa e quanto chegou no comercial.",
        termos: ["agente", "pré-vendas", "apv", "sdr", "disparo", "aquecimento"] },
      { id: "qualidade", codigo: 340, nome: "Qualidade do lead",
        oque: "Quem procurou a gente e quem foi procurado, quanto respondeu, quanto esperou pelo atendimento e quanto virou matrícula, por canal.",
        termos: ["tempo de resposta", "espera", "respondeu", "nunca respondeu", "canal", "whatsapp", "primeiro atendimento"] },
      { id: "atendimento", codigo: 350, nome: "O que está escapando",
        oque: "A fila do que some sem ninguém ver, com nome, dono e o que fazer, e o diagnóstico de conversa que não virou card no CRM.",
        termos: ["fila", "pagamento pendente", "sem card", "negociação parada", "crm", "parado", "escapando"] },
    ],
  },
  {
    id: "marketing", codigo: 400, nome: "Marketing", href: "/marketing/",
    oque: "De onde vem o lead e se ele chegou inteiro no comercial",
    telas: [
      { id: "captacao", codigo: 410, nome: "Captação",
        oque: "Quantos leads entraram por dia e por página, contra a meta de captação da campanha.",
        termos: ["leads captados", "formulário", "página", "meta de captação", "inscritos"] },
      { id: "anuncios", codigo: 420, nome: "Anúncios",
        oque: "Quantas conversas cada peça de clique para WhatsApp precisa para sair uma matrícula.",
        termos: ["anúncio", "criativo", "meta ads", "clique para whatsapp", "campanha paga"] },
      { id: "passagem", codigo: 430, nome: "Passagem para o CRM",
        oque: "Se o lead que o formulário captou virou mesmo negociação no comercial.",
        termos: ["passagem", "virou negociação", "perdeu lead", "rd station"] },
      { id: "classificar", codigo: 440, nome: "A classificar",
        oque: "Páginas, campanhas do CRM e etiquetas que já estão captando e ainda não foram ligadas a um curso.",
        termos: ["etiqueta", "sem curso", "classificar", "apontar", "regra"] },
    ],
  },
  {
    id: "ajustes", codigo: 500, nome: "Ajustes", href: "/ajustes/", soAdmin: true,
    oque: "Cadastro, integrações e saúde dos dados",
    telas: [
      { id: "campanhas", codigo: 510, nome: "Campanhas e metas",
        oque: "Cadastro de campanha, fases, metas de venda e de captação, produtos e turmas por ano.",
        termos: ["cadastrar campanha", "meta", "fase", "preço", "turma", "produto"] },
      { id: "cursos", codigo: 520, nome: "Cursos e produtos",
        oque: "Para onde cada nome de curso da planilha vai, e onde apontar o destino do que a regra não reconhece.",
        termos: ["curso da planilha", "material", "destino", "nome do curso"] },
      { id: "sistema", codigo: 530, nome: "Acesso e integrações",
        oque: "Quem entra no painel, estado das integrações, última sincronização e saúde dos dados.",
        termos: ["acesso", "liberar pessoa", "integração", "sincronização", "pigeon", "supabase", "n8n", "fonte"] },
    ],
  },
];

export const telasDe = (areaId: string) => AREAS.find((a) => a.id === areaId)?.telas ?? [];

export const linkDa = (area: Area, tela: Tela) =>
  tela.id === area.telas[0].id ? area.href : `${area.href}?v=${tela.id}`;

// Busca sem acento e sem caixa, por nome, descrição, apelido e código.
const limpar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export type Achado = { area: Area; tela: Tela; link: string };

export function procurar(texto: string, admin: boolean): Achado[] {
  const q = limpar(texto);
  const todas: Achado[] = AREAS
    .filter((a) => admin || !a.soAdmin)
    .flatMap((area) => area.telas.map((tela) => ({ area, tela, link: linkDa(area, tela) })));
  if (!q) return todas;

  const nota = ({ area, tela }: Achado) => {
    const nome = limpar(tela.nome);
    const codigo = String(tela.codigo);
    if (codigo === q || codigo.startsWith(q)) return 100;
    if (nome === q) return 90;
    if (nome.startsWith(q)) return 80;
    if (nome.includes(q)) return 70;
    if ((tela.termos ?? []).some((t) => limpar(t).startsWith(q))) return 60;
    if ((tela.termos ?? []).some((t) => limpar(t).includes(q))) return 50;
    if (limpar(tela.oque).includes(q)) return 40;
    if (limpar(area.nome).includes(q)) return 30;
    return 0;
  };

  return todas
    .map((a) => ({ a, n: nota(a) }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n || x.a.tela.codigo - y.a.tela.codigo)
    .map((x) => x.a);
}
