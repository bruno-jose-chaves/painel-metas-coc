-- Update 75: telefone no mesmo formato em todas as tabelas.
--
-- O formulário do RD chegava com o 55 na frente (e às vezes com o 55 duas vezes,
-- quando a pessoa digitava o 55 num campo que já tinha +55). Pigeon, CRM e vendas
-- guardam sem o código do país. Por isso nenhum lead de formulário cruzava com
-- conversa do Pigeon nem com venda pelo telefone.
--
-- A correção fica no banco: toda linha que entra é padronizada aqui, venha de
-- qual integração vier.

-- 1. Regra única de telefone: só dígitos, sem zero na frente, sem código do país
--    (repetido ou não), com o 9 do celular.
create or replace function public.norm_telefone(t text)
 returns text
 language plpgsql
 immutable
 set search_path to ''
as $function$
declare d text;
begin
  d := regexp_replace(coalesce(t, ''), '\D', '', 'g');
  d := regexp_replace(d, '^0+', '');
  while length(d) > 11 and left(d, 2) = '55' loop
    d := regexp_replace(substr(d, 3), '^0+', '');
  end loop;
  if length(d) = 10 and substr(d, 3, 1) in ('6', '7', '8', '9') then
    d := left(d, 2) || '9' || substr(d, 3);
  end if;
  if length(d) < 10 then return null; end if;
  return d;
end $function$;

-- 2. Padronização automática em toda entrada.
create or replace function public.padronizar_contato()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.telefone_norm := norm_telefone(new.telefone_norm);
  new.email_norm := nullif(lower(btrim(new.email_norm)), '');
  return new;
end $function$;

drop trigger if exists padronizar_contato on public.rd_conversoes;
create trigger padronizar_contato before insert or update of telefone_norm, email_norm
  on public.rd_conversoes for each row execute function public.padronizar_contato();

drop trigger if exists padronizar_contato on public.rd_contatos;
create trigger padronizar_contato before insert or update of telefone_norm, email_norm
  on public.rd_contatos for each row execute function public.padronizar_contato();

drop trigger if exists padronizar_contato on public.pigeon_contatos;
create trigger padronizar_contato before insert or update of telefone_norm, email_norm
  on public.pigeon_contatos for each row execute function public.padronizar_contato();

-- 3. Corrige o que já está gravado.
update public.rd_conversoes set telefone_norm = telefone_norm
 where telefone_norm is distinct from public.norm_telefone(telefone_norm);
update public.rd_contatos set telefone_norm = telefone_norm
 where telefone_norm is distinct from public.norm_telefone(telefone_norm);
update public.pigeon_contatos set telefone_norm = telefone_norm
 where telefone_norm is distinct from public.norm_telefone(telefone_norm);
update public.vendas set telefone_norm = public.norm_telefone(telefone_norm)
 where telefone_norm is distinct from public.norm_telefone(telefone_norm);

-- 4. Conferência: as quatro contagens devem dar zero.
select 'rd_conversoes' tabela, count(*) fora_do_padrao from public.rd_conversoes where telefone_norm is distinct from public.norm_telefone(telefone_norm)
union all select 'rd_contatos', count(*) from public.rd_contatos where telefone_norm is distinct from public.norm_telefone(telefone_norm)
union all select 'pigeon_contatos', count(*) from public.pigeon_contatos where telefone_norm is distinct from public.norm_telefone(telefone_norm)
union all select 'vendas', count(*) from public.vendas where telefone_norm is distinct from public.norm_telefone(telefone_norm);
