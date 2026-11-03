-- Update 47 · 30/10/2026
-- O ranking abria vazio quando o vendedor tem apelido na planilha.
--
-- O ranking mostra o nome como ele está cadastrado ("Márcia Laurett", "João
-- Pedro Beraldo") e a planilha guarda o nome que o time digitou ("Márcia",
-- "João"). A lista de matrículas comparava os dois direto, então clicar em
-- quem tem apelido devolvia "nenhuma matrícula", mesmo com venda no período.
-- Agora o nome cadastrado vale por todos os apelidos dele, e "Venda
-- automática" encontra a linha sem vendedor.
create or replace function painel_vendas_detalhe(p_de date default null, p_ate date default null,
  p_produto text default null, p_vendedor text default null, p_campanha text default null,
  p_fase integer default null, p_limite integer default 300, p_turma text default null)
returns table (data date, aluno text, curso text, vendedor text, valor_tabela numeric,
               desconto numeric, valor_venda numeric, cidade text, turma text)
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  if not is_autorizado() then return; end if;
  return query
  select v.data, v.nome, v.curso, v.vendedor,
         v.valor_tabela,
         case when v.valor_tabela > 0 and v.valor_venda is not null
              then round(1 - v.valor_venda / v.valor_tabela, 4) end,
         v.valor_venda, v.cidade, t.nome
  from v_vendas_turma v
  left join turmas t on t.id = v.turma_id
  left join fases f on f.campanha_id = v.campanha_id and f.ordem = p_fase
  where coalesce(lower(v.status), '') not like 'cancel%' and e_matricula(v.produto_id)
    and (p_de is null or v.data >= p_de)
    and (p_ate is null or v.data <= p_ate)
    and (p_produto is null or v.produto_id = p_produto)
    and (p_vendedor is null
      or v.vendedor = p_vendedor
      or exists (select 1 from vendedores vd
                  where vd.nome = p_vendedor and v.vendedor = any (vd.nomes_planilha))
      or (p_vendedor = 'Venda automática' and v.vendedor is null))
    and (p_campanha is null or v.campanha_id = p_campanha)
    and (p_turma is null or v.turma_id = p_turma)
    and (p_fase is null or (f.id is not null and v.data between f.inicio and f.fim))
  order by v.data desc, v.nome
  limit greatest(1, least(p_limite, 1000));
end $f$;
revoke all on function painel_vendas_detalhe(date, date, text, text, text, integer, integer, text) from public, anon;
grant execute on function painel_vendas_detalhe(date, date, text, text, text, integer, integer, text) to authenticated;
