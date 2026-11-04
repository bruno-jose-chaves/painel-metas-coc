-- Update 54 · 03/11/2026
-- Auditoria da aba de performance. Cinco problemas, todos de numero errado ou
-- de numero que nao combina com o resto do painel.

-- 1. MATRICULA CONTADA POR REGRA DIFERENTE DO RESTO DO PAINEL
-- A aba contava 402 matriculas em 90 dias onde o Ranking (312), o resumo
-- diario e a propria gaveta de detalhe contavam 391. A diferenca: 6 vendas de
-- material avulso, que nao e matricula, e 5 matriculas canceladas. Clicar no
-- numero abria uma lista menor que o numero, que e o pior tipo de erro.
-- Agora todas as funcoes da aba usam a regra do Ranking: fora cancelada, fora
-- o que nao e matricula, e so vendedor com papel comercial.

-- 2. PESSOAS SOMADAS POR SEMANA INFLAVAM O TOTAL DO PERIODO
-- O bloco 361 somava as linhas semanais, entao quem foi atendido em tres
-- semanas contava tres vezes. Em 90 dias isso dava 7,2% a mais para a Marcia e
-- 2,5% para o Joao, e piorava quanto maior o periodo. O total do periodo agora
-- e contado no periodo.
create or replace function painel_performance_periodo(p_de date default null, p_ate date default null,
                                                     p_vendedor text default null)
returns table (vendedor text, pessoas bigint, conversas bigint, dias_com_atendimento bigint,
               responderam bigint, taxa_resposta numeric, vendas bigint, vendas_atendidas bigint,
               faturamento numeric, ticket_medio numeric, conversao numeric, dias_no_periodo integer)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, current_date - 90) de, coalesce(p_ate, current_date) ate),
  conv as (
    select vd.nome vendedor, c.telefone, c.inicio_sp::date dia, c.respondeu
    from conversas_mv c
    join vendedores vd on c.atendente = any (vd.nomes_planilha)
    cross join lim
    where vd.papel = 'comercial' and c.telefone is not null
      and c.inicio_sp::date between lim.de and lim.ate
  ),
  agrega as (
    select vendedor, count(distinct telefone) pessoas, count(*) conversas,
           count(distinct dia) dias, count(*) filter (where respondeu) responderam
    from conv group by 1
  ),
  matriculas as (
    select vd.nome vendedor, v.valor_venda,
           exists (select 1 from conversas_mv c
                    join vendedores vd2 on c.atendente = any (vd2.nomes_planilha)
                   where vd2.nome = vd.nome
                     and (c.telefone = v.telefone_norm or c.telefone = v.resp_telefone_norm)) atendida
    from vendas v
    join vendedores vd on v.vendedor = any (vd.nomes_planilha)
    cross join lim
    where v.data between lim.de and lim.ate and coalesce(v.valor_venda, 0) > 0
      and coalesce(lower(v.status), '') not like 'cancel%'
      and e_matricula(v.produto_id) and vd.papel = 'comercial'
  ),
  vend as (
    select vendedor, count(*) vendas, count(*) filter (where atendida) atendidas,
           sum(valor_venda) faturamento, avg(valor_venda) ticket
    from matriculas group by 1
  )
  select a.vendedor, a.pessoas, a.conversas, a.dias, a.responderam,
         case when a.conversas > 0 then round(a.responderam::numeric / a.conversas, 4) end,
         coalesce(v.vendas, 0), coalesce(v.atendidas, 0),
         coalesce(v.faturamento, 0), round(v.ticket),
         case when a.pessoas > 0 then round(coalesce(v.atendidas, 0)::numeric / a.pessoas, 4) end,
         ((select ate from lim) - (select de from lim) + 1)::integer
  from agrega a
  left join vend v on v.vendedor = a.vendedor
  where is_autorizado() and (p_vendedor is null or a.vendedor = p_vendedor)
  order by coalesce(v.vendas, 0) desc, a.pessoas desc;
$f$;
revoke all on function painel_performance_periodo(date, date, text) from public, anon;
grant execute on function painel_performance_periodo(date, date, text) to authenticated;

-- 3. CONVERSAO DIVIDIA DOIS UNIVERSOS DIFERENTES
-- O numerador era toda matricula da planilha e o denominador era so quem foi
-- atendido no WhatsApp. So 60% das matriculas (233 de 391) tem conversa com o
-- mesmo vendedor: o resto fechou por telefone, presencial ou com outra pessoa.
-- Dividir 209 por 1.083 dava 19% de conversao onde o certo e 10%. Agora o
-- numerador e a matricula de quem ele atendeu, e as duas pontas aparecem na
-- tela ("112 de 1.083").

-- 4. A GAVETA DE PESSOAS LISTAVA CONVERSA, NAO PESSOA
-- O numero dizia "1.159 pessoas" e a gaveta abria 1.258 linhas, porque usava a
-- gaveta da tela 340, que e de conversa e ali esta certa. Funcao propria, uma
-- linha por pessoa, com a contagem de conversas dela na coluna.
create or replace function painel_performance_pessoas(p_de date default null, p_ate date default null,
                                                     p_vendedor text default null, p_limite integer default 300)
returns table (pessoa text, telefone text, quando date, onde text, atendente text,
               conversas bigint, virou_matricula boolean, link text)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, current_date - 90) de, coalesce(p_ate, current_date) ate),
  base as (
    select c.telefone, vd.nome vendedor, c.id, c.inicio_sp, c.canal, c.quem_comecou, c.respondeu,
           row_number() over (partition by c.telefone, vd.nome order by c.inicio_sp desc) ordem,
           count(*) over (partition by c.telefone, vd.nome) quantas
    from conversas_mv c
    join vendedores vd on c.atendente = any (vd.nomes_planilha)
    cross join lim
    where vd.papel = 'comercial' and c.telefone is not null
      and c.inicio_sp::date between lim.de and lim.ate
      and (p_vendedor is null or vd.nome = p_vendedor)
  )
  select coalesce(pct.nome, '(sem nome)'), b.telefone, b.inicio_sp::date,
         b.canal || ' · ' || b.quem_comecou
           || case when b.respondeu then ' · respondeu' else ' · nunca respondeu' end,
         b.vendedor, b.quantas,
         exists (select 1 from vendas v
                  where (v.telefone_norm = b.telefone or v.resp_telefone_norm = b.telefone)
                    and e_matricula(v.produto_id)
                    and coalesce(lower(v.status), '') not like 'cancel%'
                    and v.data >= b.inicio_sp::date),
         pcv.bruto->>'previewUrl'
  from base b
  left join pigeon_conversas pcv on pcv.id = b.id
  left join pigeon_contatos pct on pct.id = pcv.contato_id
  where is_autorizado() and b.ordem = 1
  order by b.inicio_sp desc
  limit p_limite;
$f$;
revoke all on function painel_performance_pessoas(date, date, text, integer) from public, anon;
grant execute on function painel_performance_pessoas(date, date, text, integer) to authenticated;

-- 5. O AGENTE DE PRE-VENDAS APARECIA NA CARTEIRA DO COMERCIAL
-- Com 102 negociacoes abertas, como se fosse um vendedor. Nao e: papel
-- pre_venda_ia. Todas as funcoes da aba passaram a exigir papel comercial, no
-- vendedor e na negociacao.

-- Versoes antigas renomeadas (o tipo de retorno mudou): o 3 argumentos virou
-- painel_performance_semana_v1 e o 4 argumentos virou _v2.
