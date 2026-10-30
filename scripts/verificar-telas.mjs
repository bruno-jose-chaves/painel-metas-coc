// Verificação das telas com a rede do Supabase interceptada, para exercitar
// o render real de cada página sem depender de login.
//
// Rode com "npm run verificar", com o site estático servido em 127.0.0.1:4599
// (npm run build && npx serve out -l 4599). O script lê lib/telas.ts direto,
// então precisa do --experimental-strip-types que o npm script já passa.
import { chromium } from "playwright";
import { AREAS } from "../lib/telas.ts";

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
  { ordem: 0, nome: "Antes da campanha", inicio: "2026-06-30", fim: "2026-08-24", preco: null, bonus: "Reserva e venda lançadas antes da primeira fase", meta_alunos: 0, alunos: 60, faturamento: 35272, ticket_medio: 588, estado: "anterior", saldo_anterior: 0, meta_ajustada: null, falta_na_fase: null },
  { ordem: 1, nome: "Pré-venda / Reserva", inicio: "2026-08-25", fim: "2026-09-07", preco: 594.8, bonus: "Lote 100 vagas", meta_alunos: 64, alunos: 44, faturamento: 26475.6, ticket_medio: 601.7, estado: "encerrada", saldo_anterior: -8, meta_ajustada: null, falta_na_fase: null },
  { ordem: 2, nome: "Abertura oficial", inicio: "2026-09-08", fim: "2026-09-27", preco: 694.8, bonus: "Carrinho aberto", meta_alunos: 62, alunos: 43, faturamento: 28580.7, ticket_medio: 664.6, estado: "encerrada", saldo_anterior: -8, meta_ajustada: null, falta_na_fase: null },
  { ordem: 3, nome: "Lives de Lançamento", inicio: "2026-09-28", fim: "2026-09-30", preco: 694.8, bonus: "3 noites ao vivo", meta_alunos: 71, alunos: 28, faturamento: 19357.2, ticket_medio: 691.3, estado: "atual", saldo_anterior: -8, meta_ajustada: 44, falta_na_fase: 25 },
  { ordem: 4, nome: "Pós-live", inicio: "2026-10-01", fim: "2026-10-11", preco: 794.8, bonus: "Semana Extra", meta_alunos: 36, alunos: 0, faturamento: 0, ticket_medio: null, estado: "futura", saldo_anterior: -8, meta_ajustada: 44, falta_na_fase: 25 },
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

const comparar = Array.from({ length: 121 }, (_, d) => ({
  d,
  dia_a: d <= 101 ? new Date(Date.UTC(2026, 6, 1 + d)).toISOString().slice(0, 10) : null,
  alunos_a: d <= 101 ? (d > 55 ? 3 : 1) : null,
  acum_a: d <= 101 ? Math.round(Math.min(208, d * 2.05)) : null,
  dia_b: new Date(Date.UTC(2025, 6, 1 + d)).toISOString().slice(0, 10),
  alunos_b: d > 50 ? 3 : 1,
  acum_b: Math.round(Math.min(258, d * 2.3)),
}));

const apvDias = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 16 + i)).toISOString().slice(0, 10);
  const medido = d >= "2026-10-05";
  const at = 10 + ((i * 7) % 60);
  return { dia: d, atendidos: at, responderam: medido ? Math.round(at * 0.26) : 0,
    aqueceu: medido ? Math.round(at * 0.13) : 0,
    entregue_crm: d >= "2026-09-30" ? (i % 4) : 0, entregue_whats: i % 3, matriculas: i % 9 === 0 ? 1 : 0 };
});

const cursosMock = [
  { curso: "Metodo Acafe", curso_norm: "metodo acafe", grafias: "Metodo Acafe · METODO ACAFE", produto_id: "metodo-acafe", produto: "Método de Aprovação ACAFE", conta_aluno: true, origem: "regra", vendas: 2336, faturamento: 1051442.98, primeira: "2021-01-04", ultima: "2026-10-14", anos: "2026, 2025, 2024, 2023, 2022, 2021" },
  { curso: "Preparatorio Enem Hibrido", curso_norm: "preparatorio enem hibrido", grafias: null, produto_id: "prep-enem", produto: "Preparação ENEM", conta_aluno: true, origem: "apontado", vendas: 310, faturamento: 97938.09, primeira: "2021-03-16", ultima: "2023-09-05", anos: "2023, 2022, 2021" },
  { curso: "Material - Coc 1000 Acafe", curso_norm: "material - coc 1000 acafe", grafias: null, produto_id: "material", produto: "Material avulso", conta_aluno: false, origem: "apontado", vendas: 24, faturamento: 3600, primeira: "2026-05-05", ultima: "2026-09-02", anos: "2026" },
  { curso: "Preparação Intensiva - MED. FURB", curso_norm: "preparacao intensiva - med. furb", grafias: null, produto_id: "outros", produto: "Outros", conta_aluno: true, origem: "apontado", vendas: 44, faturamento: 25325.54, primeira: "2026-01-15", ultima: "2026-02-06", anos: "2026" },
];

const escapandoResumo = [
  { tipo: "Pagamento pendente", prioridade: 1, quantos: 28, mediana_dias: 48, mais_parado: 164, na_fila: true, por_dono: { "Marcia  Laurett": 21, "João Pedro Beraldo": 7 } },
  { tipo: "Conversa sem card", prioridade: 2, quantos: 61, mediana_dias: 7, mais_parado: 12, na_fila: true, por_dono: { Marcia: 39, "João": 22 } },
  { tipo: "Negociação parada", prioridade: 3, quantos: 205, mediana_dias: 68, mais_parado: 201, na_fila: true, por_dono: { "Marcia  Laurett": 168, "João Pedro Beraldo": 20, "Tarso Brietzke Iracet": 17 } },
  { tipo: "Parado há mais de 90 dias", prioridade: 4, quantos: 90, mediana_dias: 123, mais_parado: 205, na_fila: false, por_dono: { "Marcia  Laurett": 62, "Tarso Brietzke Iracet": 19 } },
  { tipo: "Qualificação parada", prioridade: 5, quantos: 364, mediana_dias: 68, mais_parado: 110, na_fila: false, por_dono: { "Marcia  Laurett": 300, "João Pedro Beraldo": 64 } },
  { tipo: "Lead de pré-vendas sem contato", prioridade: 6, quantos: 5701, mediana_dias: 172, mais_parado: 417, na_fila: false, por_dono: { "sem dono": 5701 } },
];
const escapando = [
  { tipo: "Pagamento pendente", prioridade: 1, pessoa: "Juliana Reis", telefone: "47988112233", dono: "Marcia  Laurett", onde: "Funil principal · Aguardando Pagamento", dias: 164, desde: "2026-05-08", ja_e_aluno: false, o_que_fazer: "Cobrar o pagamento ou devolver o card para Negociação" },
  { tipo: "Pagamento pendente", prioridade: 1, pessoa: "Rafael Tomaz", telefone: "48997654321", dono: "João Pedro Beraldo", onde: "Funil principal · Aguardando Pagamento", dias: 52, desde: "2026-08-28", ja_e_aluno: false, o_que_fazer: "Cobrar o pagamento ou devolver o card para Negociação" },
  { tipo: "Conversa sem card", prioridade: 2, pessoa: "[NOVO] (47) 98846-8060", telefone: "47988468060", dono: "Marcia", onde: "WhatsApp, fora do CRM", dias: 12, desde: "2026-10-07", ja_e_aluno: false, o_que_fazer: "Abrir a negociação no CRM e retomar a conversa" },
  { tipo: "Conversa sem card", prioridade: 2, pessoa: "Enilson Silva Souza", telefone: "48991555125", dono: "Marcia", onde: "WhatsApp, fora do CRM", dias: 3, desde: "2026-10-16", ja_e_aluno: true, o_que_fazer: "Já virou matrícula e nunca teve card: abrir e fechar como ganha" },
  { tipo: "Negociação parada", prioridade: 3, pessoa: "Camila Fontes", telefone: "49998877665", dono: "Marcia  Laurett", onde: "Funil principal · Negociação", dias: 201, desde: "2026-04-01", ja_e_aluno: false, o_que_fazer: "Retomar ou marcar perdida com motivo" },
];

const qualidadeLead = [
  { canal: "WhatsApp comercial", time_dono: "Comercial", quem_comecou: "Cliente procurou", conversas: 360, responderam: 359, nunca_responderam: 1, minutos_ate_atender: 46, p90_minutos: 980, em_ate_15min: 141, em_ate_1h: 97, depois_de_1h: 122, com_telefone: 150, viraram_matricula: 13, dias_ate_comprar: 2 },
  { canal: "WhatsApp comercial", time_dono: "Comercial", quem_comecou: "Nós procuramos", conversas: 1185, responderam: 348, nunca_responderam: 837, minutos_ate_atender: null, p90_minutos: null, em_ate_15min: 0, em_ate_1h: 0, depois_de_1h: 0, com_telefone: 624, viraram_matricula: 20, dias_ate_comprar: 5 },
  { canal: "WhatsApp pré-vendas", time_dono: "Agente de Pré-vendas", quem_comecou: "Nós procuramos", conversas: 895, responderam: 281, nunca_responderam: 614, minutos_ate_atender: null, p90_minutos: null, em_ate_15min: 0, em_ate_1h: 0, depois_de_1h: 0, com_telefone: 341, viraram_matricula: 5, dias_ate_comprar: 8 },
  { canal: "Instagram COC Online", time_dono: "Marketing", quem_comecou: "Cliente procurou", conversas: 34, responderam: 34, nunca_responderam: 0, minutos_ate_atender: 569, p90_minutos: 2100, em_ate_15min: 3, em_ate_1h: 5, depois_de_1h: 26, com_telefone: 0, viraram_matricula: 0, dias_ate_comprar: null },
];
const esperaAtendimento = [
  { dia_semana: 0, nome_dia: "domingo", fim_de_semana: true, faixa_hora: 10, procuraram: 30, mediana_min: 1136, p90_min: 2400, em_ate_15min: 1, mais_de_1h: 29, nunca_respondida: 8 },
  { dia_semana: 1, nome_dia: "segunda", fim_de_semana: false, faixa_hora: 9, procuraram: 97, mediana_min: 9, p90_min: 300, em_ate_15min: 55, mais_de_1h: 32, nunca_respondida: 23 },
  { dia_semana: 2, nome_dia: "terça", fim_de_semana: false, faixa_hora: 9, procuraram: 105, mediana_min: 71, p90_min: 600, em_ate_15min: 40, mais_de_1h: 45, nunca_respondida: 15 },
  { dia_semana: 3, nome_dia: "quarta", fim_de_semana: false, faixa_hora: 9, procuraram: 85, mediana_min: 13, p90_min: 280, em_ate_15min: 46, mais_de_1h: 25, nunca_respondida: 19 },
  { dia_semana: 4, nome_dia: "quinta", fim_de_semana: false, faixa_hora: 9, procuraram: 83, mediana_min: 48, p90_min: 420, em_ate_15min: 38, mais_de_1h: 24, nunca_respondida: 20 },
  { dia_semana: 5, nome_dia: "sexta", fim_de_semana: false, faixa_hora: 9, procuraram: 72, mediana_min: 48, p90_min: 390, em_ate_15min: 31, mais_de_1h: 23, nunca_respondida: 24 },
  { dia_semana: 6, nome_dia: "sábado", fim_de_semana: true, faixa_hora: 11, procuraram: 44, mediana_min: 2356, p90_min: 3200, em_ate_15min: 1, mais_de_1h: 43, nunca_respondida: 18 },
];

const rotas0 = {
  "rpc/painel_cursos": cursosMock,
  "rpc/painel_turma_cartao": [
    { turma_id: "extensivo-2027", nome: "Extensivo 2027", produto: "Extensivo", ano: 2027, semestre: null,
      venda_de: "2026-08-01", venda_ate: "2027-07-31", dia_da_turma: 76, em_curso: true,
      alunos: 1, faturamento: 19274, ticket: 19274,
      anterior_id: "extensivo-2026", anterior_nome: "Extensivo 2026", anterior_mesmo_ponto: 3, anterior_total: 64 },
    { turma_id: "semi-extensivo-2027-1", nome: "Semi Extensivo 2027/1", produto: "Semi Extensivo", ano: 2027, semestre: 1,
      venda_de: "2026-10-01", venda_ate: "2027-04-30", dia_da_turma: 15, em_curso: true,
      alunos: 0, faturamento: 0, ticket: null,
      anterior_id: "semi-extensivo-2026-1", anterior_nome: "Semi Extensivo 2026/1", anterior_mesmo_ponto: 2, anterior_total: 119 },
  ],
  "rpc/painel_importacoes": [
    { fonte: "planilha:Vendas 2027", aba: "Vendas 2027", quando: "2026-10-16T14:41:59Z", lidas: 1253, importadas: 1, em_branco: 1252, rejeitadas: 0, status: "ok", motivos: null, linhas: null },
    { fonte: "planilha:Vendas 2026", aba: "Vendas 2026", quando: "2026-10-16T14:41:55Z", lidas: 1253, importadas: 914, em_branco: 339, rejeitadas: 0, status: "ok", motivos: null, linhas: null },
    { fonte: "planilha:Vendas 2022", aba: "Vendas 2022", quando: "2026-09-30T16:24:34Z", lidas: 794, importadas: 782, em_branco: 0, rejeitadas: 12, status: "ok", motivos: "data ilegível", linhas: "118, 204, 311, 489" },
    { fonte: "planilha:Vendas 2021", aba: "Vendas 2021", quando: "2026-09-30T16:24:39Z", lidas: 813, importadas: 809, em_branco: 0, rejeitadas: 4, status: "ok", motivos: "data ilegível", linhas: "77, 402, 598, 701" },
  ],
  "rpc/painel_funil_whats": [
    { etapa: "Sem etapa marcada", ordem: 0, pessoas: 183, matriculas: 18, por_curso: { "Missão UFSC 2026": 148, "Método ACAFE 2026/2": 17, "Extensivo 2027": 5, "Semi Extensivo 2027/1": 5, "sem curso": 6, "Semi Extensivo 2026/2": 2 }, por_vendedor: { "João": 180, "Márcia": 3 } },
    { etapa: "Aquecido pelo agente", ordem: 1, pessoas: 2, matriculas: 0, por_curso: { "Missão UFSC 2026": 2 }, por_vendedor: { "João": 2 } },
    { etapa: "Primeiro contato", ordem: 2, pessoas: 190, matriculas: 9, por_curso: { "Missão UFSC 2026": 174, "Método ACAFE 2026/2": 12, "sem curso": 3, "Semi Extensivo 2027/1": 1 }, por_vendedor: { "Márcia": 189, "João": 1 } },
    { etapa: "Qualificação", ordem: 3, pessoas: 114, matriculas: 11, por_curso: { "Missão UFSC 2026": 101, "Método ACAFE 2026/2": 9, "sem curso": 2, "Extensivo 2027": 1, "Semi Extensivo 2027/1": 1 }, por_vendedor: { "Márcia": 114 } },
    { etapa: "Negociação", ordem: 4, pessoas: 42, matriculas: 1, por_curso: { "Missão UFSC 2026": 21, "Método ACAFE 2026/2": 15, "Semi Extensivo 2027/1": 4, "Extensivo 2027": 1, "Método ACAFE 2026/1": 1 }, por_vendedor: { "Márcia": 42 } },
    { etapa: "Venda realizada", ordem: 5, pessoas: 16, matriculas: 15, por_curso: { "Missão UFSC 2026": 8, "Método ACAFE 2026/2": 6, "Semi Extensivo 2026/2": 2 }, por_vendedor: { "Márcia": 16 } },
  ],
  "rpc/painel_etiquetas_whats": [
    { etiqueta: "MÁRCIA - 67F3BBD418D12700144C2302", etiqueta_norm: "MÁRCIA", tipo: "vendedor", valor: "Márcia", pessoas: 361, ultima: "2026-10-16T19:20:12Z" },
    { etiqueta: "LIVE UFSC 2026", etiqueta_norm: "LIVE UFSC 2026", tipo: "curso", valor: "missao-ufsc-2026", pessoas: 312, ultima: "2026-10-16T18:02:00Z" },
    { etiqueta: "1° CONTATO RD", etiqueta_norm: "1° CONTATO RD", tipo: "etapa", valor: "Primeiro contato", pessoas: 190, ultima: "2026-10-16T19:20:12Z" },
    { etiqueta: "LEAD FRIO 2027", etiqueta_norm: "LEAD FRIO 2027", tipo: null, valor: null, pessoas: 7, ultima: "2026-10-15T11:40:00Z" },
  ],
  "rpc/painel_apv_dia": apvDias,
  "rpc/painel_saude_fontes": [
    { fonte: "RD Station CRM", o_que: "Negociações, etapas e matrículas do CRM", ultima: "2026-10-14T02:30:00Z", atraso_min: 4, limite_min: 30, situacao: "ok", detalhe: null, ordem: 1 },
    { fonte: "RD Station Marketing", o_que: "Conversões de formulário que viram leads captados", ultima: "2026-10-14T01:10:00Z", atraso_min: 84, limite_min: 120, situacao: "ok", detalhe: null, ordem: 2 },
    { fonte: "Planilha comercial", o_que: "Matrículas lançadas pelo time", ultima: "2026-10-13T20:05:00Z", atraso_min: 400, limite_min: 1440, situacao: "ok", detalhe: null, ordem: 3 },
    { fonte: "Pigeon Post", o_que: "Conversas e mensagens do atendimento", ultima: "2026-10-13T20:00:00Z", atraso_min: 405, limite_min: 60, situacao: "fora", detalhe: null, ordem: 4 },
    { fonte: "Rotina rd-sync", o_que: "Roda sozinha no banco e alimenta as telas", ultima: "2026-10-14T02:28:00Z", atraso_min: 6, limite_min: 20, situacao: "ok", detalhe: null, ordem: 10 },
  ],
  "rpc/painel_comparar_turmas": comparar,
  "rpc/painel_comparar_turmas_resumo": [
    { turma_id: "metodo-acafe-2026-2", nome: "Método ACAFE 2026/2", lado: "a", alunos: 208, faturamento: 133688.06, ticket: 642.73, desconto: 0.238, venda_de: "2026-07-01", venda_ate: "2026-12-31", dias_corridos: 105, em_curso: true, melhor_dia: "2026-08-20", melhor_dia_n: 20 },
    { turma_id: "metodo-acafe-2025-2", nome: "Método ACAFE 2025/2", lado: "b", alunos: 258, faturamento: 156118.45, ticket: 605.11, desconto: 0.2402, venda_de: "2025-07-01", venda_ate: "2025-12-31", dias_corridos: 183, em_curso: false, melhor_dia: "2025-09-17", melhor_dia_n: 34 },
  ],

  "rpc/painel_funil": funil,
  "rpc/painel_turmas": [
    { id: "metodo-acafe-2026-2", produto_id: "metodo-acafe", produto: "Método de Aprovação ACAFE", ano: 2026, semestre: 2, nome: "Método ACAFE 2026/2", venda_de: "2026-07-01", venda_ate: "2026-12-31", alunos: 201, faturamento: 127923.76 },
    { id: "semi-extensivo-2026-1", produto_id: "semi-extensivo", produto: "Semi Extensivo", ano: 2026, semestre: 1, nome: "Semi Extensivo 2026/1", venda_de: "2025-10-01", venda_ate: "2026-04-30", alunos: 119, faturamento: 843827.31 },
    { id: "metodo-acafe-2025-2", produto_id: "metodo-acafe", produto: "Método de Aprovação ACAFE", ano: 2025, semestre: 2, nome: "Método ACAFE 2025/2", venda_de: "2025-07-01", venda_ate: "2025-12-31", alunos: 258, faturamento: 156118.45 },
  ],
  "rpc/painel_upsell_modular": [
    { recorte: "atual", base_nomes: ["Semi Extensivo 2026/1"], alvo_nomes: ["Método ACAFE 2026/2"], pessoas_base: 119, pessoas_alvo: 201, cruzaram: 7, taxa: 0.0588, faturamento_alvo: 4843.16, ticket_alvo: 691.88, dias_medio: 198 },
    { recorte: "ano anterior", base_nomes: ["Semi Extensivo 2025/1"], alvo_nomes: ["Método ACAFE 2025/2"], pessoas_base: 162, pessoas_alvo: 258, cruzaram: 16, taxa: 0.0988, faturamento_alvo: 7844.28, ticket_alvo: 490.27, dias_medio: 212 },
  ],
  "rpc/painel_passagem_crm": [
    { identificador: "live-acafe-21-a-23-do-09", conversoes: 1031, campanhas: ["[ACAFE 26/2] LIVE"], pessoas_crm: 707, taxa: 0.6857, situacao: "atencao", primeira: "2026-08-06", ultima: "2026-10-06", diagnostico: "Parte dos inscritos não virou negociação.", sugestao: null, sugestao_produto: "metodo-acafe", sugestao_produto_nome: "Método de Aprovação ACAFE", sugestao_indicador: "inscritos_lives" },
    { identificador: "reservas-metodo-acafe-26-2", conversoes: 513, campanhas: [], pessoas_crm: 0, taxa: null, situacao: "sem_fluxo", primeira: "2026-08-25", ultima: "2026-10-07", diagnostico: "Nenhum fluxo apontado para este formulário.", sugestao: "RESERVA MÉTODO ACAFE 2026/2", sugestao_produto: "metodo-acafe", sugestao_produto_nome: "Método de Aprovação ACAFE", sugestao_indicador: "reservas" },
  ],
  "rpc/painel_passagem_dia": [
    { dia: "2026-10-05", conversoes: 96, negocios: 61, razao: 0.635 },
    { dia: "2026-10-06", conversoes: 86, negocios: 55, razao: 0.64 },
    { dia: "2026-10-07", conversoes: 113, negocios: 63, razao: 0.558 },
  ],
  "rpc/painel_cobertura_marketing": [
    { de: "2025-05-21", ate: "2026-10-08", dias_cobertos: 506, dias_faltando: 0, buraco_de: null, buraco_ate: null },
  ],
  "rpc/painel_sugestoes": [
    { tipo: "parado_30d", titulo: "Negócios abertos parados há mais de 30 dias", detalhe: "O funil não fecha", quantos: 9200, severidade: "alta", o_que_fazer: "Abrir cada um no CRM e decidir" },
    { tipo: "venda_sem_vendedor", titulo: "Matrículas na planilha sem vendedor", detalhe: "Ficam fora do ranking", quantos: 54, severidade: "alta", o_que_fazer: "Preencher a coluna de vendedor" },
  ],
  "rpc/painel_sugestoes_casos": [
    { quem: "Fulano de Tal", quando: "2026-08-14", onde: "João Pedro Beraldo", observacao: "1° Contato Feito · parado há 55 dias" },
  ],
  "rpc/painel_anuncios": [
    { anuncio: "CONHEÇA O MISSÃO UFSC", rede: "FACEBOOK", anuncio_id: "120251055072430636", pessoas: 93, conversas: 114, matriculas: 4, faturamento: 3669.4, pessoas_por_matricula: 23.3, link: "https://fb.me/4M8bdg6JW" },
    { anuncio: "CURSINHO 100% GRÁTIS", rede: "FACEBOOK", anuncio_id: "120239805365180636", pessoas: 41, conversas: 55, matriculas: 9, faturamento: 15834.2, pessoas_por_matricula: 4.6, link: null },
  ],
  "rpc/painel_etiquetas_pendentes": [
    { etiqueta: "reativação", pessoas: 63, conversoes: 206, primeira: "2026-02-10", ultima: "2026-10-01", sugestao: null },
    { etiqueta: "concoc 26/1", pessoas: 15, conversoes: 46, primeira: "2026-03-02", ultima: "2026-09-18", sugestao: null },
  ],
  etiqueta_regras: [
    { id: 1, etiqueta: "ufsc-live", produto_id: "missao-ufsc" },
    { id: 2, etiqueta: "acafe", produto_id: "metodo-acafe" },
  ],
  "rpc/painel_historico_anos": [
    { ano: 2025, temporada: "2", rotulo: "2025 · 2º semestre", alunos: 262, faturamento: 315000, ticket_medio: 597, desconto_medio: 0.1819, primeiro: "2025-01-14", ultimo: "2025-10-27", alunos_ate_hoje: 520, variacao_alunos: 0.831, variacao_ticket: -0.0524 },
    { ano: 2026, temporada: "2", rotulo: "2026 · 2º semestre", alunos: 200, faturamento: 251000, ticket_medio: 627, desconto_medio: 0.0736, primeiro: "2026-03-31", ultimo: "2026-10-07", alunos_ate_hoje: 401, variacao_alunos: -0.2288, variacao_ticket: 0.0503 },
  ],
  "rpc/painel_historico_curva": [
    { semana: 38, ano: 2025, acumulado: 420 }, { semana: 39, ano: 2025, acumulado: 470 }, { semana: 40, ano: 2025, acumulado: 520 },
    { semana: 38, ano: 2026, acumulado: 330 }, { semana: 39, ano: 2026, acumulado: 372 }, { semana: 40, ano: 2026, acumulado: 401 },
  ],
  "rpc/painel_gestao": [
    { indicador: "leads_novos", rotulo: "Leads novos", valor: 1300, detalhe: "negociação criada sem conversa nos 20 dias anteriores" },
    { indicador: "leads_conhecidos", rotulo: "Leads que já falavam com a gente", valor: 441, detalhe: "negociação criada com conversa recente no Pigeon" },
    { indicador: "requentados", rotulo: "Leads requentados", valor: 59, detalhe: "voltaram a falar depois de mais de 15 dias parados" },
    { indicador: "conversas_novas", rotulo: "Conversas abertas no período", valor: 2692, detalhe: "atendimentos que começaram no período" },
    { indicador: "conversas_andamento", rotulo: "Conversas em andamento", valor: 168, detalhe: "começaram antes e tiveram movimento no período" },
    { indicador: "primeira_conversa", rotulo: "Primeira conversa na vida", valor: 2248, detalhe: "contato que nunca tinha falado com a gente antes" },
  ],
  "rpc/painel_gestao_dia": [
    { dia: "2026-10-06", conversas_novas: 46, requentados: 1, leads_novos: 43 },
    { dia: "2026-10-07", conversas_novas: 175, requentados: 11, leads_novos: 44 },
    { dia: "2026-10-08", conversas_novas: 5, requentados: 0, leads_novos: 12 },
  ],
  "rpc/painel_vendas_periodo": [
    { dia: "2026-09-28", alunos: 9, faturamento: 6253, acumulado: 100, dia_comp: "2026-08-29", alunos_comp: 6, acumulado_comp: 71, rotulo_comp: "30 dias anteriores" },
    { dia: "2026-09-29", alunos: 4, faturamento: 2779, acumulado: 104, dia_comp: "2026-08-30", alunos_comp: 5, acumulado_comp: 76, rotulo_comp: "30 dias anteriores" },
    { dia: "2026-09-30", alunos: 6, faturamento: 4100, acumulado: 110, dia_comp: "2026-08-31", alunos_comp: 3, acumulado_comp: 79, rotulo_comp: "30 dias anteriores" },
  ],
  "rpc/painel_vendas_detalhe": [
    { data: "2026-09-30", aluno: "Fulana de Tal", curso: "Método ACAFE", vendedor: "Márcia",
      valor_tabela: 894.8, desconto: 0.11, valor_venda: 794.9, cidade: "Blumenau", turma: "Método ACAFE 2026/2" },
  ],
  "rpc/sugerir_regra": [
    { produto_id: "missao-ufsc", produto: "Missão UFSC", indicador: "material_rico", confianca: "o nome diz o curso e o tipo" },
  ],
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
    { indicador: "leads", rotulo: "Leads captados", meta: 3400, realizado: 1907, atingido: 0.5609, esperado_hoje: 2105, situacao: "atencao", identificadores: ["live-acafe-21-a-23-do-09"], por_crm: 680, por_formulario: 453, tem_regra: true, desde: "2026-08-07" },
    { indicador: "inscritos_lives", rotulo: "Inscritos nas lives", meta: 1050, realizado: 571, atingido: 0.5438, esperado_hoje: 650, situacao: "atencao", identificadores: ["live-acafe-21-a-23-do-09"], por_crm: 680, por_formulario: 453, tem_regra: true, desde: "2026-08-07" },
    { indicador: "reservas", rotulo: "Reservas", meta: 300, realizado: 280, atingido: 0.9333, esperado_hoje: 186, situacao: "no_ritmo", desde: "2026-08-25" },
  ],
  "rpc/painel_tags": [{ tag: "ufsc-simulado", leads: 112, conversoes: 140 }, { tag: "acafe-live", leads: 83, conversoes: 95 }],
  "rpc/painel_higiene": [{ motivo: "Lead duplicado", descartadas: 98, fatia_do_total: 0.69 }],
  "rpc/solicitar_acesso": "registrada",
  solicitacoes_acesso: [{ email: "novo@coconline.com.br", nome: "Pessoa Nova", mensagem: "acompanhar metas", criada_em: "2026-10-02T12:00:00Z", situacao: "pendente" }],
  produtos: [
    { id: "metodo-acafe", nome: "Método de Aprovação ACAFE", ordem: 1, duas_temporadas: true, conta_aluno: true },
    { id: "semi-extensivo", nome: "Semi Extensivo", ordem: 2, duas_temporadas: true, conta_aluno: true },
    { id: "prep-enem", nome: "Preparação ENEM", ordem: 5, duas_temporadas: false, conta_aluno: true },
    { id: "material", nome: "Material avulso", ordem: 90, duas_temporadas: false, conta_aluno: false },
    { id: "outros", nome: "Outros", ordem: 99, duas_temporadas: false, conta_aluno: true },
  ],
  metas: [{ nivel: 2, alunos: 263, faturamento: 185673 }],
  fases: fases,
  "rpc/painel_origem_matriculas": origemMat,
  indicadores_captacao: [
    { id: "leads", nome: "Leads captados", ajuda: "Pessoa que entrou no funil do comercial.", conta_como_lead: true, ordem: 10 },
    { id: "material_rico", nome: "Material rico (lead frio)", ajuda: "Vai para o Agente de Pré-vendas.", conta_como_lead: false, ordem: 40 },
  ],
  "rpc/painel_insights": [
    { chave: "resposta:1", tipo: "resposta_pendente", publico: "comercial", prioridade: 1,
      titulo: "Ingrid Prigol falou e ficou sem resposta",
      detalhe: "A última mensagem da conversa é do cliente, há 31h.",
      numero: "há 31h", pessoa: "João Pedro Beraldo", link: "/comercial/?v=gestao" },
    { chave: "ritmo:acafe", tipo: "campanha_atras", publico: "diretoria", prioridade: 2,
      titulo: "Método ACAFE 2º/2026 está atrás do ritmo",
      detalhe: "Faltam 60 alunos para a meta e 18 dias de campanha.",
      numero: "60 alunos", pessoa: null, link: "/campanha/" },
  ],
  "rpc/painel_qualidade_lead": qualidadeLead,
  "rpc/painel_filtros_conversa": [
    { tipo: "atendente", valor: "João", rotulo: "João", quantos: 930 },
    { tipo: "atendente", valor: "Márcia", rotulo: "Márcia", quantos: 879 },
    { tipo: "turma", valor: "missao-ufsc-2026", rotulo: "Missão UFSC 2026", quantos: 696 },
  ],
  "rpc/painel_espera_atendimento": esperaAtendimento,
  "rpc/painel_escapando": escapando,
  "rpc/painel_escapando_resumo": escapandoResumo,
  "rpc/painel_ritmo": ritmo,
  // Uma fonte fora, para a tarja de dado desatualizado aparecer na conferência.
  "rpc/painel_fontes": [
    { fonte: "RD Station CRM", o_que: "Negociações, etapas e matrículas do CRM", ultima: "2026-10-10T05:50:03Z", atraso_min: 3, limite_min: 30, situacao: "ok", detalhe: null },
    { fonte: "Planilha comercial", o_que: "Matrículas lançadas pelo time", ultima: "2026-10-10T05:41:52Z", atraso_min: 11, limite_min: 1440, situacao: "ok", detalhe: null },
    { fonte: "Rotina pigeon-mensagens", o_que: "Roda sozinha no banco e alimenta as telas", ultima: "2026-10-09T23:00:00Z", atraso_min: 413, limite_min: 90, situacao: "fora", detalhe: "Última corrida falhou: ERROR: apenas administradores" },
  ],
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
  pessoas_fila: [
    { id: 1, nome: "Marcia Laurett", apelidos: ["Marcia", "Marcia  Laurett"], telefone: "47999990001", ativo: true },
    { id: 2, nome: "João Pedro Beraldo", apelidos: ["João"], telefone: "47999990002", ativo: true },
  ],
  "rpc/fila_donos_sem_cadastro": [{ dono: "Tarso Brietzke Iracet", quantos: 33 }, { dono: "Kathleen", quantos: 3 }],
  "rpc/fila_ultimos_envios": [
    { nome: "Marcia Laurett", itens: 212, enviado_em: "2026-10-23T11:30:09Z" },
    { nome: "(consolidado)", itens: 0, enviado_em: "2026-10-23T11:30:12Z" },
  ],
  "rpc/painel_perdas_pessoas": [
    { pessoa: "Renata Lima", telefone: "47988112233", email: "renata@exemplo.com", quando: "2026-10-12",
      onde: "Sem retorno", atendente: "Marcia Laurett", virou_matricula: false,
      link: "https://pigeon.runus.com.br/redirect?type=SESSION&id=ghi" },
  ],
  "rpc/painel_parados_pessoas": [
    { pessoa: "Caio Ferreira", telefone: "48997654321", email: null, quando: "2026-09-02",
      onde: "Funil principal · Negociação · parado há 58 dias", atendente: "João Pedro Beraldo",
      virou_matricula: false, link: null },
  ],
  "rpc/painel_qualidade_pessoas": [
    { pessoa: "Marina Alves", telefone: "47999887766", quando: "2026-10-20",
      onde: "WhatsApp comercial · Nós procuramos · nunca respondeu", atendente: "Marcia",
      primeira_mensagem: null, virou_matricula: false,
      link: "https://pigeon.runus.com.br/redirect?type=SESSION&id=jkl" },
  ],
  "rpc/painel_anuncio_pessoas": [
    { pessoa: "Ana Clara", telefone: "47988112233", quando: "2026-10-18", conversas: 2, atendente: "Marcia",
      primeira_mensagem: "Olá! Tenho interesse no curso Missão UFSC", virou_matricula: true, curso: "Missão UFSC",
      link: "https://pigeon.runus.com.br/redirect?type=SESSION&id=abc" },
    { pessoa: "Bruno Henrique", telefone: "48997654321", quando: "2026-10-17", conversas: 1, atendente: "João",
      primeira_mensagem: null, virou_matricula: false, curso: null, link: null },
  ],
  "rpc/painel_pendencia_pessoas": [
    { pessoa: "Carla Souza", telefone: "47988468060", email: "carla@exemplo.com", quando: "2026-10-16",
      onde: "Funil principal · Negociação", virou_matricula: false,
      link: "https://pigeon.runus.com.br/redirect?type=SESSION&id=def" },
  ],
  "rpc/fila_da_pessoa": "*Sua fila · 23/10*\n\n212 itens estão esperando você.",
};


const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });

await ctx.route(`**/${REF}.supabase.co/**`, (route) => {
  const url = new URL(route.request().url());
  const alvo = url.pathname.replace("/rest/v1/", "");
  const chave = Object.keys(rotas0).find((k) => alvo === k);
  const corpo = chave ? rotas0[chave] : [];
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
  ([ref, s]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
    localStorage.setItem("acompanhando", JSON.stringify(["extensivo-2027", "semi-extensivo-2027-1"]));
  },
  [REF, sessao]
);

const pg = await ctx.newPage();
const erros = [];
pg.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
pg.on("pageerror", (e) => erros.push("pageerror: " + e.message));

const telas = [
  ["/ajustes/", "Cadastro de campanhas"],
  ["/ajustes/?v=cursos", "Para onde cada curso"],
  ["/ajustes/?v=sistema", "Pedidos de acesso"],
  ["/marketing/?v=classificar", "O que chegou sem curso apontado"],
  ["/marketing/?v=anuncios", "Quem chega pelo anúncio"],
  ["/marketing/?v=passagem", "Do marketing para o comercial"],
  ["/?v=operacao", "Quem chegou no período"],
  ["/", "Metas de captação"],
  ["/campanha/", "Da origem à matrícula"],
  ["/campanha/?v=historico", "O mesmo curso, ano a ano"],
  ["/campanha/?v=comparar", "Turma contra turma"],
  ["/campanha/?v=upsell", "Quem comprou um, comprou o outro?"],
  ["/comercial/?v=agente", "O agente está aquecendo"],
  ["/comercial/?v=qualidade", "Quem chega, quem responde, quanto espera"],
  ["/comercial/?v=atendimento", "O tamanho de cada buraco"],
  ["/comercial/?v=lancamentos", "Matrícula por matrícula"],
  ["/comercial/", "Agente de Pré-vendas"],
  ["/marketing/", "Formulário embutido"],
  ["/guia/", "O que você quer saber?"],
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


// As gavetas de gente: o numero agregado tem que abrir a lista de quem.
for (const [rota, celula, esperado, arquivo] of [
  ["/marketing/?v=anuncios", "Ana Clara", "Quem chegou por esta peça", "anuncio_pessoas"],
  ["/marketing/?v=classificar", "Carla Souza", "Abrir no Pigeon", "classificar_pessoas"],
  ["/comercial/", "Caio Ferreira", "Quem está parado nesta etapa", "time_parados"],
  ["/comercial/?v=qualidade", "Marina Alves", "Todas as conversas", "qualidade_pessoas"],
]) {
  erros.length = 0;
  await pg.goto("http://127.0.0.1:4599" + rota, { waitUntil: "networkidle" });
  await pg.locator("td.abre").first().click();
  await pg.waitForTimeout(700);
  const corpo = await pg.textContent("body");
  const achou = corpo.includes(esperado) && corpo.includes(celula);
  if (!achou || erros.length) falhou = true;
  console.log((rota + " · gaveta").padEnd(13), achou ? "render ok" : `FALTA "${esperado}"`,
    erros.length ? "| ERRO: " + erros.join(" ~ ").slice(0, 200) : "|");
  await pg.screenshot({ path: `/tmp/claude-0/tela_${arquivo}.png`, fullPage: true });
}

// Telas com dois modos: o segundo so aparece depois do clique.
for (const [rota, botao, esperado, arquivo] of [
  ["/marketing/?v=classificar", /^Etiquetas/, "Etiquetas sem curso", "classificar_etiquetas"],
  ["/comercial/?v=atendimento", /^Diagnóstico/, "Quanto tempo o card fica parado", "atendimento_diagnostico"],
  ["/comercial/?v=lancamentos", /^O que vale conferir/, "Lista de conferência", "lancamentos_conferir"],
]) {
  erros.length = 0;
  await pg.goto("http://127.0.0.1:4599" + rota, { waitUntil: "networkidle" });
  await pg.getByRole("button", { name: botao }).click();
  await pg.waitForTimeout(700);
  const corpo = await pg.textContent("body");
  const achou = corpo.includes(esperado);
  if (!achou || erros.length) falhou = true;
  console.log((rota + " · 2o modo").padEnd(13), achou ? "render ok" : `FALTA "${esperado}"`,
    erros.length ? "| ERRO: " + erros.join(" ~ ").slice(0, 300) : "|");
  await pg.screenshot({ path: `/tmp/claude-0/tela_${arquivo}.png`, fullPage: true });
}

// O registro de blocos em lib/telas.ts alimenta a busca. Se alguem renomear um
// h2 e esquecer o registro, a busca passa a mandar a pessoa para um quadro que
// nao existe mais com aquele nome. Entao a conferencia compara os dois.
for (const area of AREAS) {
  for (const tela of area.telas) {
    if (!tela.blocos) continue;
    const rota = tela.id === area.telas[0].id ? area.href : `${area.href}?v=${tela.id}`;
    await pg.goto("http://127.0.0.1:4599" + rota, { waitUntil: "networkidle" });
    await pg.waitForTimeout(600);
    const naTela = (await pg.$$eval("main h2", (hs) => hs.map((h) => (h.textContent ?? "").trim())))
      .map((t) => t.replace(/^\d+\s*/, "").trim());
    const igual = naTela.length === tela.blocos.length
      && naTela.every((t, i) => t === tela.blocos[i]);
    if (!igual) falhou = true;
    console.log(("blocos " + rota).padEnd(13), igual ? "render ok" : "FORA DO REGISTRO",
      igual ? "|" : "| tela: " + JSON.stringify(naTela) + " registro: " + JSON.stringify(tela.blocos));
  }
}

// A busca: escrever uma palavra que nao e o nome da tela tem que levar nela.
for (const [termo, esperado] of [
  ["vendedor", "Comercial · Time"],
  ["etiqueta", "Marketing · A classificar"],
  ["340", "Comercial · Qualidade do lead"],
  ["vendas por dia", "Vendas dia a dia"],
  ["matriculas dia a dia", "dia a dia"],
  ["311", "Vendas dia a dia"],
  ["motivo de perda", "Motivos de perda"],
]) {
  erros.length = 0;
  await pg.goto("http://127.0.0.1:4599/", { waitUntil: "networkidle" });
  await pg.getByRole("button", { name: /Procurar/ }).click();
  await pg.locator(".busca-campo").fill(termo);
  await pg.waitForTimeout(250);
  const primeiro = (await pg.locator(".busca-lista button").first().textContent()) ?? "";
  const achou = primeiro.includes(esperado);
  if (!achou || erros.length) falhou = true;
  console.log(("busca: " + termo).padEnd(13), achou ? "render ok" : `FALTA "${esperado}" (veio "${primeiro.slice(0, 60)}")`,
    erros.length ? "| ERRO: " + erros.join(" ~ ").slice(0, 200) : "|");
  if (termo === "etiqueta") await pg.screenshot({ path: "/tmp/claude-0/tela_busca.png" });
}

// Retratos para olho humano: notebook, que é onde a maioria usa, e telefone.
// A conferência acima diz que renderizou; estas dizem se dá para ler.
const retratos = [
  ["notebook", 1280, 800, ["/", "/campanha/", "/comercial/", "/comercial/?v=atendimento", "/campanha/?v=comparar", "/campanha/?v=upsell", "/guia/"]],
  ["telefone", 390, 844, ["/", "/campanha/", "/comercial/", "/marketing/?v=classificar", "/campanha/?v=comparar", "/comercial/?v=lancamentos", "/ajustes/"]],
];
for (const [nome, width, height, rotas] of retratos) {
  const c2 = await b.newContext({ viewport: { width, height } });
  await c2.route(`**/${REF}.supabase.co/**`, (route) => {
    const alvo = new URL(route.request().url()).pathname.replace("/rest/v1/", "");
    const chave = Object.keys(rotas0).find((k) => alvo === k);
    route.fulfill({ status: 200, contentType: "application/json",
      headers: { "content-range": "0-1/2", "access-control-allow-origin": "*" },
      body: JSON.stringify(chave ? rotas0[chave] : []) });
  });
  await c2.addInitScript(([ref, s]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
    localStorage.setItem("acompanhando", JSON.stringify(["extensivo-2027", "semi-extensivo-2027-1"]));
  }, [REF, sessao]);
  const p2 = await c2.newPage();
  for (const r of rotas) {
    await p2.goto("http://127.0.0.1:4599" + r, { waitUntil: "networkidle" });
    await p2.waitForTimeout(600);
    await p2.screenshot({ path: `/tmp/claude-0/${nome}${r.replace(/[/?=]/g, "_")}.png` });
    await p2.evaluate(() => window.scrollTo(0, 700));
    await p2.waitForTimeout(400);
    await p2.screenshot({ path: `/tmp/claude-0/${nome}${r.replace(/[/?=]/g, "_")}-rolado.png` });
  }
  // O balão do gráfico, com o mouse em cima de um ponto.
  if (nome === "notebook") {
    await p2.goto("http://127.0.0.1:4599/comercial/", { waitUntil: "networkidle" });
    await p2.waitForTimeout(500);
    const alvo = await p2.$(".grafico svg rect[tabindex]");
    if (alvo) {
      await alvo.hover();
      await p2.waitForTimeout(400);
      await p2.screenshot({ path: `/tmp/claude-0/${nome}-balao.png` });
    }
    // E o Ⓘ aberto.
    const i = await p2.$(".ajuda > button");
    if (i) {
      await i.hover();
      await p2.waitForTimeout(400);
      await p2.screenshot({ path: `/tmp/claude-0/${nome}-ajuda.png` });
    }
  }

  // A gaveta de insights, aberta.
  await p2.goto("http://127.0.0.1:4599/", { waitUntil: "networkidle" });
  await p2.click(".estrela");
  await p2.waitForTimeout(400);
  await p2.screenshot({ path: `/tmp/claude-0/${nome}-insights.png` });
  await c2.close();
}

await b.close();
process.exit(falhou ? 1 : 0);
