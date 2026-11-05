-- Update 58 · 05/11/2026
-- Cursos extras de volta na contagem, comissao no painel, apontar etiqueta e
-- turmas de 2027.

-- 1. CURSOS EXTRAS VOLTAM A CONTAR ALUNO
-- O Bruno tem razao: foram alunos de verdade, de cursos extras que a COC
-- vendeu, e o numero historico de 2025 (1.075) ja os contava. O que eles nao
-- sao e matricula de curso preparatorio. Entao voltam a contar e ganham
-- categoria propria, para o painel somar quando a pergunta for "quantas
-- pessoas compraram da COC" e separar quando for "quantas matriculas de curso".
alter table produtos add column if not exists categoria text not null default 'regular';
update produtos set categoria = 'material' where id = 'material';
update produtos set categoria = 'extra' where id = 'evento';
update produtos set nome = 'Cursos extras', conta_aluno = true, ordem = 7 where id = 'evento';

-- Turmas que faltavam, para nada ficar orfao: cursos extras de 2021 a 2027 e
-- MED FURB 2027.
insert into turmas (id, produto_id, ano, semestre, nome, venda_de, venda_ate, ativa)
select 'evento-' || a, 'evento', a, null, 'Cursos extras ' || a,
       make_date(a, 1, 1), make_date(a, 12, 31), true
from generate_series(2021, 2027) a
on conflict (id) do nothing;
insert into turmas (id, produto_id, ano, semestre, nome, venda_de, venda_ate, ativa) values
  ('med-furb-2027', 'med-furb', 2027, null, 'MED FURB 2027', '2026-11-01', '2027-06-30', true)
on conflict (id) do nothing;
-- Conferido: 2021 voltou a 782 e 2025 a 1.069, zero orfas em todos os anos.

-- 2. COMISSAO
-- Regra v3: 3% em Semi e Extensivo, 5% nos demais. Os percentuais ficam em
-- tabela, produto a produto, e mudam sem mexer em codigo.
--
-- Duas ressalvas que a tela repete, porque numero de dinheiro sem ressalva
-- vira cobranca errada:
--   - A regra paga sobre a PARCELA PAGA, nao sobre o valor da matricula. O
--     painel recebe a venda fechada, nao o pagamento de cada parcela, entao o
--     que aparece e o teto: o que a pessoa recebe se o aluno pagar tudo.
--   - O bonus por meta nao entra: depende do quadro de colaboradores ativos no
--     periodo, com peso de CLT e MEI, que e informacao de outro lugar.
--
-- Aparece so na tela individual do comercial e na analise do Bruno, nunca no
-- ranking do time: quanto cada um ganha nao e informacao de grupo.
create table if not exists comissao_regras (
  produto_id text primary key references produtos(id),
  percentual numeric not null,
  desde date not null default '2026-01-01',
  atualizado_em timestamptz not null default now()
);
alter table comissao_regras enable row level security;
insert into comissao_regras (produto_id, percentual) values
  ('semi-extensivo', 0.03), ('extensivo', 0.03),
  ('metodo-acafe', 0.05), ('missao-ufsc', 0.05), ('prep-enem', 0.05),
  ('med-furb', 0.05), ('evento', 0.05), ('outros', 0.05)
on conflict (produto_id) do update set percentual = excluded.percentual;

create or replace function painel_comissao(p_de date default null, p_ate date default null,
                                           p_vendedor text default null)
returns table (vendedor text, mes date, produto text, matriculas bigint, faturamento numeric,
               percentual numeric, comissao numeric)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, date_trunc('year', current_date)::date) de,
                      coalesce(p_ate, current_date) ate)
  select vd.nome, date_trunc('month', v.data)::date, p.nome,
         count(*), sum(v.valor_venda), max(c.percentual),
         round(sum(v.valor_venda * c.percentual), 2)
  from vendas v
  join vendedores vd on v.vendedor = any (vd.nomes_planilha)
  join produtos p on p.id = v.produto_id
  join comissao_regras c on c.produto_id = v.produto_id
  cross join lim
  where is_autorizado() and vd.papel = 'comercial'
    and v.data between lim.de and lim.ate and v.data >= c.desde
    and coalesce(v.valor_venda, 0) > 0
    and coalesce(lower(v.status), '') not like 'cancel%'
    and (p_vendedor is null or vd.nome = p_vendedor)
  group by vd.nome, date_trunc('month', v.data)::date, p.nome
  order by 2 desc, 7 desc;
$f$;
revoke all on function painel_comissao(date, date, text) from public, anon;
grant execute on function painel_comissao(date, date, text) to authenticated;

-- 3. APONTAR ETIQUETA DIRETO DA TELA
-- Ate aqui a tela so dizia que a etiqueta nao tinha uso, e consertar dependia
-- de abrir o banco.
create or replace function apontar_etiqueta_whats(p_etiqueta text, p_tipo text, p_valor text)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not is_admin() then raise exception 'Somente administradores apontam etiqueta.'; end if;
  if p_tipo not in ('curso', 'vendedor', 'etapa') then
    raise exception 'Tipo tem que ser curso, vendedor ou etapa.';
  end if;
  insert into etiquetas_whats (etiqueta_norm, etiqueta, tipo, valor)
  values (norm_etiqueta(p_etiqueta), p_etiqueta, p_tipo, p_valor)
  on conflict (etiqueta_norm) do update set tipo = excluded.tipo, valor = excluded.valor,
                                            etiqueta = excluded.etiqueta;
end $f$;
revoke all on function apontar_etiqueta_whats(text, text, text) from public, anon;
grant execute on function apontar_etiqueta_whats(text, text, text) to authenticated;

create or replace function painel_etiqueta_destinos()
returns table (tipo text, valor text, rotulo text)
language sql stable security definer set search_path to 'public' as $f$
  select 'curso'::text, t.id, t.nome from turmas t
   where is_autorizado() and t.ativa and t.ano >= extract(year from current_date) - 1
  union all
  select 'vendedor', vd.nome, vd.nome from vendedores vd where is_autorizado() and vd.ativo
  union all
  select distinct 'etapa', n.etapa_nome, n.etapa_nome from rd_negociacoes n
   where is_autorizado() and n.etapa_nome is not null
  order by 1, 3;
$f$;
revoke all on function painel_etiqueta_destinos() from public, anon;
grant execute on function painel_etiqueta_destinos() to authenticated;
