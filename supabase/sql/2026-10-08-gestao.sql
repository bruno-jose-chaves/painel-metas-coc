-- T7 — Aba Gestão. Aplicado direto no banco em 08/10/2026.
-- Guardado aqui como registro do que está em produção.

create or replace function painel_gestao(p_de date, p_ate date)
returns table (indicador text, rotulo text, valor bigint, detalhe text)
language sql stable as $$
  with neg as (
    select n.id, n.criado_em, c.telefone_norm
    from rd_negociacoes n
    left join rd_contatos c on c.id = n.contato_id
    where n.funil_nome is distinct from 'SDR'
      and n.criado_em::date between p_de and p_ate
  ),
  -- Para cada lead novo no CRM, houve conversa nos vinte dias antes dele?
  novos as (
    select n.id,
      exists (
        select 1 from pigeon_conversas pc
        join pigeon_contatos pct on pct.id = pc.contato_id
        where n.telefone_norm is not null
          and pct.telefone_norm = n.telefone_norm
          and pc.inicio < n.criado_em
          and pc.inicio >= n.criado_em - interval '20 days'
      ) as tinha_conversa
    from neg n
  ),
  -- Conversa que começou no período e cujo contato estava parado há mais de 15 dias.
  conversas as (
    select pc.id, pc.contato_id, pc.inicio, pc.ultima_interacao,
      (select max(a.ultima_interacao) from pigeon_conversas a
        where a.contato_id = pc.contato_id and a.inicio < pc.inicio) as toque_anterior
    from pigeon_conversas pc
    where pc.inicio::date between p_de and p_ate
  ),
  andamento as (
    select count(*) as n from pigeon_conversas pc
    where pc.inicio::date < p_de
      and pc.ultima_interacao::date between p_de and p_ate
  )
  select 'leads_novos', 'Leads novos',
    (select count(*) from novos where not tinha_conversa),
    'negociação criada sem conversa nos 20 dias anteriores'
  union all
  select 'leads_conhecidos', 'Leads que já falavam com a gente',
    (select count(*) from novos where tinha_conversa),
    'negociação criada com conversa recente no Pigeon'
  union all
  select 'requentados', 'Leads requentados',
    (select count(*) from conversas
      where toque_anterior is not null and inicio - toque_anterior > interval '15 days'),
    'voltaram a falar depois de mais de 15 dias parados'
  union all
  select 'conversas_novas', 'Conversas abertas no período',
    (select count(*) from conversas), 'atendimentos que começaram no período'
  union all
  select 'conversas_andamento', 'Conversas em andamento',
    (select n from andamento), 'começaram antes e tiveram movimento no período'
  union all
  select 'primeira_conversa', 'Primeira conversa na vida',
    (select count(*) from conversas where toque_anterior is null),
    'contato que nunca tinha falado com a gente antes';
$$;

create or replace function painel_gestao_dia(p_de date, p_ate date)
returns table (dia date, conversas_novas bigint, requentados bigint, leads_novos bigint)
language sql stable as $$
  with dias as (select d::date as dia from generate_series(p_de, p_ate, interval '1 day') d),
  conv as (
    select pc.inicio::date as dia,
      (select max(a.ultima_interacao) from pigeon_conversas a
        where a.contato_id = pc.contato_id and a.inicio < pc.inicio) as toque_anterior,
      pc.inicio
    from pigeon_conversas pc
    where pc.inicio::date between p_de and p_ate
  ),
  leads as (
    select n.criado_em::date as dia,
      exists (
        select 1 from pigeon_conversas pc
        join pigeon_contatos pct on pct.id = pc.contato_id
        where c.telefone_norm is not null and pct.telefone_norm = c.telefone_norm
          and pc.inicio < n.criado_em and pc.inicio >= n.criado_em - interval '20 days'
      ) as tinha
    from rd_negociacoes n
    left join rd_contatos c on c.id = n.contato_id
    where n.funil_nome is distinct from 'SDR' and n.criado_em::date between p_de and p_ate
  )
  select d.dia,
    (select count(*) from conv where conv.dia = d.dia),
    (select count(*) from conv where conv.dia = d.dia
       and toque_anterior is not null and inicio - toque_anterior > interval '15 days'),
    (select count(*) from leads where leads.dia = d.dia and not tinha)
  from dias d order by d.dia;
$$;

grant execute on function painel_gestao(date, date) to authenticated;
grant execute on function painel_gestao_dia(date, date) to authenticated;
