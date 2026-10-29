-- Update 44 · 29/10/2026
-- 1. O NOME DO CURSO NA PLANILHA PASSA NA FRENTE.
-- Decisão do Bruno: o curso escrito na planilha de vendas é regra principal,
-- porque é onde o acordo interno aparece. Só não vale quando está em branco.
-- Antes ele era o último degrau da cascata, usado só quando nada mais
-- respondia. Agora é o primeiro, e os outros sete continuam na mesma ordem
-- abaixo dele. Efeito: 1.323 leads passam a ser classificados pela compra, e
-- 263 deles mudaram de curso em relação ao palpite anterior.
-- (corpo de classificar_leads aplicado no banco: o lateral pv foi para o topo,
--  e cada degrau seguinte ganhou "pv.id is null" na condição)

-- 2. HISTÓRICO INTEIRO DO PIGEON.
-- A carga antiga começava em 01/08/2026 para conversas e 01/01/2026 para
-- contatos. O resto do histórico ficava de fora, e com ele o telefone de quem
-- conversou antes. A função ganhou recurso espelho, "conversas_historico" e
-- "contatos_historico": mesmo endereço, estado próprio, para a carga do
-- passado andar sem parar o sincronismo do dia.
insert into pigeon_sync_estado (recurso, pagina, desde, gravados)
values ('contatos_historico', 1, '2020-01-01T00:00:00Z', 0),
       ('conversas_historico', 1, '2020-01-01T00:00:00Z', 0)
on conflict (recurso) do update set pagina = 1, desde = excluded.desde, concluido_em = null, erro = null;

-- Os dois agendamentos abaixo rodaram até a carga terminar e foram retirados
-- em seguida, porque o sincronismo normal já cobre o que vem depois:
--   select cron.schedule('pigeon-historico', '*/5 * * * *', ...conversas_historico...);
--   select cron.schedule('pigeon-historico-contatos', '2-59/5 * * * *', ...contatos_historico...);
--   select cron.unschedule('pigeon-historico');
--   select cron.unschedule('pigeon-historico-contatos');

-- A leitura da primeira mensagem de cada conversa passou a rodar de 5 em 5
-- minutos até drenar a fila do histórico.
select cron.schedule('pigeon-mensagens', '*/5 * * * *', 'select disparar_funcao(''pigeon-mensagens'')');
