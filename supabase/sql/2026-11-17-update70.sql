-- Update 70: acesso fechado (Raio-X B01, B02 e parte de B43).
--
-- B01. A trava de enviar_fila_manha testava current_user <> 'postgres'. Dentro de
-- uma funcao security definer current_user e sempre o dono (postgres), entao a
-- condicao era sempre falsa e qualquer conta logada disparava a fila no WhatsApp.
-- O que identifica quem chamou e session_user: 'postgres' quando e o pg_cron,
-- 'authenticator' quando vem da API. A trava passa a ser: diretoria ou cron.
create or replace function public.enviar_fila_manha(p_so_teste boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  cfg record; p record; fila jsonb; t text; req bigint;
  enviados int := 0; sem_fila int := 0; itens int;
begin
  if session_user <> 'postgres' and not is_admin() then
    raise exception 'só a diretoria envia a fila';
  end if;

  select * into cfg from privado.resumo_entrega where id = 1;
  if cfg.url is null then
    return jsonb_build_object('ok', false, 'erro', 'destino nao configurado');
  end if;

  fila := fila_agora();

  for p in select * from pessoas_fila where ativo order by nome loop
    t := fila_da_pessoa(p.nome, 10, fila);
    if t is null then sem_fila := sem_fila + 1; continue; end if;

    select count(*) into itens
    from jsonb_to_recordset(fila) as e(dono text)
    where e.dono = any(array_append(coalesce(p.apelidos, '{}'), p.nome));

    if p_so_teste then
      enviados := enviados + 1;
      continue;
    end if;

    select net.http_post(
      url := cfg.url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('texto', t, 'para', to_jsonb(array[p.telefone]))
    ) into req;

    insert into privado.fila_envio (nome, telefone, itens, requisicao)
    values (p.nome, p.telefone, itens, req);
    enviados := enviados + 1;
  end loop;

  if not p_so_teste then
    t := fila_consolidada(fila);
    select net.http_post(
      url := cfg.url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('texto', t, 'para', to_jsonb(cfg.para))
    ) into req;
    insert into privado.fila_envio (nome, telefone, itens, requisicao)
    values ('(consolidado)', array_to_string(cfg.para, ','), 0, req);
  end if;

  return jsonb_build_object('ok', true, 'enviados', enviados, 'sem_fila', sem_fila, 'teste', p_so_teste);
end $function$;

-- B02. As duas funcoes da fila que o site chama (previa da mensagem e lista de
-- donos sem cadastro) mostram nome e telefone de lead. Ficam com a mesma trava.
create or replace function public.fila_da_pessoa(p_nome text, p_limite integer default 3, p_fila jsonb default null::jsonb)
 returns text
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  nomes text[];
  fila jsonb;
  t text; g record; linha record; total int;
begin
  if session_user <> 'postgres' and not is_admin() then
    raise exception 'só a diretoria vê a fila';
  end if;
  fila := coalesce(p_fila, fila_agora());

  select array_append(coalesce(apelidos, '{}'), nome) into nomes from pessoas_fila where nome = p_nome;
  if nomes is null then return null; end if;

  select count(*) into total from jsonb_to_recordset(fila) as e(dono text) where e.dono = any(nomes);
  if coalesce(total, 0) = 0 then return null; end if;

  t := '*Sua fila · ' || to_char(d, 'DD/MM') || '*' || chr(10) || chr(10)
       || total || case when total > 1 then ' itens estão' else ' item está' end
       || ' esperando você. A ordem é a do que custa mais caro ficar parado.' || chr(10);

  -- Antes a mensagem mostrava os dez primeiros da lista inteira, e um tipo com
  -- muita gente comia o espaço dos outros: a Marcia recebia nove conversas sem
  -- card e nenhuma das 164 negociações paradas. Agora cada tipo mostra os seus
  -- mais antigos, e diz quantos ficaram de fora.
  for g in
    select e.tipo, min(e.prioridade) as prioridade, count(*) as quantos
    from jsonb_to_recordset(fila) as e(tipo text, prioridade int, dono text)
    where e.dono = any(nomes)
    group by e.tipo order by min(e.prioridade), count(*) desc
  loop
    t := t || chr(10) || '*' || g.tipo || ' (' || g.quantos || ')*' || chr(10);
    for linha in
      select * from jsonb_to_recordset(fila)
        as e(tipo text, pessoa text, telefone text, dono text, dias int,
             ja_e_aluno boolean, o_que_fazer text)
      where e.dono = any(nomes) and e.tipo = g.tipo
      order by e.dias desc limit p_limite
    loop
      t := t || '• ' || coalesce(linha.pessoa, 'sem nome')
           || case when linha.telefone is not null then ' · ' || linha.telefone else '' end
           || ' · parado há ' || linha.dias || ' dias'
           || case when linha.ja_e_aluno then ' · já é aluno' else '' end || chr(10)
           || '   ' || linha.o_que_fazer || chr(10);
    end loop;
    if g.quantos > p_limite then
      t := t || '   e mais ' || (g.quantos - p_limite) || ' deste tipo.' || chr(10);
    end if;
  end loop;

  t := t || chr(10) || 'A lista inteira está em Comercial, O que está escapando:' || chr(10)
       || 'https://painel-metas-coc.pages.dev/comercial/?v=atendimento';
  return t;
end $function$;

create or replace function public.fila_donos_sem_cadastro()
 returns table(dono text, quantos bigint)
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if session_user <> 'postgres' and not is_admin() then
    raise exception 'só a diretoria vê a fila';
  end if;
  return query
    select e.dono, count(*)
    from jsonb_to_recordset(fila_agora()) as e(dono text)
    where not exists (
      select 1 from pessoas_fila p
      where p.ativo and (p.nome = e.dono or e.dono = any(p.apelidos))
    )
    group by e.dono order by count(*) desc;
end $function$;

-- B02. As seis funcoes abaixo so sao chamadas por outras funcoes security
-- definer (resumo_do_dia, enviar_fila_manha, insights) e pela Edge Function
-- resumo-diario, que usa a chave de servico. O site nunca chama nenhuma delas.
-- Sem EXECUTE para authenticated, quem cria conta na tela de login deixa de
-- conseguir ler vendas, faturamento e leads do dia por elas.
revoke execute on function public.resumo_do_dia(date) from authenticated;
revoke execute on function public.conversas_sem_card(integer) from authenticated;
revoke execute on function public.leads_do_comercial(date, date) from authenticated;
revoke execute on function public.passagem_fraca(date, date, integer, numeric) from authenticated;
revoke execute on function public.fila_agora() from authenticated;
revoke execute on function public.fila_consolidada(jsonb) from authenticated;

-- B43. solicitar_acesso e chamavel sem login e devolvia 'ja_autorizado', o que
-- permitia descobrir quais e-mails tem acesso. Passa a responder igual nos dois
-- casos e nao grava nada quando o e-mail ja esta autorizado.
create or replace function public.solicitar_acesso(p_email text, p_nome text default null::text, p_mensagem text default null::text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  e text := lower(btrim(p_email));
  recentes int;
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return 'email_invalido';
  end if;
  if exists (select 1 from usuarios_autorizados u where u.email = e) then
    return 'registrada';
  end if;

  select count(*) into recentes from solicitacoes_acesso where criada_em > now() - interval '1 hour';
  if recentes > 20 then
    return 'muitas_solicitacoes';
  end if;

  insert into solicitacoes_acesso (email, nome, mensagem)
  values (e, nullif(btrim(p_nome), ''), left(nullif(btrim(p_mensagem), ''), 300))
  on conflict (email) do update set
    nome = coalesce(excluded.nome, solicitacoes_acesso.nome),
    mensagem = coalesce(excluded.mensagem, solicitacoes_acesso.mensagem),
    criada_em = now(),
    situacao = case when solicitacoes_acesso.situacao = 'recusada' then 'recusada' else 'pendente' end;

  return 'registrada';
end;
$function$;
