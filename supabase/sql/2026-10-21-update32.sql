-- Update 32 — o insight custava 15,8 segundos por abertura da tela Hoje.
--
-- Depois do Update 31 o painel ficou rápido para navegar, mas ainda demorava
-- para mostrar alguns números. Medindo tudo de novo, já como usuário logado e
-- com as regras de acesso valendo, um culpado apareceu sozinho:
--
--   painel_insights        15.776 ms
--   painel_metas_leads      2.372 ms
--   painel_recompra         1.667 ms
--   painel_escapando        1.333 ms
--   o resto                 abaixo de 900 ms
--
-- O cálculo dos insights cria uma tabela temporária a cada chamada. Isso
-- escreve no catálogo do banco toda vez e impede o plano de ser reaproveitado.
-- São doze mil linhas de lógica, então em vez de reescrever, o cálculo passa a
-- rodar sozinho de dez em dez minutos e a tela lê o resultado guardado.
-- Insight não é número de segundo a segundo: dez minutos de atraso não muda
-- decisão nenhuma. Resultado: 15.776 ms -> 11 ms, com as 25 linhas idênticas
-- campo por campo.
--
-- Guardado como uma linha de JSON em insights_cache, e não como view
-- materializada, porque o refresh de view roda em modo restrito e proíbe
-- tabela temporária, que é exatamente o que o cálculo usa.
--
-- painel_insights        -> renomeada para painel_insights_calcular (interna)
-- painel_insights        -> nova, lê insights_cache e aplica a permissão
-- atualizar_insights()   -> roda o cálculo e grava, pelo cron 'insights' (10 min)
--
-- A trava de permissão saiu do cálculo e ficou só na função que a tela chama.
-- Com ela no cálculo, o agendador roda como dono do banco e se barrava sozinho,
-- deixando a lista vazia.

create table if not exists insights_cache (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '[]'::jsonb,
  gerado_em timestamptz not null default now()
);

-- PENDENTE DE LIMPEZA: sobraram no banco objetos de tentativas que não deram
-- certo. A ferramenta de administração recusa DROP por proteção contra comando
-- destrutivo. Rodar à mão no SQL Editor do Supabase:
--   drop materialized view if exists insights_mv;
--   drop table if exists insights_prontos;
--   drop function if exists public.atualizar_insights_mv_antigo();
