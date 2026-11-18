-- Update 72: alerta ativo quando uma fonte passa para "fora" (Raio-X B53).
-- Ainda nao aplicado no banco: a aplicacao esta pendente.
--
-- Hoje o aviso de fonte fora so aparece para quem abre o painel. Esta rotina roda
-- a cada 10 minutos, olha saude_fontes_cache e manda uma mensagem pelo mesmo
-- destino do resumo diario quando uma fonte fica "fora", repete a cada 6 horas
-- enquanto continuar fora e avisa quando voltar ao normal.
create table if not exists privado.alerta_fonte (
  fonte text primary key,
  avisada_em timestamptz not null default now()
);

create or replace function public.alertar_fontes_fora(p_so_teste boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  cfg record; t text := ''; req bigint;
  novas text; voltaram text;
begin
  if session_user <> 'postgres' and not is_admin() then
    raise exception 'só a diretoria roda o alerta';
  end if;

  select * into cfg from privado.resumo_entrega where id = 1;
  if cfg.url is null then
    return jsonb_build_object('ok', false, 'erro', 'destino nao configurado');
  end if;

  select string_agg('• ' || s.fonte || ' (sem sinal há ' ||
           case when s.atraso_min >= 120 then round(s.atraso_min / 60.0)::int || ' h'
                else s.atraso_min || ' min' end || ')', chr(10) order by s.ordem)
    into novas
  from saude_fontes_cache s
  left join privado.alerta_fonte a on a.fonte = s.fonte
  where s.situacao = 'fora'
    and (a.fonte is null or a.avisada_em < now() - interval '6 hours');

  select string_agg('• ' || a.fonte, chr(10) order by a.fonte)
    into voltaram
  from privado.alerta_fonte a
  where not exists (select 1 from saude_fontes_cache s where s.fonte = a.fonte and s.situacao = 'fora');

  if novas is null and voltaram is null then
    return jsonb_build_object('ok', true, 'enviado', false);
  end if;

  if novas is not null then
    t := '*Painel de Metas: fonte fora do ar*' || chr(10) || chr(10) || novas || chr(10) || chr(10)
         || 'Em Acesso e integrações, Fontes, está o motivo de cada uma.';
  end if;
  if voltaram is not null then
    if t <> '' then t := t || chr(10) || chr(10); end if;
    t := t || '*Voltou ao normal*' || chr(10) || chr(10) || voltaram;
  end if;

  if p_so_teste then
    return jsonb_build_object('ok', true, 'enviado', false, 'teste', true, 'texto', t);
  end if;

  select net.http_post(
    url := cfg.url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('texto', t, 'para', to_jsonb(cfg.para))
  ) into req;

  insert into privado.alerta_fonte (fonte, avisada_em)
  select s.fonte, now() from saude_fontes_cache s
  where s.situacao = 'fora' and (
    not exists (select 1 from privado.alerta_fonte a where a.fonte = s.fonte)
    or exists (select 1 from privado.alerta_fonte a where a.fonte = s.fonte and a.avisada_em < now() - interval '6 hours'))
  on conflict (fonte) do update set avisada_em = excluded.avisada_em;

  delete from privado.alerta_fonte a
  where not exists (select 1 from saude_fontes_cache s where s.fonte = a.fonte and s.situacao = 'fora');

  return jsonb_build_object('ok', true, 'enviado', true, 'requisicao', req);
end $function$;

revoke execute on function public.alertar_fontes_fora(boolean) from public, anon, authenticated;
grant execute on function public.alertar_fontes_fora(boolean) to service_role;

select cron.schedule('alerta-fontes', '*/10 * * * *', 'select public.alertar_fontes_fora()');

-- B15: rotina de limpeza do historico do pg_cron, ja aplicada em 17/11/2026.
-- select cron.schedule('limpar-historico-cron', '30 6 * * *',
--   $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$);
