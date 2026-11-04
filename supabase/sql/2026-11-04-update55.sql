-- Update 55 · 04/11/2026
-- Matricula lancada depois do fim da campanha sumia da conta do curso.
--
-- A campanha termina quando o curso comeca, mas a prova e depois e o aluno
-- continua se matriculando. Como a regra so olhava para dentro da janela da
-- campanha, toda venda posterior ficava com campanha_id nulo e desaparecia do
-- cartao do curso, da projecao e do historico.
--
-- Tamanho do buraco no Metodo ACAFE 2o/2026, que encerrou em 26/10:
--   3 matriculas de 03 e 04/11, R$ 1.984,70, fora de qualquer campanha.
-- Depois do conserto a campanha passou de 236 para 239 alunos.
--
-- A regra de curso da campanha e que separa a turma: "acaf.*/\s*2" nao pega
-- venda de Acafe/1. O limite de 90 dias evita que venda de 2027 caia numa
-- campanha de 2026 que ninguem renovou.
create or replace function vendas_preparar()
returns trigger language plpgsql set search_path to '' as $f$
begin
  new.email_norm := nullif(lower(trim(new.email)), '');
  new.telefone_norm := public.norm_telefone(new.telefone);
  new.nome_norm := public.norm_nome(new.nome);
  new.resp_nome_norm := public.norm_nome(new.resp_financeiro);
  new.resp_telefone_norm := public.norm_telefone(substring(coalesce(new.resp_financeiro,'') from '[\d\s\(\)\-\+]{8,}'));
  select cp.produto_id into new.produto_id
    from public.curso_produto cp
   where cp.curso_norm = public.norm_curso(new.curso);
  if new.produto_id is null then
    select p.id into new.produto_id
      from public.produtos p
     where p.regra_curso is not null and new.curso ~* p.regra_curso
     order by p.ordem limit 1;
  end if;

  select c.id into new.campanha_id
    from public.campanhas c
   where c.produto_id = new.produto_id
     and new.data between coalesce(c.vendas_desde, c.inicio) and c.fim
     and (c.regra_curso is null or new.curso ~* c.regra_curso)
   order by c.inicio desc limit 1;

  if new.campanha_id is null then
    select c.id into new.campanha_id
      from public.campanhas c
     where c.produto_id = new.produto_id
       and new.data > c.fim and new.data <= c.fim + 90
       and (c.regra_curso is null or new.curso ~* c.regra_curso)
     order by c.fim desc limit 1;
  end if;

  if tg_op = 'UPDATE' then
    new.criado_em := old.criado_em;
    if (new.data, new.nome, new.curso, new.vendedor, new.status, new.valor_venda, new.valor_tabela,
        new.desconto_pct, new.desconto_valor, new.telefone, new.email, new.cidade, new.estado,
        new.resp_financeiro, new.material, new.obs)
       is not distinct from
       (old.data, old.nome, old.curso, old.vendedor, old.status, old.valor_venda, old.valor_tabela,
        old.desconto_pct, old.desconto_valor, old.telefone, old.email, old.cidade, old.estado,
        old.resp_financeiro, old.material, old.obs)
    then
      new.atualizado_em := old.atualizado_em;
      return new;
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end $f$;

-- Recalculo das linhas que ja estavam orfas.
update vendas v set campanha_id = (
  select c.id from campanhas c
   where c.produto_id = v.produto_id
     and v.data > c.fim and v.data <= c.fim + 90
     and (c.regra_curso is null or v.curso ~* c.regra_curso)
   order by c.fim desc limit 1)
where v.campanha_id is null
  and exists (select 1 from campanhas c
               where c.produto_id = v.produto_id
                 and v.data > c.fim and v.data <= c.fim + 90
                 and (c.regra_curso is null or v.curso ~* c.regra_curso));
