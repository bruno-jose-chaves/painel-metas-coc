// O mapa do painel, em um lugar só.
//
// Cada área e cada sub-aba viviam escritas dentro da própria página, então
// ninguém conseguia perguntar ao painel "onde fica desconto?" sem abrir aba por
// aba. Aqui o mapa é dado: a navegação de cima, as sub-abas de cada área e a
// busca leem todos desta lista.
//
// "termos" são as palavras que a pessoa usa quando procura, e que não aparecem
// no nome da aba: ninguém procura por "Time", procura por "vendedor"; ninguém
// procura por "A classificar", procura por "etiqueta".

export type Tela = {
  id: string;
  codigo: number;
  nome: string;
  oque: string;
  termos?: string[];
  // Os blocos da tela, na ordem em que aparecem. Servem para a busca achar o
  // bloco, e não só a aba: quem procura "vendas dia a dia" quer o 311, não a
  // aba Time inteira. A conferência das telas compara esta lista com os
  // títulos que a página desenha, então ela não envelhece em silêncio.
  blocos?: string[];
  // Aba que só o admin enxerga. A área inteira pode ser soAdmin (Ajustes), mas
  // às vezes é uma aba só: Operação do dia é leitura de diretoria e fica fora
  // da navegação de quem vende.
  soAdmin?: boolean;
  // Tela de dois modos: o segundo tem os seus próprios quadros, e eles
  // continuam a numeração do primeiro. O modo vai no endereço (&m=), então a
  // busca leva direto ao quadro certo e o link mandado para alguém abre no
  // mesmo lugar.
  modo2?: { id: string; nome: string; blocos: string[] };
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
        termos: ["meta", "faturamento", "matrículas", "ritmo", "projeção", "fatia de mercado",
                 "ticket", "ticket médio", "mês", "período", "semana"],
        blocos: ["Campanhas", "Acompanhando", "Metas de captação", "Ritmo diário de matrículas"] },
      { id: "meu", codigo: 130, nome: "Meu painel",
        oque: "O que é seu: matrículas do dia, como você está contra a média do time e o que está parado na sua mão.",
        termos: ["meu painel", "minha visão", "meus números", "minhas matrículas", "minha fila",
                 "meu ticket", "minha conversão", "quanto eu vendi", "o que está comigo",
                 "minha comissão", "quanto eu ganhei", "comissão"],
        blocos: ["O seu dia", "Quanto você ganhou", "Você contra a média do time", "Quanto esperam por você",
                 "O seu quadro de horário", "O que você vende", "O que está na sua mão agora"] },
      { id: "operacao", codigo: 120, nome: "Operação do dia", soAdmin: true,
        oque: "Lead novo, lead requentado e conversa do dia, pessoa por pessoa. Leitura de diretoria.",
        termos: ["lead novo", "requentado", "conversa do dia", "sem resposta", "hoje"],
        blocos: ["Quem chegou no período", "Conversas no período", "Dia a dia"] },
    ],
  },
  {
    id: "campanha", codigo: 200, nome: "Campanha", href: "/campanha/",
    oque: "Uma campanha por dentro: fases, funil, origem, histórico e upsell",
    telas: [
      { id: "atual", codigo: 210, nome: "Campanha em curso",
        oque: "Uma campanha por dentro: meta, projeção, escada de fases, funil e origem das matrículas.",
        termos: ["fases", "preço", "lote", "funil", "origem", "quem já era da casa", "primeira compra"],
        blocos: ["Projeção de fechamento", "Ritmo da campanha", "Escada de preço por fase", "Cenários das metas", "Da origem à matrícula", "Quem já era da casa", "Marcos", "Contra 2025"] },
      { id: "historico", codigo: 220, nome: "Histórico entre anos",
        oque: "O mesmo curso em anos diferentes, com curva sobreposta e variação de alunos, ticket e desconto.",
        termos: ["ano passado", "2025", "curva", "histórico", "variação"],
        blocos: ["Curva acumulada, sobreposta", "Ano por ano"] },
      { id: "comparar", codigo: 230, nome: "Turma contra turma",
        oque: "Duas turmas sobrepostas pelo dia da turma, para ver qual vendeu mais rápido no mesmo ponto.",
        termos: ["comparar", "turma", "sobreposta", "mesmo ponto"],
        blocos: ["No mesmo ponto da turma", "As duas curvas", "As duas por inteiro"] },
      { id: "upsell", codigo: 240, nome: "Upsell entre cursos",
        oque: "Quanto da base de um curso comprou o outro, contra o mesmo recorte do ano anterior.",
        termos: ["upsell", "recompra", "acafe e ufsc", "comprou os dois", "base"],
        blocos: ["Resultado", "Contra o ano anterior"] },
    ],
  },
  {
    id: "comercial", codigo: 300, nome: "Comercial", href: "/comercial/",
    oque: "Quem vende, o que foi vendido e o que está parado na mão de quem",
    telas: [
      { id: "time", codigo: 310, nome: "Time",
        oque: "Quanto cada vendedor recebeu de lead, quanto fechou, quanto perdeu e quanto está pendurado, com o tempo que cada etapa está segurando negociação.",
        // "comissão" e "bônus" ficaram de fora de propósito: o painel ainda não
        // calcula nenhum dos dois, e apelido que leva a uma tela que não tem a
        // resposta é pior do que não achar nada.
        termos: ["vendedor", "quem vendeu", "ranking", "leads recebidos", "conversão", "perdidas",
                 "motivo de perda", "funil", "taxa de conversão", "objeção"],
        blocos: ["Vendas dia a dia", "Ranking de vendas", "Negócios em aberto e tempo parado", "Motivos de perda"] },
      { id: "lancamentos", codigo: 320, nome: "Lançamentos",
        oque: "A matrícula como ela foi lançada (aluno, curso, valor de tabela, desconto e vendedor), e o que saiu estranho e vale conferir.",
        termos: ["desconto", "desconto médio", "valor de tabela", "aluno", "matrícula", "cancelado",
                 "conferir", "estranho", "erro na planilha", "cidade", "turma"],
        blocos: ["Lançamentos"],
        modo2: { id: "conferir", nome: "A conferir", blocos: ["Lista de conferência"] } },
      { id: "agente", codigo: 330, nome: "Agente de Pré-vendas",
        oque: "A qualidade do agente: de tudo que ele abriu, quanto respondeu, quanto virou conversa e quanto chegou no comercial.",
        termos: ["agente", "pré-vendas", "apv", "sdr", "disparo", "aquecimento"],
        blocos: ["A qualidade do agente", "Dia a dia", "Cada dia por inteiro", "O mesmo agente, pelo funil do CRM"] },
      { id: "qualidade", codigo: 340, nome: "Qualidade do lead",
        oque: "Quem procurou a gente e quem foi procurado, quanto respondeu, quanto esperou pelo atendimento e quanto virou matrícula, por canal.",
        termos: ["tempo de resposta", "espera", "respondeu", "nunca respondeu", "canal", "whatsapp", "primeiro atendimento"],
        blocos: ["Procurou contra foi procurado", "Cada canal por inteiro", "Quanto o cliente espera, por dia da semana"] },
      { id: "atendimento", codigo: 350, nome: "O que está escapando",
        oque: "A fila do que some sem ninguém ver, com nome, dono e o que fazer, e o diagnóstico de conversa que não virou card no CRM.",
        termos: ["fila", "pagamento pendente", "sem card", "negociação parada", "crm", "parado", "escapando"],
        blocos: ["O tamanho de cada buraco", "A fila"],
        modo2: { id: "diagnostico", nome: "Diagnóstico",
                 blocos: ["A passagem", "Por atendente", "Quanto tempo o card fica parado"] } },
      { id: "performance", codigo: 360, nome: "Performance individual",
        oque: "Quanto cada comercial atendeu, vendeu e converteu, semana por semana, e o que está na mão de cada um agora.",
        termos: ["performance", "individual", "por vendedor", "quantas pessoas atendeu", "carteira",
                 "dias trabalhados", "coorte", "ticket por vendedor", "gestão de performance",
                 "mapa de calor", "quadro de horário", "hora do dia", "mensagens enviadas",
                 "quando o cliente responde", "plantão", "tempo de resposta por vendedor",
                 "mix de curso", "o que cada um vende", "motivo de perda por vendedor",
                 "carteira parada", "comissão", "quanto cada um ganhou", "quanto ganhei"],
        blocos: ["Lado a lado no período", "Hoje e o que está na mão de cada um",
                 "Semana a semana", "A curva de cada um", "O quadro de horário",
                 "Quanto o cliente espera por cada um", "O que cada um vende",
                 "Quanto cada um ganhou", "Por que cada um perde"] },
    ],
  },
  {
    id: "marketing", codigo: 400, nome: "Marketing", href: "/marketing/",
    oque: "De onde vem o lead e se ele chegou inteiro no comercial",
    telas: [
      { id: "captacao", codigo: 410, nome: "Captação",
        oque: "Quantos leads entraram por dia e por página, contra a meta de captação da campanha.",
        termos: ["leads captados", "formulário", "página", "meta de captação", "inscritos",
                 "landing page", "lp", "visitas", "site", "conversão da página"],
        blocos: ["Conversões por dia", "Páginas e formulários", "Tags dos leads", "Origem dos negócios no CRM"] },
      { id: "anuncios", codigo: 420, nome: "Anúncios",
        oque: "Quantas conversas cada peça de clique para WhatsApp precisa para sair uma matrícula.",
        termos: ["anúncio", "criativo", "meta ads", "clique para whatsapp", "campanha paga"],
        blocos: ["Peça por peça"] },
      { id: "passagem", codigo: 430, nome: "Passagem para o CRM",
        oque: "Se o lead que o formulário captou virou mesmo negociação no comercial.",
        termos: ["passagem", "virou negociação", "perdeu lead", "rd station"],
        blocos: ["Formulário por formulário", "Captação e entrada no CRM, dia a dia"] },
      { id: "classificar", codigo: 440, nome: "A classificar",
        oque: "Páginas, campanhas do CRM e etiquetas que já estão captando e ainda não foram ligadas a um curso.",
        termos: ["etiqueta", "sem curso", "curso do lead", "sem campanha", "classificar", "apontar", "regra"],
        blocos: ["Esperando a sua decisão", "Regras já apontadas"] },
    ],
  },
  {
    id: "ajustes", codigo: 500, nome: "Ajustes", href: "/ajustes/", soAdmin: true,
    oque: "Cadastro, integrações e saúde dos dados",
    telas: [
      { id: "campanhas", codigo: 510, nome: "Campanhas e metas",
        oque: "Cadastro de campanha, fases, metas de venda e de captação, produtos e turmas por ano.",
        termos: ["cadastrar campanha", "meta", "fase", "preço", "turma", "produto"],
        blocos: ["Dados da campanha", "Metas", "Fases e escada de preço", "Turmas por ano", "Campanhas cadastradas"] },
      { id: "cursos", codigo: 520, nome: "Cursos e produtos",
        oque: "Para onde cada nome de curso da planilha vai, e onde apontar o destino do que a regra não reconhece.",
        termos: ["curso da planilha", "material", "destino", "nome do curso"],
        blocos: ["O tamanho de cada produto", "Cada nome, um a um"] },
      { id: "sistema", codigo: 530, nome: "Acesso e integrações",
        oque: "Quem entra no painel, estado das integrações, última sincronização e saúde dos dados.",
        termos: ["acesso", "liberar pessoa", "integração", "sincronização", "pigeon", "supabase",
                 "n8n", "fonte", "etiqueta do pigeon", "etiqueta do whatsapp", "tag"],
        blocos: ["Planilha de vendas", "RD Station", "n8n", "Fila de manhã", "Pigeon Post",
                 "Etiquetas do Pigeon", "Saúde das fontes", "Importação da planilha",
                 "Cobertura do RD Marketing", "Pedidos de acesso", "Quem acessa"] },
    ],
  },
];

export const telasDe = (areaId: string, admin = true) =>
  (AREAS.find((a) => a.id === areaId)?.telas ?? []).filter((t) => admin || !t.soAdmin);

export const linkDa = (area: Area, tela: Tela) =>
  tela.id === area.telas[0].id ? area.href : `${area.href}?v=${tela.id}`;

// Busca sem acento e sem caixa, por nome, descrição, apelido, código e bloco.
const limpar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// "motivos de perda" tem que ser achado por "motivo de perda". Tirar o s do
// fim de cada palavra resolve o plural sem precisar de dicionário.
const semPlural = (s: string) => s.replace(/(\w{3,}?)s\b/g, "$1");

// Dentro de casa, matrícula e venda são a mesma coisa, e aluno também. Quem
// procura "vendas por dia" quer o bloco que se chama "Ritmo diário de
// matrículas". Cada linha é um grupo de palavras que valem umas pelas outras,
// nos dois sentidos.
const SINONIMOS: string[][] = [
  ["matricula", "matriculas", "venda", "vendas", "vendeu", "aluno", "alunos", "fechamento", "fechei", "fechou", "fechadas"],
  ["lead", "leads", "contato", "contatos", "inscrito", "inscritos", "pessoa", "pessoas"],
  ["anuncio", "anuncios", "peca", "pecas", "criativo", "criativos", "trafego", "campanha paga"],
  ["conversa", "conversas", "whatsapp", "whats", "zap", "atendimento", "atender", "pigeon"],
  ["negociacao", "negociacoes", "card", "cards", "negocio", "negocios", "crm"],
  ["curso", "cursos", "produto", "produtos"],
  ["turma", "turmas", "classe"],
  ["dia a dia", "por dia", "diario", "diaria", "dia"],
  ["vendedor", "vendedores", "comercial", "time", "atendente"],
  ["desconto", "descontos", "abatimento"],
  ["meta", "metas", "objetivo"],
  ["parado", "parada", "paradas", "dormindo", "escapando", "atrasado"],
  ["motivo", "motivos", "objecao", "objecoes", "perda", "perdas", "perdeu", "perdido"],
  ["resposta", "respondeu", "responder", "retorno", "respondido"],
  ["dono", "donos", "responsavel", "atribuido", "carteira"],
  ["ticket", "ticket medio", "valor medio"],
  ["cidade", "cidades", "regiao", "praca", "onde mora"],
  ["projecao", "projetado", "previsao", "tendencia", "fechamento previsto"],
  ["faturamento", "receita", "faturou", "dinheiro"],
  ["funil", "etapa", "etapas", "estagio", "estagios", "fase", "fases"],
  ["upsell", "subiu", "med", "coc med", "progressao"],
  ["pendencia", "pendencias", "conferir", "conferencia", "faltando", "incompleto"],
  ["captacao", "captado", "captados", "conversao", "conversoes", "converte", "taxa"],
  ["chegou", "entrou", "entrada", "novo", "novos", "chegando"],
  ["origem", "origens", "fonte", "fontes", "veio de"],
  ["etiqueta", "etiquetas", "tag", "tags"],
];

// Palavra que a pessoa escreve para fazer a pergunta, não para dizer o que
// procura. "quantas vendas por dia" e "vendas por dia" têm que achar a mesma
// coisa, então essas saem antes da comparação.
const PAREM = new Set([
  "a", "o", "as", "os", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "por", "para", "pra", "com", "que", "qual", "quais", "quanto", "quantos", "quantas",
  "quanta", "meu", "minha", "meus", "minhas", "eu", "me", "mais", "ja", "esta", "estao",
  "estar", "e", "ou", "um", "uma", "ao", "aos", "sobre", "tem", "foi", "ser", "vai",
  "como", "quem", "ver", "lista", "listar", "mostrar", "mostra", "preciso", "quero",
  "qual o", "tao", "esse", "essa", "isso", "aqui", "agora e", "nosso", "nossa",
  "aparece", "acontece", "melhor", "pior", "traz", "leva", "usa", "usam", "quer",
  "comigo", "praticado", "registrado", "acontecendo", "vem", "onde", "pode", "deve",
]);

// Devolve o termo e tudo que vale por ele, para a busca achar o bloco mesmo
// quando a pessoa chamou a coisa pelo outro nome.
function variantes(q: string): string[] {
  const fora = new Set([q]);
  for (const grupo of SINONIMOS) {
    for (const palavra of grupo) {
      if (!q.includes(palavra)) continue;
      for (const troca of grupo) {
        if (troca !== palavra) fora.add(q.replace(palavra, troca));
      }
    }
  }
  return [...fora];
}

export type Achado = {
  area: Area; tela: Tela; link: string;
  // Quando o que casou foi um bloco, e não a aba inteira.
  bloco?: { nome: string; codigo: number; ancora: string };
};

export function procurar(texto: string, admin: boolean): Achado[] {
  const q = limpar(texto);
  const telas: Achado[] = AREAS
    .filter((a) => admin || !a.soAdmin)
    .flatMap((area) => area.telas.filter((t) => admin || !t.soAdmin)
      .map((tela) => ({ area, tela, link: linkDa(area, tela) })));

  const blocos: Achado[] = AREAS
    .filter((a) => admin || !a.soAdmin)
    .flatMap((area) => area.telas.filter((t) => admin || !t.soAdmin).flatMap((tela) => {
      const base = linkDa(area, tela);
      const primeiros = (tela.blocos ?? []).map((nome, i) => ({
        area, tela,
        link: base + "#s" + (i + 1),
        bloco: { nome, codigo: tela.codigo + i + 1, ancora: "s" + (i + 1) },
      }));
      if (!tela.modo2) return primeiros;
      const pulo = (tela.blocos ?? []).length;
      const junta = base.includes("?") ? "&" : "?";
      return primeiros.concat(tela.modo2.blocos.map((nome, i) => ({
        area, tela,
        link: `${base}${junta}m=${tela.modo2!.id}#s` + (i + 1),
        bloco: { nome, codigo: tela.codigo + pulo + i + 1, ancora: "s" + (i + 1) },
      })));
    }));

  if (!q) return telas;

  const qs = variantes(q);

  // Cada palavra da pergunta vale por ela e por tudo que é a mesma coisa
  // dentro de casa. "ranking do time" não é o nome de nenhum quadro, mas
  // "ranking" e "time" estão os dois no de vendedores.
  const alternativas = (p: string): string[] => {
    const fora = new Set([p]);
    for (const grupo of SINONIMOS) {
      const limpo = grupo.map((x) => semPlural(limpar(x)));
      if (!limpo.includes(p)) continue;
      for (const x of limpo) fora.add(x);
    }
    return [...fora];
  };

  // Tira a palavra de pergunta antes de tirar o plural: semPlural deixaria
  // "mais" virar "mai", que não é palavra nenhuma e nunca casa com nada.
  const cheias = q.split(/\s+/).filter(Boolean);
  const uteis = cheias.filter((p) => !PAREM.has(p)).map(semPlural);
  const palavras = (uteis.length ? uteis : cheias.map(semPlural)).map(alternativas);
  // A pergunta sem as palavras de pergunta também vale como frase: quem
  // escreve "qual o motivo de perda" procura "motivo de perda".
  if (uteis.length && uteis.length < cheias.length) {
    for (const v of variantes(uteis.join(" "))) if (!qs.includes(v)) qs.push(v);
  }

  // Nota do campo: o peso cheio quando a frase inteira aparece nele, e a
  // fração das palavras achadas quando não. Menos da metade das palavras é
  // coincidência, não resposta.
  const casa = (alvo: string, peso: number, minimo = 0.5) => {
    const alvos = [limpar(alvo), semPlural(limpar(alvo))];
    for (const v of qs) {
      for (const a of alvos) {
        for (const t of [v, semPlural(v)]) {
          if (a === t) return peso;
          if (a.startsWith(t)) return peso - 5;
          if (a.includes(t)) return peso - 10;
        }
      }
    }
    // Palavra de uma ou duas letras casa com tudo: "a" acharia o painel
    // inteiro. Nesse caso vale só a comparação de frase acima.
    if (palavras.length === 1 && palavras[0].every((x) => x.length < 3)) return 0;
    const achadas = palavras.filter((alts) => alts.some((x) => alvos.some((a) => a.includes(x)))).length;
    const fracao = achadas / palavras.length;
    if (fracao < minimo) return 0;
    return Math.round((peso - 20) * fracao);
  };

  const nota = ({ area, tela, bloco }: Achado) => {
    const codigo = String(bloco ? bloco.codigo : tela.codigo);
    if (qs.some((v) => codigo === v || codigo.startsWith(v))) return 100;
    // O quadro é mais específico que a aba, então também cobra mais: uma
    // palavra de duas acha a aba, não o quadro.
    if (bloco) return casa(bloco.nome, 95, 0.6);
    const campos: [string, number][] = [
      [tela.nome, 90],
      [(tela.termos ?? []).join(" "), 65],
      [tela.oque, 45],
      [area.nome, 30],
    ];
    let melhor = 0;
    for (const [texto, peso] of campos) {
      if (!texto) continue;
      melhor = Math.max(melhor, casa(texto, peso));
    }
    return melhor;
  };

  return [...telas, ...blocos]
    .map((a) => ({ a, n: nota(a) }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n
      || (x.a.bloco ? x.a.bloco.codigo : x.a.tela.codigo) - (y.a.bloco ? y.a.bloco.codigo : y.a.tela.codigo))
    .map((x) => x.a);
}
