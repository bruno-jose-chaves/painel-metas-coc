-- Base das conversas do Pigeon Post, importadas pela API a partir do início da
-- campanha do Método ACAFE 2º/2026 (25/08/2026).

create table if not exists pigeon_canais (
  id text primary key, numero text, papel text not null default 'outro', tipo text
);

create table if not exists pigeon_contatos (
  id text primary key, nome text, telefone_norm text, email_norm text,
  etiquetas text[] not null default '{}', origem text,
  criado_em timestamptz, atualizado_em timestamptz, bruto jsonb
);

create table if not exists pigeon_conversas (
  id text primary key, contato_id text, canal_id text, usuario_id text, equipe_id text,
  numero text, status text, origem text,
  criado_em timestamptz, inicio timestamptz, fim timestamptz, ultima_interacao timestamptz,
  nao_lidas int, bruto jsonb
);

create table if not exists pigeon_sync_estado (
  recurso text primary key, pagina int not null default 1, desde timestamptz,
  ultimo_corte timestamptz, total_api int, gravados int not null default 0,
  concluido_em timestamptz, erro text, atualizado_em timestamptz not null default now()
);

create index if not exists pigeon_contatos_tel on pigeon_contatos (telefone_norm);
create index if not exists pigeon_conversas_contato on pigeon_conversas (contato_id);
create index if not exists pigeon_conversas_inicio on pigeon_conversas (inicio);
create index if not exists pigeon_conversas_canal on pigeon_conversas (canal_id);

-- Os dois números da operação. É o que separa pré-venda de comercial.
insert into pigeon_canais (id, numero, papel, tipo) values
  ('f03f9fe5-d341-4479-ae70-edfe8face2f6', '47996265849', 'pre_venda', 'CLOUDAPI_WHATSAPP'),
  ('e3be742b-f287-41a3-9f8c-e4766ca43e59', '47997166873', 'comercial', 'ZAPI_WHATSAPP')
on conflict (id) do update set numero = excluded.numero, papel = excluded.papel, tipo = excluded.tipo;

insert into pigeon_sync_estado (recurso, desde) values
  ('contatos',  '2026-01-01T00:00:00Z'),
  ('conversas', '2026-08-25T00:00:00Z')
on conflict (recurso) do nothing;

alter table pigeon_canais      enable row level security;
alter table pigeon_contatos    enable row level security;
alter table pigeon_conversas   enable row level security;
alter table pigeon_sync_estado enable row level security;

create policy pigeon_canais_leitura on pigeon_canais
  for select to authenticated using (is_autorizado());
create policy pigeon_conversas_leitura on pigeon_conversas
  for select to authenticated using (is_autorizado());
create policy pigeon_estado_leitura on pigeon_sync_estado
  for select to authenticated using (is_admin());

grant select on pigeon_canais, pigeon_conversas to authenticated;
grant select (recurso, pagina, desde, total_api, gravados, concluido_em, erro, atualizado_em)
  on pigeon_sync_estado to authenticated;

-- pigeon_contatos fica sem política de leitura de propósito: guarda nome,
-- telefone e e-mail, e só as funções do painel chegam nele.

-- Carga e sincronismo a cada dez minutos.
select cron.schedule('pigeon-sync', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://raelmxfhzplsvipnthrd.supabase.co/functions/v1/pigeon-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-chave-painel',(select access_token from privado.credenciais where servico='cron')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);
