-- Update 63 — quatro papéis, mais histórico do RD Marketing, venda automática e
-- a última rodada de desempenho

-- 1. RD MARKETING: dá para puxar mais histórico, e o limite era nosso.
--    O piso da fila de dias estava escrito à mão em 01/01/2025. Baixado para
--    01/01/2023: a rotina busca 25 dias por corrida e drena sozinha em algumas
--    horas. Dia sem dado volta vazio e fica marcado como buscado.
--    Isso vale para a conversão agregada por página e formulário. A conversão
--    por pessoa (rd_conversoes) chega por webhook e não tem como ser buscada
--    para trás: ela continua começando em 02/10/2026.
create or replace function public.rd_mkt_fila(p_quantos integer default 25)
 returns table(dia date) language sql stable security definer set search_path to 'public'
as $$
  with hoje as (select ((now() at time zone 'America/Sao_Paulo')::date) as d),
  grade as (select g::date as dia from hoje, generate_series('2023-01-01'::date, hoje.d, interval '1 day') g)
  select g.dia from grade g left join rd_mkt_dias m on m.dia = g.dia
  where m.dia is null order by g.dia desc limit greatest(p_quantos, 1);
$$;

-- 2. QUATRO PAPÉIS. meu_papel() devolve o papel de quem está logado, e a tela
--    monta o menu com ele. A trava de dado continua no banco, função por função.
create or replace function public.meu_papel()
 returns text language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select u.papel from usuarios_autorizados u where u.email = email_atual()), 'nenhum');
$$;
revoke all on function public.meu_papel() from public, anon;

--    As consultas que só a aba Time (310) e a Operação do dia (120) usam passam
--    a exigir diretoria, porque mostram nome e número de todo mundo:
--      painel_time_comercial, painel_parados, painel_vendas_periodo (viraram par
--        <nome>_aberto sem permissão + casca com is_admin())
--      painel_motivos_perda, painel_gestao, painel_gestao_dia,
--      painel_fechamento_origem, painel_fechamento_lista,
--      painel_perdas_pessoas, painel_parados_pessoas (is_autorizado -> is_admin)

-- 3. VENDA AUTOMÁTICA. Matrícula sem vendedor na planilha não é erro de
--    preenchimento: é a compra que o aluno fez sozinho pelo site. Saiu da lista
--    de conferência (painel_sugestoes) e passou a aparecer nomeada em
--    Lançamentos, em vez de um traço.

-- 4. DESEMPENHO. A turma de cada venda passou a morar na própria linha.
--    Antes toda tela que precisava dela chamava turma_da_venda() uma vez por
--    matrícula, e só a lista de turmas fazia isso 5.726 vezes por abertura.
--    painel_turmas: 337 ms -> 13 ms
alter table public.vendas add column if not exists turma_id text;
create index if not exists vendas_turma_id on public.vendas (turma_id);
update public.vendas set turma_id = turma_da_venda(produto_id, curso, data)
 where produto_id is not null and data is not null and turma_id is null;
-- vendas_preparar() passou a escrever new.turma_id, então venda nova já entra
-- com a turma resolvida.

-- 5. Ainda na fila, as duas que continuam perto de um segundo e as duas são de
--    diretoria: painel_gestao (1.175 ms) e painel_motivos_perda (980 ms).
--    E as quatro funções que ainda chamam turma_da_venda por linha:
--    painel_comparar_turmas, painel_comparar_turmas_resumo, painel_turma_cartao
--    e painel_upsell_modular.
