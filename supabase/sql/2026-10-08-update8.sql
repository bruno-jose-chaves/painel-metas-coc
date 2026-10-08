-- Update 8. Aplicado direto no banco em 08/10/2026.

-- 1. Mensagens do Pigeon. Edge function pigeon-mensagens lê
--    /chat/v1/session/{id}/message e grava a primeira frase do cliente em
--    pigeon_conversas.primeira_mensagem_cliente. No Pigeon, FROM_HUB é a
--    mensagem que veio do cliente e TO_HUB é a que a empresa mandou: o nome
--    engana, e é essa inversão que mantinha o terceiro degrau zerado.
--    Roda de dois em dois minutos enquanto varre o histórico.

-- 2. De para de etiqueta para curso. Tabela etiqueta_regras, função
--    painel_etiquetas_pendentes(p_desde, p_minimo) e tela em Marketing.
--    As etiquetas que já traziam o nome do curso foram apontadas de uma vez:
--    13 regras, todas com nome inequívoco. O resto espera decisão do Bruno.

-- 3. Cascata de classificação em cinco degraus: campanha do CRM, etiqueta,
--    anúncio do Pigeon, primeira frase do cliente, sem classificação. O degrau
--    do anúncio passou a ler o utm da conversa além do contato, e a considerar
--    o texto da peça: nome de campanha como "SEJA O PRÓXIMO APROVADO" não diz
--    o curso, mas o texto diz. Saiu de 0 para 58 leads classificados por aí.
--    A assinatura mudou, então a antiga virou classificar_leads_v1.

-- 4. T4, histórico entre anos: painel_historico_anos(p_produto) e
--    painel_historico_curva(p_produto, p_anos). Alinhado pela semana do ano,
--    não pelo dia da campanha, porque a campanha muda de data a cada ano.

-- 5. T10, anúncio de clique para WhatsApp: painel_anuncios(p_de, p_ate,
--    p_produto), lendo o utm que o Pigeon guarda na conversa e no contato.
--    A coluna chama pessoas_por_matricula, não custo: custo exige a verba da
--    peça, que o painel não recebe.

-- 6. Resumo diário: resumo_do_dia(p_dia) devolve o texto pronto para o
--    WhatsApp, e a Edge Function resumo-diario entrega por HTTP para o n8n.
--    em_reais(numeric) existe porque o banco está em locale inglês e to_char
--    devolveria $4,169.4 em vez de R$ 4.169,40.

-- 7. disparar_funcao(p_funcao, p_query) chama uma Edge Function lendo a chave
--    de cron por dentro, para a chave não aparecer em consulta nenhuma.

-- Rotinas agora ativas:
--   rd-sync            */5
--   pigeon-sync        */10
--   pigeon-mensagens   */2   (baixar para */30 quando a fila zerar)
--   classificar-leads  */15
--   cruzar-vendas      */20
