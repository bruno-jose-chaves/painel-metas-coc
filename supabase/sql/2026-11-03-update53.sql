-- Update 53 · 03/11/2026
-- O tempo de resposta estava errado nas duas pontas, e agora tem dois relogios.
--
-- Bruno estranhou o numero, com razao. Tres problemas:
--
-- 1. O Pigeon nao carimba firstResponseAt em toda conversa. Em outubro faltou
--    em 71 das 400 que o cliente comecou, e dessas 13 tinham mensagem nossa
--    registrada: foram atendidas, so nao ficou o carimbo. Elas entravam como
--    "sem resposta", o que acusava abandono que nao houve.
-- 2. O relogio corria de madrugada e no fim de semana. Mensagem que chega
--    sabado as 22h e respondida segunda as 8h05 aparecia como 34 horas de
--    espera, quando o time respondeu em 5 minutos de expediente.
-- 3. Nao dava para tirar fim de semana nem fora do horario, filtros que a tela
--    340 ja tinha.
--
-- O efeito dos dois primeiros, em 90 dias:
--   Joao   mediana 26 min no relogio corrido, 2 min no comercial
--   Marcia mediana 32 min no relogio corrido, 5 min no comercial
--   Marcia "sem resposta" caiu de 93 para 80 com o conserto do carimbo
--   154 e 136 conversas chegaram fora do horario, cerca de um terco do total
--
-- Os dois relogios ficam na tela porque respondem perguntas diferentes: o
-- comercial diz se o time demora, o corrido diz se a pessoa esperou.

create or replace function minutos_uteis(p_de timestamptz, p_ate timestamptz)
returns numeric language sql immutable set search_path to 'public' as $f$
  with d as (
    select generate_series(
      date_trunc('day', p_de at time zone 'America/Sao_Paulo'),
      least(date_trunc('day', p_ate at time zone 'America/Sao_Paulo'),
            date_trunc('day', p_de at time zone 'America/Sao_Paulo') + interval '60 days'),
      interval '1 day') dia
  )
  select coalesce(sum(greatest(0, extract(epoch from
           least(p_ate at time zone 'America/Sao_Paulo', dia + time '18:00')
           - greatest(p_de at time zone 'America/Sao_Paulo', dia + time '08:00')) / 60)), 0)
  from d where extract(dow from d.dia) between 1 and 5;
$f$;

-- A versao anterior ficou como painel_performance_resposta_v1 (o tipo de
-- retorno mudou, entao nao dava para substituir no lugar).
create or replace function painel_performance_resposta(
  p_de date default null, p_ate date default null,
  p_relogio text default 'util', p_so_dia_util boolean default false,
  p_so_horario_comercial boolean default false)
returns table (vendedor text, procuraram bigint, mediana_min numeric, p90_min numeric,
               mediana_corrida numeric, ate_15min bigint, ate_1h bigint, mais_de_1h bigint,
               sem_resposta bigint, fora_do_horario bigint)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, current_date - 90) de, coalesce(p_ate, current_date) ate),
  base as (
    select vd.nome vendedor, c.inicio,
           coalesce(c.espera_min, (
             select (extract(epoch from min(e.ocorrido_em) - c.inicio) / 60)::numeric
             from conversas_eventos e
             where e.conversa_id = c.id and e.evento = 'MESSAGE_SENT' and e.ocorrido_em >= c.inicio
           )) espera
    from conversas_mv c
    join vendedores vd on c.atendente = any (vd.nomes_planilha)
    cross join lim
    where c.quem_comecou = 'Cliente procurou'
      and c.inicio_sp::date between lim.de and lim.ate
      and (not p_so_dia_util or c.dia_util)
      and (not p_so_horario_comercial or c.horario_comercial)
  ),
  conta as (
    select vendedor, inicio, espera,
           case when espera is null then null
                else minutos_uteis(inicio, inicio + (espera || ' minutes')::interval) end util
    from base
  ),
  final as (
    select vendedor, espera, util,
           case when p_relogio = 'corrido' then espera else util end valor
    from conta
  )
  select vendedor, count(*),
         round((percentile_cont(0.5) within group (order by valor) filter (where valor is not null))::numeric, 1),
         round((percentile_cont(0.9) within group (order by valor) filter (where valor is not null))::numeric, 1),
         round((percentile_cont(0.5) within group (order by espera) filter (where espera is not null))::numeric, 1),
         count(*) filter (where valor <= 15),
         count(*) filter (where valor > 15 and valor <= 60),
         count(*) filter (where valor > 60),
         count(*) filter (where espera is null),
         count(*) filter (where espera is not null and util is not null and espera - util > 30)
  from final
  where is_autorizado()
  group by vendedor having count(*) > 0 order by 3 nulls last;
$f$;
revoke all on function painel_performance_resposta(date, date, text, boolean, boolean) from public, anon;
grant execute on function painel_performance_resposta(date, date, text, boolean, boolean) to authenticated;
