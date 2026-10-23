-- Update 39 · 23/10/2026
-- O número vira gente, e a conversa fica a um clique.
--
-- "134 pessoas chegaram por esta peça" não diz quem, e sem quem ninguém faz
-- nada com o número. O Pigeon já guarda um link direto para cada conversa
-- (previewUrl), então dá para ir da peça até a conversa sem sair do painel.

create or replace function painel_anuncio_pessoas(p_anuncio text, p_de date, p_ate date, p_limite int default 200)
returns table (pessoa text, telefone text, quando date, conversas bigint, atendente text,
               primeira_mensagem text, virou_matricula boolean, curso text, link text)
language sql stable security definer set search_path to 'public' as $f$
  with conv as (
    select pcv.id, pcv.contato_id, pct.telefone_norm, pct.nome, pcv.inicio::date as dia,
           pcv.usuario_id, pcv.primeira_mensagem_cliente,
           pcv.bruto->>'previewUrl' as link,
           coalesce(nullif(btrim(pcv.bruto#>>'{utm,campaign}'), ''),
                    nullif(btrim(pct.bruto#>>'{utm,campaign}'), '')) as anuncio
    from pigeon_conversas pcv
    join pigeon_contatos pct on pct.id = pcv.contato_id
    where is_autorizado() and pcv.inicio::date between p_de and p_ate
  ),
  f as (select * from conv where anuncio = p_anuncio)
  select coalesce(max(f.nome), '(sem nome)') as pessoa,
         f.telefone_norm as telefone,
         min(f.dia) as quando,
         count(*)::bigint as conversas,
         max(coalesce(a.nome, f.usuario_id)) as atendente,
         (array_agg(f.primeira_mensagem_cliente order by f.dia)
            filter (where f.primeira_mensagem_cliente is not null))[1] as primeira_mensagem,
         exists (
           select 1 from vendas v
           where v.telefone_norm = f.telefone_norm
             and coalesce(lower(v.status), '') not like 'cancel%'
             and v.data >= min(f.dia)
         ) as virou_matricula,
         (select v.curso from vendas v
          where v.telefone_norm = f.telefone_norm
            and coalesce(lower(v.status), '') not like 'cancel%'
            and v.data >= min(f.dia)
          order by v.data limit 1) as curso,
         (array_agg(f.link order by f.dia desc) filter (where f.link is not null))[1] as link
  from f
  left join atendentes_whats a on a.id = f.usuario_id
  where f.telefone_norm is not null
  group by f.telefone_norm
  order by min(f.dia) desc
  limit p_limite;
$f$;

-- Em "A classificar", a campanha do CRM abre quem entrou por ela, e a página
-- de formulário abre quem converteu nela. A conversa do Pigeon entra quando o
-- telefone bate.
create or replace function painel_pendencia_pessoas(p_tipo text, p_valor text, p_desde date, p_limite int default 200)
returns table (pessoa text, telefone text, email text, quando date, onde text,
               virou_matricula boolean, link text)
language sql stable security definer set search_path to 'public' as $f$
  with base as (
    select coalesce(c.nome, '(sem nome)') as pessoa,
           c.telefone_norm as telefone, c.email_norm as email,
           n.criado_em::date as quando,
           coalesce(n.funil_nome, 'CRM') || ' · ' || coalesce(n.etapa_nome, 'sem etapa') as onde
    from rd_negociacoes n
    left join rd_contatos c on c.id = n.contato_id
    where p_tipo = 'campanha_crm'
      and n.criado_em::date >= p_desde
      and btrim(coalesce(n.campanha_rd, '')) = btrim(p_valor)
    union all
    select coalesce(rc.nome, '(sem nome)'), rc.telefone_norm, rc.email_norm,
           rc.convertido_em::date, 'Formulário do RD'
    from rd_conversoes rc
    where p_tipo = 'formulario'
      and rc.convertido_em::date >= p_desde
      and rc.identificador = p_valor
  )
  select b.pessoa, b.telefone, b.email, b.quando, b.onde,
         exists (select 1 from vendas v
                  where coalesce(lower(v.status), '') not like 'cancel%'
                    and ((b.telefone is not null and v.telefone_norm = b.telefone)
                      or (b.email is not null and v.email_norm = b.email))
                    and v.data >= b.quando) as virou_matricula,
         (select pcv.bruto->>'previewUrl' from pigeon_conversas pcv
           join pigeon_contatos pct on pct.id = pcv.contato_id
          where b.telefone is not null and pct.telefone_norm = b.telefone
          order by pcv.inicio desc limit 1) as link
  from base b
  where is_autorizado()
  order by b.quando desc
  limit p_limite;
$f$;

revoke all on function painel_anuncio_pessoas(text, date, date, int) from public, anon;
revoke all on function painel_pendencia_pessoas(text, text, date, int) from public, anon;
grant execute on function painel_anuncio_pessoas(text, date, date, int) to authenticated;
grant execute on function painel_pendencia_pessoas(text, text, date, int) to authenticated;
