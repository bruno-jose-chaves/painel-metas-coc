-- update 68 - 11/11/2026
-- O resumo diario do WhatsApp parou de chegar, e a tarja nao dizia por que.
--
-- O ultimo resumo que chegou foi na noite de 09/11. O de 10/11 saiu do banco
-- normal: o texto foi gerado (630 caracteres), o POST foi disparado para o
-- webhook do n8n e a rotina do cron marcou "succeeded", porque do ponto de
-- vista do Postgres a requisicao foi entregue. O n8n e que respondeu 400:
--
--     {"code":0,"message":"Unrecognized node type: n8n-nodes-wts.wtsChat"}
--
-- Ou seja, o fluxo do n8n perdeu o node da WTS Chat, que e quem fala com o
-- WhatsApp. Problema do lado do n8n, nao do painel. A correcao e reinstalar o
-- pacote de node da comunidade no n8n.
--
-- O que ficou claro e que a vigilancia enxergava o sintoma e jogava fora a
-- causa. A funcao de conferencia lia status_code e error_msg, devolvia num jsonb
-- que ninguem guardava, e a tarja da saude das fontes so sabia dizer que o
-- resumo estava atrasado. A informacao que resolve o caso em um minuto estava
-- na resposta HTTP, e o pg_net apaga essas respostas depois de algumas horas.
--
-- Agora o motivo e gravado no momento da conferencia e aparece na tarja.

-- 1. Onde guardar
alter table privado.resumo_entrega add column if not exists ultimo_status integer;
alter table privado.resumo_entrega add column if not exists ultimo_erro text;

-- 2. A conferencia passa a gravar. Em sucesso limpa o erro; em falha guarda o
--    status e junta error_msg com content, porque a mensagem util do n8n vem no
--    corpo da resposta, nao no campo de erro do pg_net.
create or replace function public.conferir_resumo_whats()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare cfg record; r record; motivo text;
begin
  select * into cfg from privado.resumo_entrega where id = 1;
  if cfg.ultima_requisicao is null then
    return jsonb_build_object('ok', false, 'erro', 'nenhum envio registrado');
  end if;

  select status_code, error_msg, content into r
    from net._http_response where id = cfg.ultima_requisicao;

  if r.status_code between 200 and 299 then
    perform marcar_sync('resumo_diario');
    update privado.resumo_entrega
       set ultimo_status = r.status_code, ultimo_erro = null where id = 1;
    return jsonb_build_object('ok', true, 'status', r.status_code);
  end if;

  motivo := nullif(btrim(coalesce(r.error_msg, '') || ' ' || coalesce(r.content, '')), '');
  update privado.resumo_entrega
     set ultimo_status = coalesce(r.status_code, 0), ultimo_erro = motivo where id = 1;
  return jsonb_build_object('ok', false, 'status', r.status_code, 'erro', motivo);
end $function$;
revoke all on function public.conferir_resumo_whats() from public, anon, authenticated;

-- 3. A tarja passa a mostrar o motivo. Na linha "Resumo diario no WhatsApp" da
--    saude das fontes, o campo detalhe era sempre nulo. Agora, quando o ultimo
--    status gravado nao e 2xx, ele traz o que o n8n respondeu.
--
--    O trecho alterado dentro de painel_saude_fontes_aberto, na CTE tudo:
--
--        c.limite, null::text as erro, c.ordem
--
--    virou:
--
--        c.limite,
--        case when c.fonte = 'Resumo diário no WhatsApp' then
--          (select case when r.ultimo_status is not null
--                        and r.ultimo_status not between 200 and 299
--                  then 'O n8n respondeu ' || r.ultimo_status || ': ' ||
--                       left(coalesce(r.ultimo_erro, 'sem mensagem'), 160) end
--           from privado.resumo_entrega r where r.id = 1)
--        end as erro,
--        c.ordem
--
--    A alteracao foi aplicada por bloco DO que le pg_get_functiondef e troca o
--    trecho, para nao redigitar a funcao inteira. O resto dela nao mudou.
do $corpo$
declare def text; novo text;
  de text := E'         c.limite, null::text as erro, c.ordem\n  from cargas c, agora a';
  para text := E'         c.limite,\n         case when c.fonte = ''Resumo diário no WhatsApp'' then\n           (select case when r.ultimo_status is not null\n                         and r.ultimo_status not between 200 and 299\n                   then ''O n8n respondeu '' || r.ultimo_status || '': '' ||\n                        left(coalesce(r.ultimo_erro, ''sem mensagem''), 160) end\n            from privado.resumo_entrega r where r.id = 1)\n         end as erro,\n         c.ordem\n  from cargas c, agora a';
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'painel_saude_fontes_aberto';
  if position(de in def) = 0 then raise exception 'trecho nao encontrado'; end if;
  novo := replace(def, de, para);
  execute novo;
  execute 'revoke all on function public.painel_saude_fontes_aberto() from public, anon, authenticated';
end $corpo$;

-- Resultado na tarja, conferido em 11/11:
--   Resumo diario no WhatsApp | fora | 2195 min de atraso
--   O n8n respondeu 400: {"code":0,"message":"Unrecognized node type: n8n-nodes-wts.wtsChat"}
--
-- O resumo de 10/11 foi reenviado a mao para conferir o diagnostico, e falhou
-- com o mesmo erro. Vai voltar a chegar sozinho na primeira noite depois que o
-- node for reinstalado no n8n, sem precisar mexer no painel.
