-- Update 24 — Funil do WhatsApp pelas etiquetas do Pigeon
-- Aplicado direto no banco em 16/10/2026. Este arquivo é o registro.

-- O time já marcava tudo. Cada contato no Pigeon carrega três etiquetas ao
-- mesmo tempo: em que etapa está, de que curso é o interesse e de quem é o
-- lead. Isso chegava no painel desde 05/10 e NADA lia.

-- 0. A causa de nada ler: o telefone não era extraído
--    O evento CONTACT_TAG_UPDATE traz o telefone em "phonenumber", com o país
--    separado por barra vertical: "+55|4799293372". A busca genérica procurava
--    por "phone", "number" e afins, e não por "phonenumber", então 774 eventos
--    de etiqueta entraram sem telefone e eram invisíveis.
--    Corrigido na função conversas-ingest e preenchido para trás.

-- 1. norm_etiqueta(texto)
--    A etiqueta do vendedor vem com o id colado ("MÁRCIA - 67F3BBD4..."). O id
--    muda de ferramenta para ferramenta e não interessa, então sai.

-- 2. etiquetas_whats (etiqueta_norm, etiqueta, tipo, valor, ordem)
--    O significado de cada etiqueta. Quatro tipos: etapa, curso, vendedor e
--    ignorar. Etiqueta sem significado apontado aparece na tela em vez de
--    sumir, do mesmo jeito que página e curso sem destino.
--    Carga inicial com as 18 etiquetas em uso.

-- 3. painel_funil_whats(de, ate)
--    O funil. Etiqueta é estado, não evento, então vale a ÚLTIMA marcação de
--    cada telefone no período.
--    "Virou matrícula" não sai da etiqueta: sai da planilha comercial, cruzando
--    por telefone, que é a fonte firme da venda.
--
--    Primeira leitura, 30 dias:
--      Aquecido pelo agente      2    0 matrículas
--      Primeiro contato        190    9
--      Qualificação            114   11
--      Negociação               42    1
--      Venda realizada          16   15
--      Sem etapa marcada       183   18
--
--    Dois fatos que saltam e valem conversa com o time:
--      a) Negociação tem 42 pessoas e 1 matrícula.
--      b) Dos 183 sem etapa marcada, 180 são do João. A Márcia marca etapa em
--         quase tudo. Não é erro do painel, é diferença de rotina entre os dois.

-- 4. painel_etiquetas_whats(desde)
--    Toda etiqueta que apareceu, com o significado apontado ou a falta dele.
