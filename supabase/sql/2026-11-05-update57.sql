-- Update 57 · 05/11/2026
-- Zero matricula orfa, busca por pessoa, e Meu painel com o relatorio
-- individual inteiro.

-- 1. ZERO MATRICULA ORFA
-- Eram 148 matriculas sem turma nenhuma, espalhadas por todos os anos. Tres
-- causas diferentes:
--
-- a) As janelas de venda das turmas nao cobrem o ano todo, entao venda
--    adiantada (Semi 2026/2 vendido em marco, antes da janela abrir) e venda
--    atrasada (Semi 2022/2 vendido em outubro, depois de fechar) nao tinham
--    casa. Agora, quando nenhuma janela pega, vale a turma do mesmo produto e
--    semestre cuja janela esta mais perto, com limite de um ano.
-- b) 44 matriculas da Preparacao Intensiva MED FURB (jan e fev/2026, R$ 25
--    mil) estavam no balaio "Outros" porque o produto nao existia.
-- c) 90 vendas de evento (Os segredos da Redacao, O X da questao, Cafe com teu
--    corretor, COC Aprova, COC Resolve) contavam como matricula, com ticket de
--    R$ 19 a R$ 38. Nao sao matricula: 2025 caiu de 1.069 para 1.003 alunos e
--    2021 de 782 para 758. O faturamento nao mudou.
create or replace function turma_da_venda(p_produto text, p_curso text, p_data date)
returns text language sql stable set search_path to 'public' as $f$
  select coalesce(
    (select t.id from turmas t
      where t.produto_id = p_produto
        and t.semestre is not distinct from semestre_do_curso(p_curso)
        and p_data between t.venda_de and t.venda_ate
      order by t.ano limit 1),
    (select t.id from turmas t
      where t.produto_id = p_produto
        and t.semestre is not distinct from semestre_do_curso(p_curso)
        and p_data between t.venda_de - 365 and t.venda_ate + 365
      order by least(abs(p_data - t.venda_de), abs(p_data - t.venda_ate)) limit 1),
    (select t.id from turmas t
      where t.produto_id = p_produto
        and p_data between t.venda_de and t.venda_ate
      order by t.ano limit 1)
  );
$f$;

insert into produtos (id, nome, ordem, conta_aluno, regra_curso) values
  ('med-furb', 'Preparação Intensiva MED FURB', 6, true, 'med\.?\s*furb'),
  ('evento',   'Eventos e mini cursos',        91, false, null)
on conflict (id) do update set nome = excluded.nome, ordem = excluded.ordem,
  conta_aluno = excluded.conta_aluno, regra_curso = excluded.regra_curso;

insert into curso_produto (curso, curso_norm, produto_id)
select distinct on (norm_curso(c)) c, norm_curso(c), p from (values
  ('Preparação Intensiva - MED. FURB', 'med-furb'),
  ('Os segredos da Redação', 'evento'), ('O X da questão', 'evento'),
  ('Café com teu corretor', 'evento'), ('Coc Aprova', 'evento'),
  ('Coc Aprova Med', 'evento'), ('COC Resolve', 'evento')
) t(c, p)
on conflict (curso_norm) do update set produto_id = excluded.produto_id;

insert into turmas (id, produto_id, ano, semestre, nome, venda_de, venda_ate, ativa) values
  ('med-furb-2026', 'med-furb', 2026, null, 'MED FURB 2026', '2025-11-01', '2026-06-30', true)
on conflict (id) do nothing;

-- 2. BUSCA POR PESSOA
-- Era a pergunta mais natural que existe e o painel nao respondia: quem e essa
-- pessoa e o que ja aconteceu com ela. Dependia de abrir a planilha, o CRM e o
-- WhatsApp e cruzar na cabeca.
create or replace function painel_pessoa_buscar(p_termo text, p_limite integer default 12)
returns table (chave text, nome text, telefone text, email text, cidade text,
               e_aluno boolean, cursos text, ultimo_contato date, dono text, conversas bigint)
language sql stable security definer set search_path to 'public' as $f$
  -- A chave e o telefone quando existe, porque e o unico campo que as tres
  -- fontes compartilham. Sem telefone, o nome normalizado segura.
  with t as (
    select nullif(btrim(p_termo), '') termo, norm_nome(p_termo) nome_n,
           nullif(regexp_replace(coalesce(p_termo, ''), '\D', '', 'g'), '') so_numero
  ),
  da_planilha as (
    select coalesce(v.telefone_norm, v.nome_norm) chave, v.nome, v.telefone_norm fone,
           v.email_norm mail, v.cidade, true aluno, v.curso, v.data, null::text dono
    from vendas v, t
    where coalesce(lower(v.status), '') not like 'cancel%'
      and ((t.nome_n <> '' and v.nome_norm like '%' || t.nome_n || '%')
        or (t.so_numero is not null and length(t.so_numero) >= 6
            and (v.telefone_norm like '%' || t.so_numero || '%' or v.resp_telefone_norm like '%' || t.so_numero || '%'))
        or (t.termo like '%@%' and v.email_norm = lower(t.termo)))
  ),
  do_crm as (
    select coalesce(n.contato_telefone_norm, norm_nome(n.contato_nome)) chave,
           n.contato_nome nome, n.contato_telefone_norm fone, n.contato_email_norm mail,
           null::text cidade, false aluno, null::text curso, null::date data, n.usuario_nome dono
    from rd_negociacoes n, t
    where ((t.nome_n <> '' and norm_nome(n.contato_nome) like '%' || t.nome_n || '%')
        or (t.so_numero is not null and length(t.so_numero) >= 6
            and n.contato_telefone_norm like '%' || t.so_numero || '%')
        or (t.termo like '%@%' and n.contato_email_norm = lower(t.termo)))
  ),
  do_whats as (
    select coalesce(p.telefone_norm, norm_nome(p.nome)) chave, p.nome, p.telefone_norm fone,
           p.email_norm mail, null::text cidade, false aluno, null::text curso,
           null::date data, null::text dono
    from pigeon_contatos p, t
    where ((t.nome_n <> '' and norm_nome(p.nome) like '%' || t.nome_n || '%')
        or (t.so_numero is not null and length(t.so_numero) >= 6 and p.telefone_norm like '%' || t.so_numero || '%'))
  ),
  junto as (select * from da_planilha union all select * from do_crm union all select * from do_whats),
  agrupado as (
    select j.chave, (array_agg(j.nome order by j.aluno desc, length(coalesce(j.nome, '')) desc))[1] nome,
           max(j.fone) fone, max(j.mail) mail, max(j.cidade) cidade, bool_or(j.aluno) aluno,
           nullif(string_agg(distinct j.curso, ' · '), '') cursos, max(j.data) data, max(j.dono) dono
    from junto j where j.chave is not null and j.chave <> '' group by j.chave
  )
  select a.chave, a.nome, a.fone, a.mail, a.cidade, a.aluno, a.cursos, a.data, a.dono,
         (select count(*) from conversas_mv c where c.telefone = a.fone)
  from agrupado a where is_autorizado()
  order by a.aluno desc, a.data desc nulls last, a.nome
  limit p_limite;
$f$;
revoke all on function painel_pessoa_buscar(text, integer) from public, anon;
grant execute on function painel_pessoa_buscar(text, integer) to authenticated;

create or replace function painel_pessoa_ficha(p_chave text)
returns table (bloco text, ordem integer, quando date, titulo text, detalhe text,
               valor numeric, link text, situacao text)
language sql stable security definer set search_path to 'public' as $f$
  -- A linha do tempo: o que ela comprou, o que o CRM registrou e o que
  -- aconteceu no WhatsApp, em ordem, com link para a conversa no Pigeon.
  with chave as (select p_chave k)
  select 'matricula', 1, v.data, v.curso,
         coalesce(v.vendedor, 'Venda automática') || coalesce(' · ' || t.nome, '') || coalesce(' · ' || v.cidade, ''),
         v.valor_venda, null::text,
         case when coalesce(lower(v.status), '') like 'cancel%' then 'cancelada' else 'ok' end
  from vendas v
  left join turmas t on t.id = turma_da_venda(v.produto_id, v.curso, v.data), chave
  where v.telefone_norm = chave.k or v.resp_telefone_norm = chave.k or v.nome_norm = chave.k
  union all
  select 'negociacao', 2, n.criado_em::date,
         coalesce(n.funil_nome, 'CRM') || ' · ' || coalesce(n.etapa_nome, 'sem etapa'),
         coalesce(n.usuario_nome, 'sem dono') || coalesce(' · ' || n.campanha_rd, '') || coalesce(' · ' || n.motivo_perda, ''),
         n.valor, null::text, n.status
  from rd_negociacoes n, chave
  where n.contato_telefone_norm = chave.k or norm_nome(n.contato_nome) = chave.k
  union all
  select 'conversa', 3, c.inicio_sp::date, c.canal || ' · ' || c.quem_comecou,
         coalesce(c.atendente, 'sem atendente')
           || case when c.respondeu then ' · respondeu' else ' · nunca respondeu' end
           || case when c.espera_min is not null then ' · esperou ' || round(c.espera_min)::text || ' min' else '' end,
         null::numeric, pcv.bruto->>'previewUrl',
         case when c.respondeu then 'ok' else 'mudo' end
  from conversas_mv c left join pigeon_conversas pcv on pcv.id = c.id, chave
  where c.telefone = chave.k
  union all
  select 'etiqueta', 4, (e.ocorrido_em at time zone 'America/Sao_Paulo')::date, 'Etiqueta no WhatsApp',
         coalesce((select string_agg(x, ', ') from jsonb_array_elements_text(
            coalesce((e.corpo -> 'content') -> 'tags', '[]'::jsonb)) t(x)), 'sem etiqueta'),
         null::numeric, null::text, null::text
  from conversas_eventos e, chave
  where e.evento = 'CONTACT_TAG_UPDATE' and e.telefone_norm = chave.k
  order by 3 desc nulls last, 2
  limit 200;
$f$;
revoke all on function painel_pessoa_ficha(text) from public, anon;
grant execute on function painel_pessoa_ficha(text) to authenticated;
