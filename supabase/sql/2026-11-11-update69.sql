-- update 69 - 11/11/2026
-- Cinco funcoes ainda resolviam a turma de cada venda chamando funcao, linha
-- por linha, mesmo depois de a coluna vendas.turma_id existir.
--
-- O padrao era este:
--
--     where turma_da_venda(v.produto_id, v.curso, v.data) = p_a
--
-- turma_da_venda e uma funcao que casa produto, curso e data contra a janela de
-- cada turma. Ela e correta e continua sendo a fonte do valor, mas chamar uma
-- funcao dentro do where obriga o Postgres a executa-la em cada uma das 5.735
-- linhas de vendas e impede qualquer indice. A coluna turma_id guarda o mesmo
-- resultado, e escrita pelo trigger vendas_preparar e tem indice.
--
-- Antes de trocar, a equivalencia foi conferida nas 5.735 linhas:
--
--     select count(*) filter (
--       where turma_id is distinct from turma_da_venda(produto_id, curso, data)
--     ) from vendas;
--     -- 0
--
-- Funcoes alteradas: painel_comparar_turmas_aberto (duas vezes),
-- painel_comparar_turmas_resumo_aberto, painel_turma_cartao,
-- painel_pessoa_ficha_aberto e painel_upsell_modular.
--
-- turma_da_venda e vendas_preparar ficaram intactas de proposito: a funcao
-- continua sendo a regra, e o trigger continua sendo quem grava a coluna. O que
-- mudou e so quem le.

do $corpo$
declare
  r record; def text; novo text; sig text; tinha_auth boolean;
  pat text := 'turma_da_venda\(([a-z_0-9]+)\.produto_id, \1\.curso, \1\.data\)';
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args,
           coalesce(p.proacl::text, '') acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname not in ('turma_da_venda', 'vendas_preparar')
      and pg_get_functiondef(p.oid) ~ pat
  loop
    def := pg_get_functiondef(r.oid);
    novo := regexp_replace(def, pat, '\1.turma_id', 'g');
    if novo = def then continue; end if;
    sig := format('public.%I(%s)', r.proname, r.args);
    tinha_auth := r.acl like '%authenticated=X%';
    execute novo;
    execute 'revoke all on function ' || sig || ' from public, anon, authenticated';
    if tinha_auth then
      execute 'grant execute on function ' || sig || ' to authenticated';
    end if;
  end loop;
end $corpo$;

-- Resultado conferido linha por linha antes e depois, em quatro combinacoes de
-- turma (Metodo ACAFE 1 contra 2, Semi 1 contra 2, o cartao de quatro turmas e
-- o upsell ACAFE para UFSC): zero diferenca.
--
-- Antes e depois, em milissegundos:
--   painel_comparar_turmas_aberto ............ 635 -> 5
--   painel_comparar_turmas_resumo_aberto ..... 452 -> 30
--   painel_turma_cartao ...................... 76
--   painel_pessoa_ficha ...................... 239
--   painel_upsell_modular .................... 2
--
-- A tela de comparar turmas era a mais lenta do painel depois das de gestao.
-- Agora responde na hora.

-- Tambem foram movidas para rascunho as copias de teste que sobraram em public
-- com prefixo _ (o _m2_painel_turmas e as _v_ criadas hoje), pelo mesmo motivo
-- do update 67: saem da API e saem do public, sem operacao destrutiva.
do $corpo$
declare r record;
begin
  for r in select p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like '\_%'
  loop
    execute format('alter function public.%I(%s) set schema rascunho', r.proname, r.args);
  end loop;
end $corpo$;
notify pgrst, 'reload schema';
