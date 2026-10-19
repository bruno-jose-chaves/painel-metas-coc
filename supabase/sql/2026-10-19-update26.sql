-- Update 26 — o vazamento de conversa sem card entra na mensagem das 20h.
--
-- O Update 25 descobriu que 7% de quem conversa no WhatsApp não tem negociação
-- nenhuma no CRM. Ficar só na tela não resolve: ninguém abre tela para procurar
-- problema que não sabe que existe. Então entra no resumo diário, que é o único
-- lugar que a diretoria lê todo dia sem precisar querer.
--
-- O dia de hoje fica de fora da conta de propósito. Card aberto no fim do dia é
-- normal, e contar isso como vazamento daria alarme falso toda tarde.

-- conversas_sem_card(dias) — quantas pessoas conversaram e não têm card, e
-- quantas dessas estão sem falar há mais de uma semana.
--
-- Deliberadamente enxuta: conta e só. A versão da tela lê o jsonb bruto de cada
-- evento para montar nome e atendente, e isso custava 6,7 s no primeiro disparo.
-- Seis vírgula sete segundos é exatamente o que estourou o tempo limite do banco
-- e derrubou a mensagem em 16/10. Função de resumo não pode ler jsonb que ela
-- não usa.

-- painel_whats_crm(de, ate) — mesma leitura, ordem invertida. Antes montava
-- nome e atendente dos 18 mil eventos para depois filtrar o período. Agora acha
-- os contatos do período primeiro e lê o corpo bruto só desses: 6,7 s -> 120 ms.

create index if not exists conversas_eventos_contato_fone
  on conversas_eventos (contato_id) where telefone_norm is not null;
create index if not exists rd_contatos_fone_idx on rd_contatos (telefone_norm);
create index if not exists rd_negociacoes_contato_idx on rd_negociacoes (contato_id);

-- resumo_do_dia: linha nova no bloco "Atenção no dado", com concordância certa
-- no singular e no plural. A primeira versão escrevia "61 pessoas conversou".
