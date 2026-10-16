-- Update 21 — Cursos e produtos aberto em 116ms, e o resumo com vigia
-- Aplicado direto no banco em 16/10/2026. Este arquivo é o registro.

-- 1. painel_cursos() reescrita
--    A primeira versão montava a lista de anos com uma subconsulta por grupo,
--    e cada uma varria a tabela inteira de vendas: 9,1 segundos. Na prática a
--    tela não abria.
--    Agora é uma passada só, agrupando pelo nome normalizado: 116ms.
--    Agrupar por norm também junta "Coc Aprova Med" e "COC APROVA MED" numa
--    linha só, com as grafias ao lado, que é a leitura certa.

-- 2. marcar_sync(chave)
--    Carimbo de "rodou agora", para quem não tem tabela própria de estado.

-- 3. painel_saude_fontes(): o resumo diário entrou na lista
--    O resumo ficou seis dias sem sair e ninguém percebeu, porque nada vigiava
--    a mensagem. A rota do resumo passou a carimbar sync_estado a cada entrega,
--    e a fonte "Resumo diário no WhatsApp" tem limite de 26 horas.
--    Se a mensagem não sair, o painel mostra a tarja no dia seguinte.

-- 4. resumo_do_dia(dia): duas correções no aviso de fonte parada
--    a) O emoji saiu. O provedor de WhatsApp devolveu 500 com ele no texto, e
--       mensagem que não sai é pior que mensagem sem ícone.
--    b) A mensagem não avisa mais sobre si mesma. Seria absurdo o resumo
--       chegar dizendo que o resumo não chegou, e pior: o aviso era o que
--       estava impedindo a entrega que renova a marca.

-- Causa raiz das falhas de 10/10 a 15/10, agora fechada:
--    o n8n mantém uma cópia ATIVA do fluxo separada da salva. O fluxo foi
--    corrigido e salvo, mas a cópia ativa continuou mandando a chave na URL,
--    e por isso a execução agendada dava 401 enquanto a manual passava.
--    Desativar e reativar o fluxo registrou a versão nova.
