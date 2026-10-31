-- Update 48 · 31/10/2026
-- Motivo de perda separado em dois grupos, e a Visao Geral deixou de ser a
-- tela mais lenta do painel.
--
-- 1. MOTIVOS DE PERDA
-- "Nunca respondeu" (2.329) e "Parou de responder" (1.770) sao 98% das perdas
-- e nao dizem nada sobre a oferta: sao ritmo de follow-up. Misturados com
-- preco, concorrente e curso, afogavam os ~74 motivos comerciais, que eram
-- justamente os que ensinam alguma coisa. Agora sao dois grupos, cada um com
-- a sua propria fatia, mais duas colunas que a investigacao mostrou que
-- importam: 21-26% das perdas por sumico vieram do funil de pre-vendas (o
-- contato nasceu de disparo, nao de alguem que procurou a gente) e 38-40% dos
-- "nunca respondeu" tem resposta do cliente no WhatsApp.
alter function painel_motivos_perda(date, date, text) rename to painel_motivos_perda_v1;

create or replace function painel_motivos_perda(p_de date, p_ate date, p_produto text default null)
returns table (motivo text, grupo text, perdidas bigint, fatia numeric, fatia_no_grupo numeric,
               veio_da_pre_venda bigint, tinha_resposta bigint)
language sql stable security definer set search_path to 'public' as $f$
  with base as (
    select coalesce(nullif(n.motivo_perda, ''), 'Sem motivo informado') as motivo,
           case when n.motivo_perda in ('Nunca respondeu', 'Parou de responder')
                then 'sumico' else 'comercial' end as grupo,
           exists (select 1 from rd_negociacoes s
                    where s.contato_id = n.contato_id and s.funil_nome = 'SDR') as da_pre_venda,
           exists (select 1 from rd_contatos ct
                    join conversas_mv c on c.telefone = ct.telefone_norm and c.respondeu
                    where ct.id = n.contato_id) as teve_resposta
    from v_negociacoes n
    left join lead_curso lc on lc.negociacao_id = n.id
    where is_autorizado()
      and n.status = 'perdida' and n.trilha = 'comercial'
      and n.fechado_em::date between p_de and p_ate
      and not perda_de_higiene(n.motivo_perda)
      and (p_produto is null or lc.produto_id = p_produto)
  )
  select motivo, grupo, count(*),
         round(count(*)::numeric / sum(count(*)) over (), 4),
         round(count(*)::numeric / sum(count(*)) over (partition by grupo), 4),
         count(*) filter (where da_pre_venda),
         count(*) filter (where teve_resposta)
  from base
  group by motivo, grupo
  order by (grupo = 'sumico'), count(*) desc;
$f$;
revoke all on function painel_motivos_perda(date, date, text) from public, anon;
grant execute on function painel_motivos_perda(date, date, text) to authenticated;

-- 2. VISAO GERAL EM DUAS CONSULTAS
-- painel_metas_leads custava 1,8 s e era chamada uma vez por campanha aberta:
-- 1.429 chamadas no historico do pg_stat_statements, a consulta mais cara do
-- banco. painel_projecao tinha o mesmo padrao. Agora cada uma tem uma versao
-- que devolve todas as campanhas de uma vez, e a tela faz duas chamadas no
-- lugar de duas por campanha.
create or replace function painel_projecao_todas(p_campanhas text[] default null)
returns table (campanha_id text, ref_ano integer, ref_alunos bigint, ref_ate_hoje bigint,
               fracao numeric, dia_da_campanha integer, projecao_alunos numeric,
               projecao_faturamento numeric, meta_alunos integer, falta_alunos numeric,
               dias_restantes integer, ritmo_necessario numeric, ritmo_atual numeric)
language sql stable security definer set search_path to 'public' as $f$
  select c.id, p.ref_ano, p.ref_alunos, p.ref_ate_hoje, p.fracao, p.dia_da_campanha,
         p.projecao_alunos, p.projecao_faturamento, p.meta_alunos, p.falta_alunos,
         p.dias_restantes, p.ritmo_necessario, p.ritmo_atual
  from resumo_campanhas c
  cross join lateral painel_projecao(c.id) p
  where is_autorizado()
    and (p_campanhas is null or c.id = any (p_campanhas));
$f$;
revoke all on function painel_projecao_todas(text[]) from public, anon;
grant execute on function painel_projecao_todas(text[]) to authenticated;

create or replace function painel_metas_leads_todas(p_campanhas text[] default null)
returns table (campanha_id text, indicador text, rotulo text, meta integer, realizado bigint,
               atingido numeric, esperado_hoje numeric, situacao text, identificadores text[],
               por_crm bigint, por_formulario bigint, tem_regra boolean, desde date)
language sql stable security definer set search_path to 'public' as $f$
  select c.id, m.indicador, m.rotulo, m.meta, m.realizado, m.atingido, m.esperado_hoje,
         m.situacao, m.identificadores, m.por_crm, m.por_formulario, m.tem_regra, m.desde
  from resumo_campanhas c
  cross join lateral painel_metas_leads(c.id) m
  where is_autorizado()
    and (p_campanhas is null or c.id = any (p_campanhas));
$f$;
revoke all on function painel_metas_leads_todas(text[]) from public, anon;
grant execute on function painel_metas_leads_todas(text[]) to authenticated;

-- 3. SEGURANCA E CARGA
-- classificar_leads reclassifica a base inteira: nao e funcao de tela, e
-- "create or replace" tinha devolvido o acesso publico a ela.
revoke all on function classificar_leads() from public, anon, authenticated;

-- atualizar_conversas_mv leva 14,3 s em media. A cada 5 minutos ela ocupava o
-- banco um quarto do tempo sem necessidade: as conversas nao mudam nesse ritmo.
select cron.alter_job((select jobid from cron.job where jobname = 'conversas-mv'), schedule => '*/20 * * * *');
