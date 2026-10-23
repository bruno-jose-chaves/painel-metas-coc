-- Update 38 · 23/10/2026
-- A fila deixa de esperar alguém abrir a tela e vai atrás do dono.
--
-- O painel já sabe o que está escapando e de quem é. O que faltava era isso
-- chegar na mão de quem resolve, de manhã, sem depender de ninguém lembrar.
-- Mesmo caminho da mensagem das 20h: o banco empurra para o n8n.
--
-- O problema do nome: a mesma pessoa aparece com nome diferente em cada fonte.
-- "Marcia" no Pigeon e "Marcia  Laurett" (com dois espaços) no CRM são a mesma
-- Marcia. Por isso a pessoa tem apelidos, e não um nome só.

create table if not exists pessoas_fila (
  id bigserial primary key,
  nome text not null unique,
  apelidos text[] not null default '{}',
  telefone text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

alter table pessoas_fila enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'pessoas_fila' and policyname = 'pessoas_fila_le') then
    execute 'create policy pessoas_fila_le on pessoas_fila for select using ((select is_admin()))';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'pessoas_fila' and policyname = 'pessoas_fila_escreve') then
    execute 'create policy pessoas_fila_escreve on pessoas_fila for all using ((select is_admin())) with check ((select is_admin()))';
  end if;
end $$;

revoke all on pessoas_fila from anon;
grant all on pessoas_fila to authenticated;
grant usage, select on sequence pessoas_fila_id_seq to authenticated;

-- Registro de entrega, para dar para conferir se saiu e para quem.
create table if not exists privado.fila_envio (
  id bigserial primary key,
  nome text not null,
  telefone text not null,
  itens int not null,
  requisicao bigint,
  enviado_em timestamptz not null default now()
);

-- A fila inteira, uma vez. painel_escapando leva quase três segundos, então
-- chamar uma vez por pessoa sairia caro à toa: lê uma vez e passa adiante.
create or replace function fila_agora()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from painel_escapando(2000) e;
$$;

-- A fila de uma pessoa, em texto de WhatsApp. Devolve nulo quando ela está
-- limpa: mensagem vazia todo dia é o caminho mais curto para o time parar de
-- ler as que importam.
--
-- Mostra os mais antigos de cada tipo, e não os primeiros da lista inteira: um
-- tipo com muita gente comia o espaço dos outros, e a Marcia recebia nove
-- conversas sem card e nenhuma das 164 negociações paradas.
create or replace function fila_da_pessoa(p_nome text, p_limite int default 3, p_fila jsonb default null)
returns text language plpgsql stable security definer set search_path to 'public' as $f$
declare
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  nomes text[];
  fila jsonb := coalesce(p_fila, fila_agora());
  t text; g record; linha record; total int;
begin
  select array_append(coalesce(apelidos, '{}'), nome) into nomes from pessoas_fila where nome = p_nome;
  if nomes is null then return null; end if;

  select count(*) into total from jsonb_to_recordset(fila) as e(dono text) where e.dono = any(nomes);
  if coalesce(total, 0) = 0 then return null; end if;

  t := '*Sua fila · ' || to_char(d, 'DD/MM') || '*' || chr(10) || chr(10)
       || total || case when total > 1 then ' itens estão' else ' item está' end
       || ' esperando você. A ordem é a do que custa mais caro ficar parado.' || chr(10);

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
end $f$;

-- O consolidado, por pessoa, para quem já recebe o resumo das 20h.
create or replace function fila_consolidada(p_fila jsonb default null)
returns text language plpgsql stable security definer set search_path to 'public' as $f$
declare
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  fila jsonb := coalesce(p_fila, fila_agora());
  t text; linha record; total int; sem_envio text;
begin
  select count(*) into total from jsonb_to_recordset(fila) as e(dono text);

  t := '*Fila de hoje · ' || to_char(d, 'DD/MM') || '*' || chr(10) || chr(10)
       || coalesce(total, 0) || ' itens esperando alguém.' || chr(10) || chr(10);

  -- A mesma pessoa aparece com nome diferente em cada fonte. Quem está
  -- cadastrado entra com um nome só, senão a Marcia aparecia duas vezes.
  for linha in
    with itens as (
      select coalesce((select p.nome from pessoas_fila p
                       where p.nome = e.dono or e.dono = any(p.apelidos) limit 1), e.dono) as quem,
             e.tipo, e.dias
      from jsonb_to_recordset(fila) as e(tipo text, dono text, dias int)
    )
    select quem,
           count(*) as quantos,
           count(*) filter (where tipo = 'Pagamento pendente') as pgto,
           count(*) filter (where tipo = 'Conversa sem card') as sem_card,
           count(*) filter (where tipo = 'Negociação parada') as paradas,
           max(dias) as mais_parado
    from itens group by quem
    order by count(*) filter (where tipo = 'Pagamento pendente') desc, count(*) desc
  loop
    t := t || '• *' || linha.quem || '*: ' || linha.quantos || chr(10)
         || '   ' || linha.pgto || ' pagamento pendente · ' || linha.sem_card
         || ' sem card · ' || linha.paradas || ' parada'
         || case when linha.paradas <> 1 then 's' else '' end
         || ' · mais antigo há ' || linha.mais_parado || ' dias' || chr(10);
  end loop;

  -- Dono que não está cadastrado não recebeu a própria fila, e isso precisa
  -- aparecer: senão a diretoria acha que todo mundo foi avisado.
  select string_agg(distinct e.dono, ', ') into sem_envio
  from jsonb_to_recordset(fila) as e(dono text)
  where not exists (
    select 1 from pessoas_fila p
    where p.ativo and (p.nome = e.dono or e.dono = any(p.apelidos))
  );

  if sem_envio is not null then
    t := t || chr(10) || '*Não recebeu a própria fila:* ' || sem_envio
         || '. Cadastrar em Ajustes, Acesso e integrações.' || chr(10);
  end if;

  t := t || chr(10) || 'https://painel-metas-coc.pages.dev/comercial/?v=atendimento';
  return t;
end $f$;

-- O envio de todo mundo, de uma vez.
create or replace function enviar_fila_manha(p_so_teste boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  cfg record; p record; fila jsonb; t text; req bigint;
  enviados int := 0; sem_fila int := 0; itens int;
begin
  if not is_admin() and current_user <> 'postgres' then
    raise exception 'só a diretoria envia a fila';
  end if;

  select * into cfg from privado.resumo_entrega where id = 1;
  if cfg.url is null then
    return jsonb_build_object('ok', false, 'erro', 'destino nao configurado');
  end if;

  fila := fila_agora();

  for p in select * from pessoas_fila where ativo order by nome loop
    t := fila_da_pessoa(p.nome, 3, fila);
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
end $$;

-- Quem está escapando e ainda não tem telefone cadastrado. Alimenta a tela.
create or replace function fila_donos_sem_cadastro()
returns table (dono text, quantos bigint)
language sql stable security definer set search_path to 'public' as $$
  select e.dono, count(*)
  from jsonb_to_recordset(fila_agora()) as e(dono text)
  where not exists (
    select 1 from pessoas_fila p
    where p.ativo and (p.nome = e.dono or e.dono = any(p.apelidos))
  )
  group by e.dono order by count(*) desc;
$$;

revoke all on function fila_agora() from public, anon;
revoke all on function fila_da_pessoa(text, int, jsonb) from public, anon;
revoke all on function fila_consolidada(jsonb) from public, anon;
revoke all on function enviar_fila_manha(boolean) from public, anon;
revoke all on function fila_donos_sem_cadastro() from public, anon;
grant execute on function fila_agora() to authenticated;
grant execute on function fila_da_pessoa(text, int, jsonb) to authenticated;
grant execute on function fila_consolidada(jsonb) to authenticated;
grant execute on function enviar_fila_manha(boolean) to authenticated;
grant execute on function fila_donos_sem_cadastro() to authenticated;

-- 8h30 de Brasília, de segunda a sexta. O servidor trabalha em UTC.
select cron.schedule('fila-manha', '30 11 * * 1-5', 'select public.enviar_fila_manha()');

-- Últimos envios, para a tela conseguir mostrar se saiu e para quem.
create or replace function fila_ultimos_envios()
returns table (nome text, itens int, enviado_em timestamptz)
language sql stable security definer set search_path to 'public' as $f$
  select e.nome, e.itens, e.enviado_em from privado.fila_envio e
  where (select is_admin())
  order by e.id desc limit 12;
$f$;
revoke all on function fila_ultimos_envios() from public, anon;
grant execute on function fila_ultimos_envios() to authenticated;

-- Jargão fora das telas: "Lead do SDR sem contato" e "funil SDR" viraram
-- pré-vendas também no banco, que é de onde o rótulo sai.
do $do$
declare d text; f record;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('painel_escapando', 'painel_escapando_resumo')
  loop
    d := pg_get_functiondef(f.oid);
    d := replace(d, 'Lead do SDR sem contato', 'Lead de pré-vendas sem contato');
    d := replace(d, 'funil SDR', 'funil de pré-vendas');
    execute d;
  end loop;
end $do$;
revoke all on function painel_escapando(int) from public, anon;
revoke all on function painel_escapando_resumo() from public, anon;
grant execute on function painel_escapando(int) to authenticated;
grant execute on function painel_escapando_resumo() to authenticated;
