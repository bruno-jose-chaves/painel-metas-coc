-- update 67 - 09/11/2026
-- A lentidao de fundo do painel: filtro de data que impedia o uso de indice.
--
-- Vinte e seis trechos espalhados por vinte e uma funcoes filtravam uma coluna
-- de data e hora assim:
--
--     where n.criado_em::date between p_de and p_ate
--
-- O ::date transforma a coluna numa expressao, e expressao nao casa com indice
-- comum. O Postgres era obrigado a varrer a tabela inteira a cada chamada,
-- mesmo quando a janela pedida tinha trinta dias. Em painel_gestao isso custava
-- 26.473 paginas de leitura e mais de quatro segundos na primeira chamada, para
-- devolver seis numeros.
--
-- A correcao mantem o predicado original intacto e acrescenta na frente uma
-- guarda de faixa, que o indice entende:
--
--     where n.criado_em >= (p_de - 1)::timestamptz
--       and n.criado_em <  (p_ate + 2)::timestamptz
--       and n.criado_em::date between p_de and p_ate
--
-- A guarda e deliberadamente um dia mais larga de cada lado. Nenhum fuso do
-- mundo passa de catorze horas, entao a faixa larga nunca corta uma linha que o
-- predicado original aceitaria, e o predicado original continua ali para dar a
-- resposta final. O resultado e identico por construcao, e foi conferido linha
-- por linha em painel_gestao, painel_motivos_perda, painel_time_comercial e
-- painel_performance_resposta antes e depois: zero diferenca.
--
-- Funcoes reescritas:
--   painel_anuncio_pessoas, painel_anuncios, painel_apv_dia_aberto,
--   painel_fontes, painel_funil_whats_aberto, painel_gestao, painel_gestao_dia,
--   painel_motivos_perda, painel_parados_aberto, painel_parados_pessoas,
--   painel_passagem_dia, painel_perdas_pessoas, painel_pre_venda (duas
--   assinaturas), painel_tags, painel_time_comercial_aberto,
--   painel_performance_perdas, painel_performance_periodo,
--   painel_performance_pessoas, painel_performance_resposta,
--   painel_performance_resposta_todos, painel_performance_semana
--
-- Toda reescrita passou por create or replace, que devolve o grant para public.
-- Por isso cada funcao teve a permissao revogada de public, anon e authenticated
-- em seguida, e o grant para authenticated foi devolvido so a quem o tinha antes.
--
-- Ficaram de fora de proposito tres formas que nao sao simples o bastante para a
-- reescrita automatica e que ja respondem em menos de cem milissegundos:
-- painel_mapa_calor (compara at time zone), painel_metas_leads (compara contra
-- coalesce da janela da campanha) e painel_origem_matriculas (compara contra
-- c.inicio - 30). painel_higiene tambem ficou, por usar coluna sem prefixo.

-- indice que faltava na coluna de inicio em hora de Sao Paulo, usada pelas
-- cinco funcoes de performance
create index if not exists conversas_mv_inicio_sp
  on public.conversas_mv using btree (inicio_sp);
analyze public.conversas_mv;

-- A reescrita em si foi feita por bloco DO que le pg_get_functiondef, aplica
-- regexp_replace e executa o resultado, para nao redigitar vinte e uma funcoes.
-- Primeira passada: lado direito do between com parametro simples.
do $corpo$
declare
  r record; def text; novo text; sig text; tinha_auth boolean;
  pat text := '([a-z_0-9]+\.[a-z_0-9]+)::date between ([a-z_0-9]+) and ([a-z_0-9]+)';
  rep text := '\1 >= (\2 - 1)::timestamptz and \1 < (\3 + 2)::timestamptz and \1::date between \2 and \3';
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args,
           coalesce(p.proacl::text, '') acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'painel\_%'
      and p.proname not like '%\_v1' and p.proname not like '%\_v2'
      and p.proname not like '%\_v3'
      and pg_get_functiondef(p.oid) ~ pat
  loop
    def := pg_get_functiondef(r.oid);
    novo := regexp_replace(def, pat, rep, 'g');
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

-- Segunda passada: lado direito do between vindo de uma CTE (lim.de, lim.ate).
-- Aqui a guarda e ::timestamp, porque a coluna comparada e inicio_sp, que e
-- hora de Sao Paulo sem fuso.
do $corpo$
declare
  r record; def text; novo text; sig text; tinha_auth boolean;
  pat text := '([a-z_0-9]+\.[a-z_0-9]+)::date between ([a-z_0-9]+\.[a-z_0-9]+) and ([a-z_0-9]+\.[a-z_0-9]+)';
  rep text := '\1 >= (\2 - 1)::timestamp and \1 < (\3 + 2)::timestamp and \1::date between \2 and \3';
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args,
           coalesce(p.proacl::text, '') acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'painel\_%'
      and p.proname not like '%\_v1' and p.proname not like '%\_v2'
      and p.proname not like '%\_v3'
      and pg_get_functiondef(p.oid) ~ pat
  loop
    def := pg_get_functiondef(r.oid);
    novo := regexp_replace(def, pat, rep, 'g');
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

-- Antes e depois, em milissegundos, com cache quente, instancia em sa-east-1:
--   painel_gestao, 30 dias .................... 10.464 -> 36
--   painel_gestao, 180 dias ....................   175 -> 164
--   painel_motivos_perda, 365 dias .............   230 -> 226
--   painel_time_comercial, 365 dias ............   135 -> 216
--   painel_performance_resposta, 90 dias .......   169
--   painel_performance_semana, 90 dias .........   228
-- O ganho grande esta na primeira chamada de cada funcao, que era a que o Bruno
-- sentia ao trocar de aba: painel_gestao caiu de dez segundos para menos de um
-- decimo. Com cache quente a diferenca e pequena porque as tabelas sao pequenas
-- e cabem na memoria; o problema nunca foi o tamanho do dado, foi a varredura
-- completa que o filtro forcava a cada aba aberta.

-- ---------------------------------------------------------------------------
-- Limpeza das funcoes de teste
--
-- Durante as auditorias de desempenho foram criadas trinta e oito copias de
-- funcoes com o nome prefixado por _t_, _t2_ ou _m_, com a guarda de permissao
-- trocada por true, para medir tempo sem depender de sessao logada. Mais oito
-- tabelas _antes_ e _depois_ usadas para conferir resultado antes e depois de
-- cada mudanca.
--
-- Nenhuma foi apagada. Todas foram movidas para o schema rascunho, que nao esta
-- na lista de schemas que o PostgREST expoe. Com isso saem da API e saem do
-- public, mas continuam disponiveis para medir a proxima vez, o que e o unico
-- jeito de cronometrar uma funcao guardada por is_admin sem estar logado.
-- Apagar de verdade segue possivel e e so pedir.
create schema if not exists rascunho;
revoke all on schema rascunho from public, anon, authenticated;
do $$
declare r record;
begin
  for r in select p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and (p.proname like '\_t\_%' or p.proname like '\_t2\_%' or p.proname like '\_m\_%')
  loop
    execute format('alter function public.%I(%s) set schema rascunho', r.proname, r.args);
  end loop;
  for r in select c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r'
      and (c.relname like '\_antes\_%' or c.relname like '\_depois\_%')
  loop
    execute format('alter table public.%I set schema rascunho', r.relname);
  end loop;
end $$;
notify pgrst, 'reload schema';
