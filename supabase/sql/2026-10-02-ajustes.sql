-- Ajustes aplicados em 02/10/2026.

-- 1. O período de venda termina uma semana depois do início das aulas.
update campanhas set fim = '2026-10-26' where id = 'acafe-2026-2';
update campanhas set fim = '2026-11-09' where id = 'ufsc-2026';
update fases set fim = '2026-10-26' where campanha_id = 'acafe-2026-2' and ordem = 6;
update fases set fim = '2026-11-09' where campanha_id = 'ufsc-2026' and ordem = 6;

-- 2. Segurança: a view volta a respeitar as políticas do usuário que consulta,
--    o cruzamento sai da API pública e as funções ganham search_path fixo.
alter view v_negociacoes set (security_invoker = true);
revoke execute on function cruzar_vendas(date) from anon, authenticated, public;
alter function painel_fontes(date,date) set search_path = public;
alter function painel_parados(date,date,text) set search_path = public;
alter function painel_motivos_perda(date,date) set search_path = public;
alter function painel_fases(text) set search_path = public;
alter function painel_vendas_dia(text) set search_path = public;
alter function painel_time_comercial(date,date) set search_path = public;
alter function painel_referencia(text) set search_path = public;
alter function painel_projecao(text) set search_path = public;
alter function painel_curva(text) set search_path = public;
alter function painel_cenarios(text) set search_path = public;
alter function painel_ritmo() set search_path = public;
alter function painel_origem_matriculas(text) set search_path = public;
alter function painel_funil(text) set search_path = public;
alter function painel_pre_venda(date,date) set search_path = public;
alter function painel_leads_dia(date,date) set search_path = public;
alter function painel_leads_origem(date,date) set search_path = public;

-- 3. Pendência: remover as funções antigas quando houver acesso direto ao banco.
--    drop function painel_pre_venda_v1(date,date);
--    drop function painel_leads_dia_v1(date,date);
--    drop function _teste_plpgsql();
