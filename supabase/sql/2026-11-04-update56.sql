-- Update 56 · 04/11/2026
-- Meu painel: a tela de quem vende (aba 130, dentro de Hoje).
--
-- Da simulacao das personas, o vendedor era quem o painel pior servia: 5 dos 8
-- casos parciais caiam no mesmo motivo, que e nao existir "o que e meu". Ele
-- tinha que procurar o proprio nome dentro de uma tabela de todo mundo.
--
-- O encanamento ja existia: vendedor_atual() liga o email do login ao cadastro,
-- e Joao e Marcia ja estavam ligados. So nao havia tela usando.
--
-- A comparacao e contra a media do time, sem nome de ninguem. Comparacao com
-- nome vira ranking publico e muda o comportamento de quem esta embaixo; a
-- media da a referencia sem expor colega, e o melhor do time aparece como
-- numero, tambem sem nome, para existir um teto visivel.
--
-- Nenhum numero daqui e meta individual: o COC nao premia volume individual e
-- isso nao mudou. A tela diz isso na ajuda, para nao virar cobranca.

create or replace function painel_meu_resumo(p_vendedor text default null)
returns table (vendedor text, hoje bigint, semana bigint, mes bigint, faturamento_mes numeric,
               ticket_mes numeric, carteira bigint, parados bigint, sem_resposta bigint,
               atendidos_hoje bigint, posicao integer, no_time integer)
language sql stable security definer set search_path to 'public' as $f$
  -- p_vendedor existe para o admin olhar a tela de outra pessoa sem precisar
  -- do login dela. Para o vendedor, vendedor_atual() resolve sozinho.
  with eu as (select coalesce(p_vendedor, vendedor_atual()) nome),
  d as (select (now() at time zone 'America/Sao_Paulo')::date dia,
               date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date sem,
               date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date mes),
  vendas_todos as (
    select vd.nome vendedor,
           count(*) filter (where v.data = (select dia from d)) hoje,
           count(*) filter (where v.data >= (select sem from d)) semana,
           count(*) mes, sum(v.valor_venda) fat, avg(v.valor_venda) ticket
    from vendas v
    join vendedores vd on v.vendedor = any (vd.nomes_planilha)
    where vd.papel = 'comercial' and coalesce(v.valor_venda, 0) > 0
      and coalesce(lower(v.status), '') not like 'cancel%' and e_matricula(v.produto_id)
      and v.data >= (select mes from d)
    group by 1
  ),
  posicoes as (select vendedor, rank() over (order by mes desc) pos, count(*) over () quantos from vendas_todos),
  meus_cards as (
    select count(*) abertas,
           count(*) filter (where (select dia from d) - coalesce(n.atualizado_em::date, n.criado_em::date) > 15) parados
    from v_negociacoes n, eu
    where n.status = 'aberta' and n.trilha = 'comercial' and n.papel = 'comercial'
      and exists (select 1 from vendedores vd where vd.nome = eu.nome
                   and (n.responsavel = any (vd.nomes_planilha) or vd.nome = n.responsavel))
  ),
  minhas_conversas as (
    select count(*) filter (where c.inicio_sp::date >= (select dia from d) - 14 and not c.respondeu) sem_resposta,
           count(distinct c.telefone) filter (where c.inicio_sp::date = (select dia from d)) hoje
    from conversas_mv c, eu
    where c.telefone is not null and c.inicio_sp::date >= (select dia from d) - 14
      and exists (select 1 from vendedores vd where vd.nome = eu.nome
                   and c.atendente = any (vd.nomes_planilha))
  )
  select eu.nome, coalesce(vt.hoje, 0), coalesce(vt.semana, 0), coalesce(vt.mes, 0),
         coalesce(vt.fat, 0), round(vt.ticket),
         mc.abertas, mc.parados, cv.sem_resposta, cv.hoje,
         coalesce(po.pos, 0)::integer, coalesce(po.quantos, 0)::integer
  from eu
  cross join meus_cards mc cross join minhas_conversas cv
  left join vendas_todos vt on vt.vendedor = eu.nome
  left join posicoes po on po.vendedor = eu.nome
  where is_autorizado() and eu.nome is not null;
$f$;
revoke all on function painel_meu_resumo(text) from public, anon;
grant execute on function painel_meu_resumo(text) to authenticated;

create or replace function painel_meu_contra_time(p_de date default null, p_ate date default null,
                                                 p_vendedor text default null)
returns table (indicador text, rotulo text, unidade text, meu numeric, media_time numeric,
               melhor_do_time numeric, maior_e_melhor boolean, oque text)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, current_date - 30) de, coalesce(p_ate, current_date) ate),
  eu as (select coalesce(p_vendedor, vendedor_atual()) nome),
  junto as (
    select p.vendedor, p.pessoas::numeric pessoas, p.dias_com_atendimento::numeric dias,
           p.vendas::numeric vendas, p.conversao, p.ticket_medio, p.taxa_resposta,
           r.mediana_min, r.sem_resposta::numeric / nullif(r.procuraram, 0) fatia_muda
    from painel_performance_periodo((select de from lim), (select ate from lim), null) p
    left join painel_performance_resposta((select de from lim), (select ate from lim),
                                          'util', false, false) r on r.vendedor = p.vendedor
  ),
  campos as (
    select * from (values
      ('matriculas', 'Matrículas', 'n', true, 'Quantas matrículas saíram no período.'),
      ('pessoas', 'Pessoas atendidas', 'n', true, 'Gente diferente com quem você falou no WhatsApp.'),
      ('dias', 'Dias com atendimento', 'n', true, 'Em quantos dias do período você abriu conversa com alguém.'),
      ('conversao', 'Conversão', 'pct', true, 'Das pessoas que você atendeu, quantas viraram matrícula.'),
      ('ticket', 'Ticket médio', 'brl', true, 'Valor médio da matrícula. Depende do curso que você vende.'),
      ('resposta', 'Tempo até responder', 'min', false, 'Mediana no relógio comercial, só conversa que o cliente começou.'),
      ('mudos', 'Que nunca responderam', 'pct', false, 'Fatia de quem te procurou e não teve resposta nenhuma.')
    ) t(id, rotulo, unidade, maior_melhor, oque)
  ),
  valores as (
    select c.id, c.rotulo, c.unidade, c.maior_melhor, c.oque, j.vendedor,
           case c.id when 'matriculas' then j.vendas when 'pessoas' then j.pessoas
                     when 'dias' then j.dias when 'conversao' then j.conversao
                     when 'ticket' then j.ticket_medio when 'resposta' then j.mediana_min
                     else j.fatia_muda end valor
    from campos c cross join junto j
  )
  select id, rotulo, unidade,
         max(valor) filter (where vendedor = (select nome from eu)),
         round(avg(valor), 2),
         case when maior_melhor then max(valor) else min(valor) end,
         maior_melhor, oque
  from valores
  where is_autorizado() and (select nome from eu) is not null
  group by id, rotulo, unidade, maior_melhor, oque
  order by array_position(array['matriculas','pessoas','dias','conversao','ticket','resposta','mudos'], id);
$f$;
revoke all on function painel_meu_contra_time(date, date, text) from public, anon;
grant execute on function painel_meu_contra_time(date, date, text) to authenticated;

create or replace function painel_minha_fila(p_vendedor text default null, p_limite integer default 60)
returns table (tipo text, prioridade integer, pessoa text, telefone text, onde text,
               dias integer, desde date, ja_e_aluno boolean, o_que_fazer text)
language sql stable security definer set search_path to 'public' as $f$
  -- A mesma fila da tela 352, so que a minha.
  with eu as (select coalesce(p_vendedor, vendedor_atual()) nome)
  select f.tipo, f.prioridade, f.pessoa, f.telefone, f.onde, f.dias, f.desde,
         f.ja_e_aluno, f.o_que_fazer
  from painel_escapando(600) f, eu
  where is_autorizado() and eu.nome is not null
    and (f.dono = eu.nome
         or exists (select 1 from vendedores vd where vd.nome = eu.nome and f.dono = any (vd.nomes_planilha)))
  order by f.prioridade, f.dias desc
  limit p_limite;
$f$;
revoke all on function painel_minha_fila(text, integer) from public, anon;
grant execute on function painel_minha_fila(text, integer) to authenticated;
