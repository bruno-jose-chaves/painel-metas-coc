-- Update 52 · 03/11/2026
-- A aba de performance passa a responder "por que", nao so "quanto".

-- 1. PASSO DO PERIODO
-- Em 7 dias, agrupar por semana deixava um ou dois pontos na tela, e dois
-- pontos nao formam leitura nenhuma. Agora o passo acompanha o periodo: ate
-- tres semanas a tela fala em dia, acima disso em semana.
-- (corpo completo da funcao no banco; muda so o case do date_trunc e o
--  parametro p_passo)

-- 2. QUANTO O CLIENTE ESPERA, POR COMERCIAL
-- So conversa que o cliente comecou: quando somos nos que abrimos, a primeira
-- resposta e a nossa propria mensagem e a conta mediria o disparo, nao o
-- atendimento. Mesma regra da tela 340, de proposito.
-- Mediana e p90 em vez de media: uma conversa respondida tres dias depois puxa
-- a media do mes e faz parecer que todo mundo espera horas.
create or replace function painel_performance_resposta(p_de date default null, p_ate date default null)
returns table (vendedor text, procuraram bigint, mediana_min numeric, p90_min numeric,
               ate_15min bigint, ate_1h bigint, mais_de_1h bigint, sem_resposta bigint)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, current_date - 90) de, coalesce(p_ate, current_date) ate)
  select vd.nome, count(*),
         percentile_cont(0.5) within group (order by c.espera_min) filter (where c.espera_min is not null),
         percentile_cont(0.9) within group (order by c.espera_min) filter (where c.espera_min is not null),
         count(*) filter (where c.espera_min <= 15),
         count(*) filter (where c.espera_min > 15 and c.espera_min <= 60),
         count(*) filter (where c.espera_min > 60),
         count(*) filter (where c.espera_min is null)
  from conversas_mv c
  join vendedores vd on c.atendente = any (vd.nomes_planilha)
  cross join lim
  where is_autorizado() and c.quem_comecou = 'Cliente procurou'
    and c.inicio_sp::date between lim.de and lim.ate
  group by vd.nome having count(*) > 0 order by 3 nulls last;
$f$;
revoke all on function painel_performance_resposta(date, date) from public, anon;
grant execute on function painel_performance_resposta(date, date) to authenticated;

-- 3. O QUE CADA UM VENDE
-- Ticket medio sozinho engana: R$ 602 de um e R$ 692 do outro so diz algo
-- sabendo o mix. Intensivo e extensivo tem ticket dez vezes diferente.
create or replace function painel_performance_mix(p_de date default null, p_ate date default null)
returns table (vendedor text, produto_id text, produto text, vendas bigint,
               faturamento numeric, ticket numeric, fatia numeric)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, current_date - 90) de, coalesce(p_ate, current_date) ate),
  base as (
    select vd.nome vendedor, v.produto_id, count(*) vendas,
           sum(v.valor_venda) faturamento, avg(v.valor_venda) ticket
    from vendas v
    join vendedores vd on v.vendedor = any (vd.nomes_planilha)
    cross join lim
    where v.data between lim.de and lim.ate and coalesce(v.valor_venda, 0) > 0
      and coalesce(lower(v.status), '') not like 'cancel%'
    group by 1, 2
  )
  select b.vendedor, b.produto_id, coalesce(p.nome, b.produto_id, 'Sem produto'),
         b.vendas, b.faturamento, round(b.ticket),
         round(b.vendas::numeric / sum(b.vendas) over (partition by b.vendedor), 4)
  from base b left join produtos p on p.id = b.produto_id
  where is_autorizado()
  order by b.vendedor, b.vendas desc;
$f$;
revoke all on function painel_performance_mix(date, date) from public, anon;
grant execute on function painel_performance_mix(date, date) to authenticated;

-- 4. CARTEIRA POR TEMPO PARADO
-- Carteira grande nao e trabalho: pode ser lead estacionado. Quebrar por tempo
-- sem mexida e o que separa um do outro.
create or replace function painel_performance_carteira()
returns table (vendedor text, abertas bigint, ate_7 bigint, d8_15 bigint, d16_30 bigint,
               d31_60 bigint, mais_60 bigint, dias_mediana numeric)
language sql stable security definer set search_path to 'public' as $f$
  select vd.nome, count(*),
         count(*) filter (where (current_date - coalesce(n.atualizado_em::date, n.criado_em::date)) <= 7),
         count(*) filter (where (current_date - coalesce(n.atualizado_em::date, n.criado_em::date)) between 8 and 15),
         count(*) filter (where (current_date - coalesce(n.atualizado_em::date, n.criado_em::date)) between 16 and 30),
         count(*) filter (where (current_date - coalesce(n.atualizado_em::date, n.criado_em::date)) between 31 and 60),
         count(*) filter (where (current_date - coalesce(n.atualizado_em::date, n.criado_em::date)) > 60),
         percentile_cont(0.5) within group (order by (current_date - coalesce(n.atualizado_em::date, n.criado_em::date)))
  from v_negociacoes n
  join vendedores vd on n.responsavel = any (vd.nomes_planilha) or vd.nome = n.responsavel
  where is_autorizado() and n.status = 'aberta' and n.trilha = 'comercial'
  group by vd.nome order by count(*) desc;
$f$;
revoke all on function painel_performance_carteira() from public, anon;
grant execute on function painel_performance_carteira() to authenticated;

-- 5. POR QUE CADA UM PERDE
-- Os mesmos dois grupos da tela 314. Quem perde por preco e quem perde por
-- publico errado precisam de conversas diferentes, e isso so existia somado.
create or replace function painel_performance_perdas(p_de date default null, p_ate date default null)
returns table (vendedor text, motivo text, grupo text, perdidas bigint, fatia_no_grupo numeric)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, current_date - 90) de, coalesce(p_ate, current_date) ate),
  base as (
    select vd.nome vendedor,
           coalesce(nullif(n.motivo_perda, ''), 'Sem motivo informado') motivo,
           case when n.motivo_perda in ('Nunca respondeu', 'Parou de responder')
                then 'sumico' else 'comercial' end grupo
    from v_negociacoes n
    join vendedores vd on n.responsavel = any (vd.nomes_planilha) or vd.nome = n.responsavel
    cross join lim
    where n.status = 'perdida' and n.trilha = 'comercial'
      and n.fechado_em::date between lim.de and lim.ate
      and not perda_de_higiene(n.motivo_perda)
  )
  select vendedor, motivo, grupo, count(*),
         round(count(*)::numeric / sum(count(*)) over (partition by vendedor, grupo), 4)
  from base where is_autorizado()
  group by vendedor, motivo, grupo
  order by vendedor, (grupo = 'sumico'), count(*) desc;
$f$;
revoke all on function painel_performance_perdas(date, date) from public, anon;
grant execute on function painel_performance_perdas(date, date) to authenticated;
