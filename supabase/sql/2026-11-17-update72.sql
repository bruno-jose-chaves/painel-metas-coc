-- Update 72: salvar campanha numa transacao so (Raio-X B10).
--
-- O cadastro gravava em quatro chamadas: campanha, metas, apagar a escada de
-- precos e inserir a escada nova. Se a ultima falhasse, a campanha ficava sem
-- preco nenhum. Agora tudo roda dentro de uma funcao, que e uma transacao:
-- qualquer linha invalida desfaz o conjunto inteiro.
--
-- security invoker: as politicas "admin altera/insere" de campanhas, metas e
-- fases continuam valendo, e a funcao ainda confere is_admin() de forma explicita.
create or replace function public.salvar_campanha(p_campanha jsonb, p_metas jsonb, p_fases jsonb)
 returns text
 language plpgsql
 security invoker
 set search_path to 'public'
as $function$
declare
  cid text := btrim(p_campanha ->> 'id');
begin
  if not is_admin() then
    raise exception 'só administrador salva campanha';
  end if;
  if cid is null or cid = '' then
    raise exception 'campanha sem código';
  end if;

  insert into campanhas (id, produto_id, nome, inicio, fim, meta_ativa, mercado_candidatos,
                         referencia_ano_anterior, marcos, ativa, vendas_desde, regra_curso)
  select cid, r.produto_id, r.nome, r.inicio, r.fim, coalesce(r.meta_ativa, 2), r.mercado_candidatos,
         r.referencia_ano_anterior, coalesce(r.marcos, '[]'::jsonb), coalesce(r.ativa, true),
         r.vendas_desde, nullif(btrim(r.regra_curso), '')
  from jsonb_populate_record(null::campanhas, p_campanha) r
  on conflict (id) do update set
    produto_id = excluded.produto_id,
    nome = excluded.nome,
    inicio = excluded.inicio,
    fim = excluded.fim,
    meta_ativa = excluded.meta_ativa,
    mercado_candidatos = excluded.mercado_candidatos,
    referencia_ano_anterior = case when p_campanha ? 'referencia_ano_anterior'
                                   then excluded.referencia_ano_anterior else campanhas.referencia_ano_anterior end,
    marcos = case when p_campanha ? 'marcos' then excluded.marcos else campanhas.marcos end,
    ativa = excluded.ativa,
    vendas_desde = excluded.vendas_desde,
    regra_curso = excluded.regra_curso;

  insert into metas (campanha_id, nivel, faturamento, alunos)
  select cid, m.nivel, coalesce(m.faturamento, 0), coalesce(m.alunos, 0)
  from jsonb_to_recordset(coalesce(p_metas, '[]'::jsonb)) as m(nivel int, faturamento numeric, alunos int)
  on conflict (campanha_id, nivel) do update set
    faturamento = excluded.faturamento, alunos = excluded.alunos;

  delete from fases where campanha_id = cid;
  insert into fases (campanha_id, ordem, nome, inicio, fim, preco, meta_alunos, bonus)
  select cid, f.ord::int, f.nome, f.inicio, f.fim, f.preco, f.meta_alunos, nullif(btrim(f.bonus), '')
  from rows from (jsonb_to_recordset(coalesce(p_fases, '[]'::jsonb))
         as (nome text, inicio date, fim date, preco numeric, meta_alunos int, bonus text))
       with ordinality as f(nome, inicio, fim, preco, meta_alunos, bonus, ord);

  return 'ok';
end;
$function$;

revoke execute on function public.salvar_campanha(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_campanha(jsonb, jsonb, jsonb) to authenticated, service_role;
