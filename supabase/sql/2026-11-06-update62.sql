-- Update 62 — a lentidão do painel inteiro, e o furo de autorização em 15 funções
--
-- A medição veio do pg_stat_statements, que guarda o tempo real das chamadas que
-- o site faz. Antes disso eu estava medindo no escuro.

-- 1. FURO DE AUTORIZAÇÃO. 15 funções eram SECURITY DEFINER, ou seja ignoram RLS,
--    e não tinham checagem nenhuma: qualquer conta logada, inclusive pedido de
--    acesso ainda não aprovado, conseguia ler conversa, funil e pessoa.
--    Cada uma virou um par: a de dentro (<nome>_aberto) sem permissão para
--    ninguém, e uma casca com o mesmo nome e a mesma assinatura que filtra em
--    is_autorizado(). Nenhuma tela mudou.
--    painel_apv_dia, painel_comparar_turmas, painel_comparar_turmas_resumo,
--    painel_escapando, painel_escapando_resumo, painel_espera_atendimento (duas
--    assinaturas), painel_filtros_conversa, painel_funil_whats,
--    painel_passagem_crm, painel_pessoa_ficha, painel_qualidade_lead,
--    painel_saude_fontes, painel_tempo_etapa, painel_whats_crm

-- 2. A TARJA DE SAÚDE DAS FONTES rodava em TODA tela e lia o histórico do cron
--    duas vezes por rotina. Essa tabela é do pg_cron e não aceita índice nosso,
--    então eram 18 varreduras de 11 MB por abertura de tela: 1,3 s antes de
--    qualquer número aparecer, 1.558 vezes só no período medido.
--    Agora a conta roda de dois em dois minutos e a tela lê uma tabela de seis
--    linhas. 1.326 ms -> 51 ms.
--    A linha "Vigilância das fontes" aparece quando o próprio cache está velho,
--    para a tela nunca mostrar foto antiga com cara de atual.

-- 3. ÍNDICES QUE FALTAVAM. Medidas antes e depois, com dado real:
--    painel_metas_leads            1.828 ms -> 96 ms   (3.445 chamadas, 1h45 de banco)
--    painel_metas_leads_todas      1.829 ms -> 136 ms
--    painel_motivos_perda          3.718 ms -> 980 ms
--    painel_gestao (Operação)      5.132 ms -> 1.175 ms
--    painel_saude_fontes           1.326 ms -> 51 ms
create index if not exists rd_negociacoes_campanha_rd on public.rd_negociacoes ((btrim(campanha_rd)), criado_em);
create index if not exists rd_negociacoes_status_fechado on public.rd_negociacoes (status, fechado_em);
create index if not exists rd_negociacoes_motivo on public.rd_negociacoes (motivo_perda) where status = 'perdida';
create index if not exists rd_conversoes_diarias_ident_dia on public.rd_conversoes_diarias (identificador, dia);
create index if not exists rd_conversoes_diarias_dia on public.rd_conversoes_diarias (dia);
create index if not exists captacao_regras_indicador on public.captacao_regras (indicador, tipo);
create index if not exists pigeon_conversas_contato_inicio on public.pigeon_conversas (contato_id, inicio desc) include (ultima_interacao);
create index if not exists pigeon_conversas_ultima on public.pigeon_conversas (ultima_interacao);
create index if not exists vendas_atualizado_em on public.vendas (atualizado_em desc);
create index if not exists sincronizacoes_fonte_fim on public.sincronizacoes (fonte, terminado_em desc);
create index if not exists sincronizacoes_status_fim on public.sincronizacoes (status, terminado_em desc);

-- 4. O histórico de conversa do Pigeon começa em 04/03/2026, não em 01/08/2026
--    como o painel dizia em quatro lugares. Março a novembro tem volume parecido
--    e atendente preenchido em todos os meses. A constante DESDE_CONVERSAS foi
--    corrigida, e a janela de A classificar, que começa em agosto por escolha e
--    não por falta de dado, ganhou constante própria (DESDE_CLASSIFICAR).

-- 5. Ainda na fila, por ordem de tamanho: painel_gestao (1.175 ms),
--    painel_motivos_perda (980 ms) e painel_turmas (500 ms).
