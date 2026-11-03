-- Update 50 · 03/11/2026
-- Performance individual do comercial (aba 360), e duas datas erradas de 2021
-- e 2022 que vinham de uma importacao antiga.
--
-- A gestao individual nao existia no painel. O Ranking (312) diz quem vendeu
-- mais, mas nao diz quanta gente cada um atendeu para chegar la, em quantos
-- dias trabalhou, nem o que esta parado na mao dele agora. Sao tres fontes
-- diferentes e a tela diz de onde veio cada coluna: atendimento vem da conversa
-- do WhatsApp, carteira vem do CRM, venda vem da planilha.

-- 1. SEMANA A SEMANA
-- Duas conversoes de proposito. A da semana (venda da semana sobre pessoa da
-- semana) compara ritmo entre semanas e e a que o time entende na hora, mas
-- mistura gente abordada antes. A de coorte (das pessoas abordadas naquela
-- semana, quantas compraram ate hoje) e a conversao real da pessoa, e so fecha
-- depois de ~20 dias: por isso a semana recente aparece marcada como em jogo.
create or replace function painel_performance_semana(p_de date default null, p_ate date default null, p_vendedor text default null)
returns table (semana date, vendedor text, pessoas bigint, conversas bigint, dias_trabalhados bigint,
               responderam bigint, taxa_resposta numeric, vendas bigint, faturamento numeric,
               ticket_medio numeric, conv_semana numeric, coorte_compraram bigint,
               conv_coorte numeric, coorte_fechada boolean)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, current_date - 56) de, coalesce(p_ate, current_date) ate),
  -- O canal de Marketing (Instagram e afins) fica fora: nao tem telefone, entao
  -- nao da para amarrar na matricula, e entraria inflando conversa sem pessoa.
  conv as (
    select date_trunc('week', c.inicio_sp)::date semana, vd.nome vendedor,
           c.telefone, c.inicio_sp::date dia, c.respondeu
    from conversas_mv c
    join vendedores vd on c.atendente = any (vd.nomes_planilha)
    cross join lim
    where c.telefone is not null and c.inicio_sp::date between lim.de and lim.ate
  ),
  agrega as (
    select semana, vendedor, count(distinct telefone) pessoas, count(*) conversas,
           count(distinct dia) dias, count(*) filter (where respondeu) responderam
    from conv group by 1, 2
  ),
  vend as (
    select date_trunc('week', v.data)::date semana, vd.nome vendedor,
           count(*) vendas, sum(v.valor_venda) faturamento, avg(v.valor_venda) ticket
    from vendas v
    join vendedores vd on v.vendedor = any (vd.nomes_planilha)
    cross join lim
    where v.data between lim.de and lim.ate and coalesce(v.valor_venda, 0) > 0
    group by 1, 2
  ),
  -- A coorte conta a pessoa uma vez, na primeira semana em que aquele comercial
  -- falou com ela. Dois comerciais que falaram com a mesma pessoa aparecem os
  -- dois: e de proposito, porque os dois trabalharam aquela pessoa.
  primeira as (select vendedor, telefone, min(semana) semana from conv group by 1, 2),
  coorte as (
    select p.semana, p.vendedor, count(*) filter (
             where exists (select 1 from vendas v
                            where (v.telefone_norm = p.telefone or v.resp_telefone_norm = p.telefone)
                              and v.data >= p.semana)) compraram
    from primeira p group by 1, 2
  )
  select a.semana, a.vendedor, a.pessoas, a.conversas, a.dias, a.responderam,
         case when a.conversas > 0 then round(a.responderam::numeric / a.conversas, 4) end,
         coalesce(v.vendas, 0), coalesce(v.faturamento, 0), round(v.ticket),
         case when a.pessoas > 0 then round(coalesce(v.vendas, 0)::numeric / a.pessoas, 4) end,
         coalesce(co.compraram, 0),
         case when a.pessoas > 0 then round(coalesce(co.compraram, 0)::numeric / a.pessoas, 4) end,
         (a.semana + 20) < current_date
  from agrega a
  left join vend v on v.semana = a.semana and v.vendedor = a.vendedor
  left join coorte co on co.semana = a.semana and co.vendedor = a.vendedor
  where is_autorizado() and (p_vendedor is null or a.vendedor = p_vendedor)
  order by a.semana desc, a.pessoas desc;
$f$;
revoke all on function painel_performance_semana(date, date, text) from public, anon;
grant execute on function painel_performance_semana(date, date, text) to authenticated;

-- 2. A FOTO DE AGORA
-- cobertura_whats e quanta matricula dos ultimos 60 dias da para amarrar numa
-- conversa por telefone. E o teto de confianca da coluna de coorte: o que nao
-- casa nao aparece la. Hoje da 71%.
create or replace function painel_performance_hoje()
returns table (vendedor text, carteira bigint, parada_mais_antiga integer, atendidos_hoje bigint,
               vendas_hoje bigint, vendas_mes bigint, faturamento_mes numeric, ticket_mes numeric,
               cobertura_whats numeric)
language sql stable security definer set search_path to 'public' as $f$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d,
                       date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date mes),
  carteira as (
    select vd.nome vendedor, count(*) abertas,
           max((select d from hoje) - coalesce(n.atualizado_em::date, n.criado_em::date)) parada
    from v_negociacoes n
    join vendedores vd on n.responsavel = any (vd.nomes_planilha) or vd.nome = n.responsavel
    where n.status = 'aberta' and n.trilha = 'comercial'
    group by 1
  ),
  atendeu as (
    select vd.nome vendedor, count(distinct c.telefone) pessoas
    from conversas_mv c
    join vendedores vd on c.atendente = any (vd.nomes_planilha)
    where c.inicio_sp::date = (select d from hoje) and c.telefone is not null
    group by 1
  ),
  vendeu as (
    select vd.nome vendedor,
           count(*) filter (where v.data = (select d from hoje)) hoje,
           count(*) mes, sum(v.valor_venda) fat, avg(v.valor_venda) ticket
    from vendas v
    join vendedores vd on v.vendedor = any (vd.nomes_planilha)
    where coalesce(v.valor_venda, 0) > 0 and v.data >= (select mes from hoje)
    group by 1
  ),
  cob as (
    select round(count(*) filter (where exists (
             select 1 from conversas_mv c
              where c.telefone = v.telefone_norm or c.telefone = v.resp_telefone_norm))::numeric
           / nullif(count(*), 0), 4) taxa
    from vendas v
    where v.data >= (select d from hoje) - 60 and coalesce(v.valor_venda, 0) > 0
  )
  select vd.nome, coalesce(ca.abertas, 0), ca.parada, coalesce(a.pessoas, 0),
         coalesce(ve.hoje, 0), coalesce(ve.mes, 0), coalesce(ve.fat, 0), round(ve.ticket),
         (select taxa from cob)
  from vendedores vd
  left join carteira ca on ca.vendedor = vd.nome
  left join atendeu a on a.vendedor = vd.nome
  left join vendeu ve on ve.vendedor = vd.nome
  where is_autorizado() and vd.ativo
    and (ca.abertas > 0 or a.pessoas > 0 or ve.mes > 0)
  order by coalesce(ve.mes, 0) desc, coalesce(ca.abertas, 0) desc;
$f$;
revoke all on function painel_performance_hoje() from public, anon;
grant execute on function painel_performance_hoje() to authenticated;

-- 3. DUAS DATAS ERRADAS
-- Vendas 2021 linha 804 vinha com ano "202" e Vendas 2022 linha 554 com 2017,
-- criando anos fantasma em qualquer agrupamento por ano. A planilha ja esta
-- certa nas duas: o erro veio da importacao unica de 30/09, e as abas antigas
-- nao sao reimportadas, entao a correcao da planilha nunca chegou ao banco.
update vendas set data = '2021-10-25' where chave = 'Vendas 2021|804';
update vendas set data = '2022-08-22' where chave = 'Vendas 2022|554';
