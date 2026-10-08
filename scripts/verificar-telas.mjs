// Verificação das telas com a rede do Supabase interceptada, para exercitar
// o render real de cada página sem depender de login.
import { chromium } from "playwright";

const REF = "raelmxfhzplsvipnthrd";

const resumo = [
  {
    id: "acafe-2026-2", nome: "Método ACAFE 2º/2026", produto_id: "metodo-acafe",
    inicio: "2026-08-25", fim: "2026-11-02", meta_ativa: 2, mercado_candidatos: 4717,
    referencia_ano_anterior: { ano: 2025, alunos: 256, ticket: 604.4, faturamento: 154727, market_share: 0.0543, desconto_medio: 0.241 },
    marcos: [{ data: "2026-09-08", nome: "Carrinho aberto" }, { data: "2026-09-28", fim: "2026-09-30", nome: "Lives" }, { data: "2026-10-19", nome: "Início das aulas" }],
    meta_alunos: 263, meta_faturamento: 185673, alunos: 115, faturamento: 74413.5, cancelados: 6,
    alunos_hoje: 4, faturamento_hoje: 2779.2, ticket_medio: 646.9, desconto_medio: 0.19,
    ticket_alvo: 705.9, ativa: true, projecao_alunos: 231, curva_decorrida: 0.8256, meta_alunos_hoje: 197, fase_atual: "Lives de Lançamento",
    preco_atual: 694.8, fase_fim: "2026-09-30", dias_restantes: 33, situacao: "atras", market_share: 0.0244,
  },
  {
    id: "ufsc-2026", nome: "Missão UFSC 2026", produto_id: "missao-ufsc",
    inicio: "2026-09-10", fim: "2026-11-16", meta_ativa: 2, mercado_candidatos: 19132,
    referencia_ano_anterior: { ano: 2025, alunos: 156, ticket: 622.78, faturamento: 94418, market_share: 0.0082, desconto_medio: 0.111 },
    marcos: [{ data: "2026-09-24", nome: "Carrinho aberto" }],
    meta_alunos: 182, meta_faturamento: 113301, alunos: 63, faturamento: 36297, cancelados: 1,
    alunos_hoje: 2, faturamento_hoje: 1189, ticket_medio: 576.1, desconto_medio: 0.33,
    ticket_alvo: 622.5, ativa: true, projecao_alunos: 242, curva_decorrida: 0.2645, meta_alunos_hoje: 48, fase_atual: "Abertura", preco_atual: 597,
    fase_fim: "2026-10-05", dias_restantes: 47, situacao: "no_ritmo", market_share: 0.0033,
  },
];

const fases = [
  { ordem: 1, nome: "Pré-venda / Reserva", inicio: "2026-08-25", fim: "2026-09-07", preco: 594.8, bonus: "Lote 100 vagas", meta_alunos: 64, alunos: 44, faturamento: 26475.6, ticket_medio: 601.7, estado: "encerrada" },
  { ordem: 2, nome: "Abertura oficial", inicio: "2026-09-08", fim: "2026-09-27", preco: 694.8, bonus: "Carrinho aberto", meta_alunos: 62, alunos: 43, faturamento: 28580.7, ticket_medio: 664.6, estado: "encerrada" },
  { ordem: 3, nome: "Lives de Lançamento", inicio: "2026-09-28", fim: "2026-09-30", preco: 694.8, bonus: "3 noites ao vivo", meta_alunos: 71, alunos: 28, faturamento: 19357.2, ticket_medio: 691.3, estado: "atual" },
  { ordem: 4, nome: "Pós-live", inicio: "2026-10-01", fim: "2026-10-11", preco: 794.8, bonus: "Semana Extra", meta_alunos: 36, alunos: 0, faturamento: 0, ticket_medio: null, estado: "futura" },
];

const vendasDia = [
  { dia: "2026-08-25", alunos: 5, faturamento: 2974, acumulado: 5 },
  { dia: "2026-09-10", alunos: 7, faturamento: 4863, acumulado: 60 },
  { dia: "2026-09-29", alunos: 9, faturamento: 6253, acumulado: 111 },
  { dia: "2026-09-30", alunos: 4, faturamento: 2779, acumulado: 115 },
];

const time = [
  { responsavel: "João Pedro Beraldo", recebidas: 808, ganhas: 101, perdidas: 104, abertas: 643, conversao: 0.4927, alunos: 110, faturamento: 75411.68, ticket_medio: 685.56 },
  { responsavel: "Márcia Laurett", recebidas: 675, ganhas: 100, perdidas: 45, abertas: 549, conversao: 0.6897, alunos: 64, faturamento: 48144.9, ticket_medio: 752.26 },
  { responsavel: "Venda automática", recebidas: 0, ganhas: 0, perdidas: 0, abertas: 0, conversao: null, alunos: 3, faturamento: 370, ticket_medio: 123.33 },
];

const parados = [
  { funil: "Funil principal", etapa: "1° Contato Feito", etapa_ordem: 3, abertas: 1059, ate_3d: 415, d4_7: 160, d8_15: 245, d16_30: 188, mais_30: 51, dias_medio: 9.9 },
  { funil: "Funil principal", etapa: "Qualificação", etapa_ordem: 4, abertas: 162, ate_3d: 12, d4_7: 20, d8_15: 46, d16_30: 63, mais_30: 21, dias_medio: 17.4 },
];

const motivos = [
  { motivo: "Lead duplicado", perdidas: 98, fatia: 0.6901 },
  { motivo: "Dados Incorretos/Inválidos", perdidas: 30, fatia: 0.2113 },
];

const preVenda = [{ captados: 1888, contatados: 44, sem_contato: 1844, entregues: 160, ganhos: 21, parados_7d: 1586, parados_30d: 439 }];

const leadsDia = [
  { dia: "2026-09-27", conversoes: 41, conversoes_lp: 12, visitas: 980 },
  { dia: "2026-09-28", conversoes: 66, conversoes_lp: 20, visitas: 1240 },
  { dia: "2026-09-29", conversoes: 58, conversoes_lp: 15, visitas: 1105 },
  { dia: "2026-09-30", conversoes: 72, conversoes_lp: 18, visitas: 1310 },
];

const leadsOrigem = [
  { identificador: "live-acafe-21-a-23-do-09", tipo: "formulario", conversoes: 331, visitas: null, taxa: null },
  { identificador: "simulado-mr-ufsc", tipo: "landing_page", conversoes: 111, visitas: 331, taxa: 0.3353 },
];

const fontes = [
  { fonte: "Facebook Ads", negocios: 980, ganhas: 61, conversao: 0.0622 },
  { fonte: "Sem origem", negocios: 320, ganhas: 40, conversao: 0.125 },
];

const vendas = [
  { chave: "Vendas 2026|1", numero: "1", data: "2026-09-30", vendedor: "João", status: "Pago", nome: "Aluna Exemplo", curso: "Método ACAFE / 2", material: null, valor_tabela: 894.8, desconto_pct: 0.22, valor_venda: 694.8, cidade: "Florianópolis", estado: "SC", campanha_id: "acafe-2026-2" },
  { chave: "Vendas 2026|2", numero: "2", data: "2026-09-29", vendedor: "Márcia", status: "Cancelado", nome: "Outro Exemplo", curso: "Método ACAFE / 2", material: "Apostila", valor_tabela: 894.8, desconto_pct: 0.1, valor_venda: 805.3, cidade: "Blumenau", estado: "SC", campanha_id: "acafe-2026-2" },
];

const curva = Array.from({ length: 70 }, (_, i) => ({
  dia: new Date(Date.UTC(2026, 7, 25 + i)).toISOString().slice(0, 10),
  d: i,
  realizado: i <= 36 ? Math.round(63 + i * 3.1) : null,
  meta: Math.round(5 + i * 3.7),
  anterior: Math.round(23 + i * 3.4),
}));

const projecao = [{
  ref_ano: 2025, ref_alunos: 258, ref_ate_hoje: 212, fracao: 0.8217,
  dia_da_campanha: 36, projecao_alunos: 213, projecao_faturamento: 133484.84,
  meta_alunos: 263, falta_alunos: 88, dias_restantes: 33,
  ritmo_necessario: 2.67, ritmo_atual: 4.86,
}];

const cenarios = [
  { nivel: 0, ativa: false, alunos: 219, faturamento: 154727, atingido: 0.7991, falta: 44, ritmo_dia: 1.33 },
  { nivel: 1, ativa: false, alunos: 241, faturamento: 170200, atingido: 0.7261, falta: 66, ritmo_dia: 2.0 },
  { nivel: 2, ativa: true, alunos: 263, faturamento: 185673, atingido: 0.6654, falta: 88, ritmo_dia: 2.67 },
  { nivel: 3, ativa: false, alunos: 307, faturamento: 216618, atingido: 0.57, falta: 132, ritmo_dia: 4.0 },
];

const ritmo = [
  { campanha_id: "acafe-2026-2", nome: "Método ACAFE 2º/2026", alunos: 191, esperado_hoje: 204, hoje: 1, ontem: 19, media_7: 6.57, media_28: 3.21, media_campanha: 5.14, necessario_dia: 4.85, falta: 73, dias_restantes: 32, dias_uteis_restantes: 22, anteriores: 60, cobertura: 1.35, projecao_restante: 210 },
  { campanha_id: "ufsc-2026", nome: "Missão UFSC 2026", alunos: 64, esperado_hoje: 33, hoje: 0, ontem: 1, media_7: 1.14, media_28: 2.11, media_campanha: 3.05, necessario_dia: 3.48, falta: 88, dias_restantes: 46, dias_uteis_restantes: 33, anteriores: 15, cobertura: 0.46, projecao_restante: 53 },
];

const funil = [{ matriculas: 190, cruzadas: 187, cobertura: 0.9842, por_email: 163, por_telefone: 20, por_nome: 4, dias_medio: 27.5, dias_mediana: 3, dias_max: 386 }];

const origemMat = [
  { origem: "RESERVA MÉTODO ACAFE 2026/2", negocios: 210, matriculas: 29, matriculas_unicas: 11, conversao: 0.1381, faturamento: 18094.08, ticket_medio: 623.93, dias_medio: 37.6 },
  { origem: "[ACAFE 26/2] LIVE", negocios: 430, matriculas: 23, matriculas_unicas: 9, conversao: 0.0535, faturamento: 14682.7, ticket_medio: 638.38, dias_medio: 15.2 },
];

const rotas = {
  "rpc/painel_funil": funil,
  "rpc/painel_pendencias": [
    { tipo: "campanha_crm", valor: "SEMI 26/2 Leads PréVest", volume: 236, matriculas: 9, primeira: "2026-08-01", ultima: "2026-10-06", sugestao: null },
    { tipo: "formulario", valor: "inscricoes-prevest-26-2", volume: 254, matriculas: 0, primeira: "2026-08-26", ultima: "2026-09-30", sugestao: null },
  ],
  "rpc/painel_upsell_origem": [
    { curso_origem: "Metodo de Aprovação Acafe/2", produto_origem: "metodo-acafe", pessoas: 64, faturamento: 39074, dias_medio: 92 },
    { curso_origem: "Semiextensivo COC MED Matutino/2", produto_origem: "semi-extensivo", pessoas: 9, faturamento: 5322, dias_medio: 115 },
  ],
  "captacao_regras": [
    { id: 1, campanha_id: "acafe-2026-2", indicador: "inscritos_lives", tipo: "campanha_crm", valor: "[ACAFE 26/2] LIVE" },
  ],
  "rpc/painel_recompra": [
    { indicador: "rematricula", rotulo: "Rematrícula", pessoas: 92, base: 676, taxa: 0.4623, faturamento: 56158.52 },
    { indicador: "curso_longo", rotulo: "Também tem curso longo", pessoas: 23, base: 273, taxa: 0.1156, faturamento: 14155.42 },
    { indicador: "outro_intensivo", rotulo: "Também comprou o outro intensivo", pessoas: 2, base: 197, taxa: 0.0101, faturamento: 1231.78 },
    { indicador: "novos", rotulo: "Primeira compra na casa", pessoas: 100, base: 199, taxa: 0.5025, faturamento: 66290 },
  ],
  "rpc/painel_resumo_periodo": [{ alunos: 52, faturamento: 35034.8, ticket_medio: 673.75, leads: 1003, cancelados: 0, dias: 7, melhor_dia: "2026-09-30", melhor_dia_alunos: 20 }],
  "rpc/painel_metas_leads": [
    { indicador: "leads", rotulo: "Leads captados", meta: 3400, realizado: 1907, atingido: 0.5609, esperado_hoje: 2105, situacao: "atencao", identificadores: ["live-acafe-21-a-23-do-09"], por_crm: 680, por_formulario: 453, tem_regra: true },
    { indicador: "inscritos_lives", rotulo: "Inscritos nas lives", meta: 1050, realizado: 571, atingido: 0.5438, esperado_hoje: 650, situacao: "atencao", identificadores: ["live-acafe-21-a-23-do-09"], por_crm: 680, por_formulario: 453, tem_regra: true },
    { indicador: "reservas", rotulo: "Reservas", meta: 300, realizado: 280, atingido: 0.9333, esperado_hoje: 186, situacao: "no_ritmo" },
  ],
  "rpc/painel_tags": [{ tag: "ufsc-simulado", leads: 112, conversoes: 140 }, { tag: "acafe-live", leads: 83, conversoes: 95 }],
  "rpc/painel_higiene": [{ motivo: "Lead duplicado", descartadas: 98, fatia_do_total: 0.69 }],
  "rpc/solicitar_acesso": "registrada",
  solicitacoes_acesso: [{ email: "novo@coconline.com.br", nome: "Pessoa Nova", mensagem: "acompanhar metas", criada_em: "2026-10-02T12:00:00Z", situacao: "pendente" }],
  produtos: [{ id: "metodo-acafe", nome: "Método de Aprovação ACAFE" }, { id: "semi-extensivo", nome: "Semi Extensivo" }],
  metas: [{ nivel: 2, alunos: 263, faturamento: 185673 }],
  fases: fases,
  "rpc/painel_origem_matriculas": origemMat,
  "rpc/painel_ritmo": ritmo,
  "rpc/painel_curva": curva,
  "rpc/painel_projecao": projecao,
  "rpc/painel_cenarios": cenarios,
  "rpc/is_autorizado": true,
  "rpc/is_admin": true,
  "rpc/integracoes_status": [{ servico: "planilha", app_configurado: true, conectado: true, expira_em: null, atualizado_em: "2026-10-02T13:05:00Z" }, { servico: "rd_crm", app_configurado: true, conectado: true, expira_em: "2026-10-02T16:00:00Z", atualizado_em: "2026-10-02T13:00:00Z" }, { servico: "rd_marketing", app_configurado: true, conectado: true, expira_em: "2026-10-02T16:00:00Z", atualizado_em: "2026-10-02T13:00:00Z" }],
  "rpc/painel_fases": fases,
  "rpc/painel_vendas_dia": vendasDia,
  "rpc/painel_time_comercial": time,
  "rpc/painel_parados": parados,
  "rpc/painel_motivos_perda": motivos,
  "rpc/painel_pre_venda": preVenda,
  "rpc/painel_leads_dia": leadsDia,
  "rpc/painel_leads_origem": leadsOrigem,
  "rpc/painel_fontes": fontes,
  resumo_campanhas: resumo,
  campanhas: resumo.map((c) => ({ id: c.id, nome: c.nome })),
  vendas,
  sincronizacoes: [{ id: 1, fonte: "planilha:Vendas 2026", terminado_em: "2026-10-02T13:05:00Z", lidas: 860, importadas: 858, rejeitadas: 2, status: "ok" }],
  usuarios_autorizados: [{ email: "brunojose_chaves@hotmail.com", nome: "Bruno", papel: "admin" }],
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });

await ctx.route(`**/${REF}.supabase.co/**`, (route) => {
  const url = new URL(route.request().url());
  const alvo = url.pathname.replace("/rest/v1/", "");
  const chave = Object.keys(rotas).find((k) => alvo === k);
  const corpo = chave ? rotas[chave] : [];
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": "0-1/2", "access-control-allow-origin": "*" },
    body: JSON.stringify(corpo),
  });
});

const sessao = {
  access_token: "a.b.c",
  refresh_token: "r",
  token_type: "bearer",
  expires_in: 999999,
  expires_at: Math.floor(Date.now() / 1000) + 999999,
  user: { id: "00000000-0000-0000-0000-000000000000", email: "brunojose_chaves@hotmail.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
};
await ctx.addInitScript(
  ([ref, s]) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s)),
  [REF, sessao]
);

const pg = await ctx.newPage();
const erros = [];
pg.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
pg.on("pageerror", (e) => erros.push("pageerror: " + e.message));

const telas = [
  ["/campanhas/", "Cadastro de campanhas"],
  ["/pendencias/", "O que falta classificar"],
  ["/configuracao/", "Pedidos de acesso"],
  ["/", "Metas de captação"],
  ["/campanha/", "Da origem à matrícula"],
  ["/vendas/", "Lançamentos"],
  ["/time/", "Agente de Pré-vendas"],
  ["/leads/", "Formulário embutido"],
];

let falhou = false;
for (const [rota, esperado] of telas) {
  erros.length = 0;
  await pg.goto("http://127.0.0.1:4599" + rota, { waitUntil: "networkidle" });
  await pg.waitForTimeout(700);
  const corpo = await pg.textContent("body");
  const achou = corpo.includes(esperado);
  const carregando = (corpo.match(/Carregando/g) || []).length;
  if (!achou || erros.length) falhou = true;
  console.log(
    rota.padEnd(13),
    achou ? "render ok" : `FALTA "${esperado}"`,
    carregando ? `| ${carregando}x Carregando` : "|",
    erros.length ? "| ERRO: " + erros.join(" ~ ").slice(0, 300) : ""
  );
  await pg.screenshot({ path: `/tmp/claude-0/tela${rota.replace(/\//g, "_")}.png`, fullPage: true });
}

await b.close();
process.exit(falhou ? 1 : 0);
