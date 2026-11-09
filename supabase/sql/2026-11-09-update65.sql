-- Update 65 — as três primeiras dicas de desempenho, implementadas
--
-- Nada de banco neste update: as três mudanças são no navegador e nas funções
-- que falam com RD e Pigeon. O registro fica aqui para a sequência não quebrar.

-- 1. CHAMADAS DUPLICADAS (dica 03). O painel é um site de uma página só: trocar
--    de aba não recarrega o navegador, mas remonta os componentes, e cada um
--    volta a pedir o que precisa. Medindo as chamadas reais, três consultas
--    rodavam de novo em TODA navegação:
--      resumo_campanhas          2.687 chamadas
--      última sincronização      2.667
--      is_autorizado/is_admin/meu_papel   uma vez por troca de aba
--    Agora existe um cache curto compartilhado (lib/cache.ts) que guarda a
--    resposta por um tempo e, tão importante quanto, junta chamadas iguais
--    feitas ao mesmo tempo: três blocos da mesma tela pedindo a lista de
--    campanhas viram uma consulta só. O botão de atualizar e a volta de cinco
--    minutos limpam o cache, então ninguém fica olhando número velho.

-- 2. PRAZO POR CHAMADA EXTERNA (dica 12). rd-sync, pigeon-sync e
--    pigeon-mensagens tinham orçamento de tempo total mas nenhum limite por
--    chamada: um pedido pendurado no RD ou no Pigeon comia o orçamento inteiro
--    e a rodada não terminava, sem erro visível. Foi assim que 04/09 a 26/09 de
--    2026 sumiu da conversão de marketing. Agora cada chamada tem 20 segundos,
--    e no laço de marketing o dia que estourar o prazo volta para a fila em vez
--    de derrubar a rodada.

-- 3. TELAS SKELETON (dica 01). As 72 telas que escreviam "Carregando" passaram
--    a desenhar a forma do que vem: tabela, faixa de números, cartões ou
--    gráfico. Além de parecer mais rápido, a altura certa impede a página de
--    pular quando o conteúdo entra.

-- Efeito colateral bom: a fila do RD Marketing que eu baixei para 2023 no
-- update 63 drenou sozinha. O histórico de conversão por página e formulário
-- agora cobre 1.409 dias, de 01/01/2023 até hoje:
--   2023: 6.754 conversões   2024: 3.732   2025: 11.880   2026: 17.103
