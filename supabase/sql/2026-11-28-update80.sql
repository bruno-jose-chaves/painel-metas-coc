-- Update 80: horário de Brasília no banco (B20) e leitura por papel (B11, parte 1).
-- Aplicado em 28/11/2026.
--
-- B20
--   alter database postgres set timezone to 'America/Sao_Paulo';
--   Toda sessão nova conta "hoje", ::date e date_trunc em horário de Brasília.
--   O horário das rotinas do pg_cron não muda (cron.timezone continua GMT).
--   As funções que cortavam o dia em UTC de propósito (at time zone 'UTC')
--   passaram a cortar em 'America/Sao_Paulo': painel_espera_atendimento_aberto,
--   painel_qualidade_pessoas, conversas_sem_card, resumo_do_dia,
--   painel_whats_crm_aberto, painel_qualidade_lead_aberto,
--   painel_filtros_conversa_aberto. pigeon_conversas.inicio é UTC de verdade,
--   então o dia contado em UTC jogava a conversa das 21h para o dia seguinte.
--
-- B11 (parte 1): leitura direta só para a diretoria nas tabelas com dado
-- pessoal que o site não lê direto (as telas usam funções):
alter policy "pigeon_contatos_leitura" on public.pigeon_contatos using ((select is_admin()));
alter policy "pigeon_conversas_leitura" on public.pigeon_conversas using ((select is_admin()));
alter policy "leitura autorizados" on public.conversas_eventos using ((select is_admin()));
alter policy "leitura autorizados" on public.rd_webhook_eventos using ((select is_admin()));
alter policy "leitura autorizados" on public.solicitacoes_acesso using ((select is_admin()));
alter policy "leitura autorizados" on public.usuarios_autorizados using ((select is_admin()) or email = (select email_atual()));
-- vendas e rd_negociacoes continuam com leitura para todo autorizado: 30 funções
-- de tela leem essas tabelas como quem chama. Fechar exige passar essas funções
-- para security definer com o filtro de papel, e decidir se o comercial vê a
-- venda dos colegas.
