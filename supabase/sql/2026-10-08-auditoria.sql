-- Auditoria completa das 28 funções do painel, chamadas como usuário logado.
-- Aplicado direto no banco em 08/10/2026.

-- 1. Três funções morriam caladas no site porque liam coluna pessoal que o
--    usuário logado não tem: painel_recompra e painel_upsell_origem (vendas
--    email_norm, telefone_norm, nome_norm) e painel_tags (rd_conversoes
--    email_norm). Passaram a rodar como donas, em plpgsql, com guarda na
--    entrada: if not is_autorizado() then return; end if.

-- 2. painel_pendencias tinha ficado com duas assinaturas. Chamada com um
--    argumento, o Postgres não sabia escolher.
--    alter function painel_pendencias(date) rename to painel_pendencias_v1;

-- 3. A escada de fases perdia a venda feita antes da primeira fase. No ACAFE
--    2º/2026 o cartão dizia 200 alunos e a escada somava 140, e cada fase
--    parecia pior do que está. Nova linha de ordem zero, Antes da campanha.

-- 4. Da origem à matrícula não filtrava por curso: na tela do ACAFE apareciam
--    Reservas MISSÃO UFSC com 305 negócios e [UFSC 26/2] LIVE com 289, todas
--    com zero matrícula. Agora entra o negócio do curso da campanha mais o que
--    ainda não foi classificado, que precisa continuar à vista.

-- 5. A série diária de conversões pulava o dia sem conversão, então o gráfico
--    comprimia o período e a média por dia dividia pelos dias com movimento.
--    Em 30 dias com 11 de movimento a média saía 131 em vez de 48.

-- 6. Permissão: o papel anon podia chamar as funções do painel, porque o
--    Postgres concede execute a PUBLIC por padrão e revoke from anon não
--    resolve isso. Tirado de PUBLIC e devolvido só a authenticated. Apenas
--    solicitar_acesso continua aberta, porque é o pedido de acesso da tela de
--    login. Todas as funções do painel ganharam search_path fixo.

-- O corpo de cada função está no banco. Os corpos completos das que mudaram
-- nesta rodada foram aplicados pelas migrações:
--   definer_com_guarda_plpgsql
--   pendencias_tirar_assinatura_antiga
--   fases_anteriores_e_origem_por_curso
--   leads_dia_serie_completa
--   tirar_execute_do_anon
--   fechar_execute_publico

-- Pendente de decisão do Bruno, não aplicado:
--   Etiqueta duplicada por pontuação: lista-acafe-2024 e lista acafe 2024 são
--   a mesma coisa, 42 conversões somadas. Normalizar mudaria o nome exibido,
--   que é o que ele vai usar para escrever regra de curso. Fica em T6.
--   Proteção de senha vazada no Supabase Auth está desligada. É configuração
--   de conta, ele decide.
