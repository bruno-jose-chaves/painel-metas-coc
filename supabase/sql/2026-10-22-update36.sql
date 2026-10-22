-- Update 36 · 22/10/2026
-- O insight de "falou e ficou sem resposta" apontava para /comercial/?v=gestao,
-- aba que nunca existiu com esse nome. Quem clicava caía na primeira aba de
-- Comercial e tinha de procurar a conversa na mão. A tela certa é a Operação do
-- dia, dentro de Hoje, que é onde a conversa do dia aparece pessoa por pessoa.
do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'painel_insights_calcular';
  d := replace(d, '/comercial/?v=gestao', '/?v=operacao');
  execute d;
end $do$;

-- create or replace devolve o grant padrão para PUBLIC.
revoke all on function painel_insights_calcular() from public, anon;
