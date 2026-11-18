-- Update 71: totais de Lancamentos pelo banco (Raio-X B07).
--
-- A tela lia as linhas inteiras de `vendas` e somava no navegador. O servidor
-- devolve no maximo 1.000 linhas por consulta e a tabela tem mais de 5 mil, entao
-- o topo da tela mostrava o total de uma amostra enquanto o rodape mostrava a
-- contagem exata. Agora a soma e feita no banco, com os mesmos filtros da lista.
--
-- security invoker: a leitura segue a politica de `vendas` de quem chama, e se o
-- papel passar a valer na leitura (B11) este total acompanha sem outra mudanca.
create or replace function public.painel_vendas_totais(
  p_turma text default null,
  p_vendedor text default null,
  p_status text default null,
  p_busca text default null)
 returns table(alunos bigint, faturamento numeric, tabela numeric)
 language sql
 stable
 security invoker
 set search_path to 'public'
as $function$
  select count(*),
         coalesce(sum(v.valor_venda), 0),
         coalesce(sum(v.valor_tabela), 0)
  from vendas v
  where (coalesce(p_turma, '') = ''
         or (p_turma = '(sem turma)' and v.turma_id is null)
         or v.turma_id = p_turma)
    and (coalesce(p_vendedor, '') = ''
         or (p_vendedor = '(automatica)' and v.vendedor is null)
         or v.vendedor = p_vendedor)
    and (coalesce(p_status, '') = ''
         or (p_status = 'ativos' and coalesce(lower(v.status), '') not like 'cancel%')
         or (p_status = 'cancelados' and lower(coalesce(v.status, '')) like 'cancel%')
         or (p_status not in ('ativos', 'cancelados') and v.status = p_status))
    and (coalesce(btrim(p_busca), '') = ''
         or v.nome ilike '%' || btrim(p_busca) || '%');
$function$;

revoke execute on function public.painel_vendas_totais(text, text, text, text) from public, anon;
grant execute on function public.painel_vendas_totais(text, text, text, text) to authenticated, service_role;
