-- Update 43 · 26/10/2026
-- A fila ganha janela, o dono vem também da etiqueta do Pigeon, e o resumo das
-- 20h para de avisar sobre dado desatualizado.

-- 1. O DONO, PELA ETIQUETA. No Pigeon o dono do contato também é etiqueta:
-- "MÁRCIA - 67F3BBD418D12700144C2302". Como toda etiqueta de lá, ela é posta e
-- tirada na hora, mas o evento da troca fica guardado. São 575 contatos da
-- Márcia e 349 do João que o painel não sabia de quem eram quando não existia
-- card no CRM.
create or replace view donos_pigeon_etiqueta as
select e.telefone_norm,
       initcap(lower(btrim(split_part(t, ' - ', 1)))) as dono,
       max(e.ocorrido_em) as quando
from conversas_eventos e
cross join lateral jsonb_array_elements_text(coalesce(e.corpo#>'{content,tags}', '[]'::jsonb)) t
where e.evento = 'CONTACT_TAG_UPDATE'
  and e.telefone_norm is not null
  and t ~ ' - [0-9A-Fa-f]{16,}$'
group by 1, 2;

revoke all on donos_pigeon_etiqueta from anon, authenticated;

-- 2. A JANELA DA FILA, que é decisão do Bruno: negociação parada entra a partir
-- de 15 dias, que é quando vale avisar, e sai aos 90, porque acima disso não
-- vale cobrar. O que passou de 90 vira um tipo próprio, fora da fila e contado,
-- para o tamanho do problema não sumir da tela.
-- (corpo de painel_escapando e painel_escapando_resumo aplicado no banco;
--  as mudanças são as janelas "between 8 and 90" e "between 15 and 90", o tipo
--  novo "Parado há mais de 90 dias" e o coalesce do dono passando pela view
--  donos_pigeon_etiqueta)

-- 3. O RESUMO DAS 20h não abre mais com "Atenção: dado desatualizado". A tarja
-- disso já existe no painel, e no WhatsApp ela só empurrava o número para baixo.
do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'resumo_do_dia';
  d := replace(d, '  if v_fora is not null then
    t := t || ''*Atenção: dado desatualizado.* Sem atualização de: '' || v_fora
         || ''. Os números abaixo podem estar velhos.'' || E''\n\n'';
  end if;

', '');
  execute d;
end $do$;
revoke all on function resumo_do_dia(date) from public, anon;

-- 4. O ENVIO AUTOMÁTICO DA FILA SAI DO AR enquanto o texto da mensagem não
-- estiver bom. As funções e a tela continuam: só o agendamento some.
select cron.unschedule('fila-manha');
