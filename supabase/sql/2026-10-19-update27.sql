-- Update 27 — "O que está escapando": a fila única do que some sem ninguém ver.
--
-- Cada vazamento já existia em algum canto do painel, em tela diferente, com
-- recorte diferente. Lead some por quatro caminhos distintos e nenhum deles
-- tinha dono na rotina do dia. Quem abre o painel de manhã não vai caçar
-- problema em quatro telas para descobrir se existe problema.
--
-- O valor da negociação ficou de fora da ordenação de propósito: está
-- preenchido em 1 de 1.991 negociações abertas. Ordenar por um campo que o time
-- não preenche é inventar prioridade.

-- painel_escapando(limite) — a fila, ordenada por quanto custa deixar parado:
--   1. Pagamento pendente (Aguardando Pagamento há mais de 7 dias)
--   2. Conversa sem card (falou no WhatsApp, não existe negociação)
--   3. Negociação parada (Negociação há mais de 30 dias)
-- Cada linha traz nome, telefone, dono, onde está, há quantos dias e o que fazer.

-- painel_escapando_resumo() — o retrato de cima, incluindo o que NÃO entra na
-- fila: Qualificação parada (364) e Lead do SDR sem contato (5.701). Volume
-- desse tamanho não é tarefa de pessoa, é decisão de base, e misturar as duas
-- coisas transforma a fila em lixeira.

-- resumo_do_dia: entra a linha de pagamento pendente. São 28 negociações com
-- link enviado há mais de uma semana, 48 dias na mediana. É a venda mais perto
-- de acontecer que existe, e ninguém olhava.

-- painel_saude_fontes: as rotinas resumo-whats e resumo-whats-conferir saem da
-- lista de rotinas vigiadas. Já existe a fonte "Resumo diário no WhatsApp", que
-- mede a coisa certa (se a mensagem chegou, não se o cron disparou). Contadas
-- duas vezes, apareciam como "fora" no dia em que foram criadas e a própria
-- mensagem abria avisando sobre si mesma.

-- enviar_resumo_whats / conferir_resumo_whats: o disparo é assíncrono, então
-- marcar a entrega no disparo faz a marca mentir justamente no caso que ela
-- existe para pegar, que é o n8n estar fora do ar. O envio só guarda o número
-- da requisição; quem marca é a conferência, cinco minutos depois, se a
-- resposta tiver voltado 2xx.
--   cron resumo-whats           '0 23 * * *'  -> enviar_resumo_whats()
--   cron resumo-whats-conferir  '5 23 * * *'  -> conferir_resumo_whats()
--
-- O fluxo antigo do n8n foi despublicado. O resumo agora é empurrado pelo
-- Supabase para o webhook, e o agendador do n8n saiu do caminho de vez.
