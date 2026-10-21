-- Update 34 — duas brechas que eu abri, e a numeração de volta.
--
-- SEGURANÇA. Criei duas coisas nos últimos dias e esqueci de fechar as duas:
--
--   insights_cache  ficou sem RLS, legível por qualquer um com a chave pública
--                   do site. O Supabase marcou como CRITICAL, e com razão.
--   conversas_mv    é view materializada, que não aceita RLS, e estava
--                   selecionável por anon e authenticated. Ali tem nome e
--                   telefone de 5.400 pessoas.
--
-- As duas foram fechadas. Ninguém precisa ler direto: quem lê é a função, que
-- roda com a permissão do dono do banco e já filtra por usuário autorizado.
--
-- Varri o resto do aviso de segurança. O que sobrou é por desenho:
--   - 54 funções SECURITY DEFINER chamáveis por usuário logado. É o modelo do
--     painel inteiro, e conferi uma a uma: as sensíveis (aprovar_acesso,
--     disparar_funcao, integracao_configurar, n8n_configurar, rd_configurar_app)
--     todas exigem is_admin() por dentro.
--   - solicitar_acesso chamável por anônimo: é de propósito, é o pedido de
--     acesso da tela de login.
--   - curso_produto, etiquetas_whats e rd_contatos com RLS ligado e nenhuma
--     política: isso é seguro, quer dizer que ninguém lê direto.

alter table insights_cache enable row level security;
revoke all on conversas_mv from anon, authenticated;
revoke all on insights_cache from anon, authenticated;
