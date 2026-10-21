-- Update 33 — o último lento, e a conta de quanto o painel realmente pesa.
--
-- Medindo as funções três vezes seguidas, já como usuário logado, a diferença
-- entre primeira e segunda chamada separou dois problemas que pareciam um só:
--
--   painel_escapando     2.603 ms -> 147 ms na segunda chamada
--   painel_metas_leads   2.137 ms -> 239 ms na segunda chamada
--   painel_recompra      1.457 ms -> 1.459 ms -> 1.571 ms
--
-- As duas primeiras são custo de montar o plano, que acontece uma vez por
-- conexão e não vale otimizar. A terceira era lentidão de verdade.
--
-- O casamento de pessoa em painel_recompra era um EXISTS só com três OR
-- dentro (e-mail, telefone e nome). OR dentro de EXISTS obriga o banco a
-- varrer a lista inteira, porque nenhum índice cobre as três colunas de uma
-- vez. Quebrado em três EXISTS, cada um usa o índice da sua coluna.
--
--   1.500 ms -> 83 ms, com os cinco indicadores idênticos.
--
-- Índice novo: vendas(nome_norm), que faltava. Os de e-mail e telefone já
-- existiam, e é por isso que só o nome varria tudo.

create index if not exists vendas_nome_norm_idx on vendas (nome_norm);

-- PENDENTE DE LIMPEZA: três índices sobrando, dois deles criados por mim sem
-- perceber que já existia equivalente. A ferramenta de administração recusa
-- DROP. Rodar à mão no SQL Editor do Supabase:
--   drop index if exists rd_contatos_fone_idx;        -- duplica rd_contatos_telefone_norm_idx
--   drop index if exists rd_negociacoes_contato_idx;  -- duplica rd_negociacoes_contato_id_idx
--   drop index if exists conversas_mv_fone;           -- nunca foi usado
