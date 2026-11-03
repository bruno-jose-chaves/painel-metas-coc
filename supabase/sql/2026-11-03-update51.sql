-- Update 51 · 03/11/2026
-- Venda lancada com atraso deixa de sumir do resumo diario, e a aba de
-- performance ganha o quadro de horario.

-- 1. A VENDA RETARDATARIA
-- O resumo diario perguntava "data = hoje" na hora do envio, 20h. Entao perdia
-- dois casos, os dois para sempre, porque nenhum resumo volta atras: venda
-- lancada hoje com data de antes, e venda de hoje lancada depois das 20h.
--
-- O problema debaixo era pior: nao havia como saber o que era novo. A planilha
-- inteira e reenviada a cada 15 minutos e o gatilho subia atualizado_em em
-- todas as linhas, sempre. O banco nao tinha memoria de quando cada matricula
-- apareceu.
alter table vendas add column if not exists criado_em timestamptz not null default now();

-- Backfill: a linha antiga nao tem como saber quando entrou de verdade, entao
-- vale a data da venda, com piso no dia da primeira importacao do historico.
update vendas set criado_em = greatest(data::timestamptz, timestamptz '2026-09-30 13:24')
where criado_em >= date_trunc('day', now());

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

  -- So mexe em atualizado_em quando a linha muda de verdade. Senao nao haveria
  -- como separar o que entrou agora do que so passou pelo upsert de novo.
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

create or replace function vendas_retardatarias(p_dia date default null)
returns table (chave text, data date, nome text, curso text, vendedor text, valor_venda numeric,
               dias_de_atraso integer, entrou_em timestamptz, motivo text)
language sql stable security definer set search_path to 'public' as $f$
  -- A janela vai do envio de ontem (20h) ao envio de hoje (20h), que e
  -- exatamente o que o resumo de ontem ja nao pegou.
  with d as (select coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date) dia),
  janela as (
    select (((select dia from d) - 1)::timestamp + time '20:00') at time zone 'America/Sao_Paulo' de,
           (((select dia from d))::timestamp + time '20:00') at time zone 'America/Sao_Paulo' ate
  )
  select v.chave, v.data, v.nome, v.curso, v.vendedor, v.valor_venda,
         ((select dia from d) - v.data)::integer, v.criado_em,
         case when v.data < (select dia from d) then 'lancada com atraso' else 'data futura' end
  from vendas v, d, janela j
  where is_autorizado()
    and coalesce(lower(v.status), '') not like 'cancel%'
    and e_matricula(v.produto_id)
    and v.criado_em > j.de and v.criado_em <= j.ate
    and v.data <> d.dia
  order by v.data, v.nome;
$f$;
revoke all on function vendas_retardatarias(date) from public, anon;
grant execute on function vendas_retardatarias(date) to authenticated;

-- resumo_do_dia ganhou o bloco "Lancadas com atraso", logo antes de "A semana",
-- listando nome, curso, valor e de que dia era a venda. A edicao foi aplicada
-- em cima da definicao existente; o corpo completo esta no banco.

-- 2. O QUADRO DE HORARIO
-- Hora do dia contra dia da semana, seis medidas, uma por vez. Comparar duas e
-- o ponto: se o time manda mensagem as 9h e o cliente responde as 19h, o
-- esforco esta no horario errado; se a espera cresce justo quando o cliente
-- mais procura, falta gente naquela hora, nao falta esforco.
create or replace function painel_mapa_calor(p_de date default null, p_ate date default null,
                                            p_medida text default 'enviadas', p_vendedor text default null)
returns table (dia_semana integer, nome_dia text, hora integer, valor numeric, base bigint)
language sql stable security definer set search_path to 'public' as $f$
  with lim as (select coalesce(p_de, current_date - 90) de, coalesce(p_ate, current_date) ate),
  bruto as (
    select extract(dow from e.ocorrido_em at time zone 'America/Sao_Paulo')::int d,
           extract(hour from e.ocorrido_em at time zone 'America/Sao_Paulo')::int h, 1::numeric v
    from conversas_eventos e, lim
    where p_medida = 'enviadas' and e.evento = 'MESSAGE_SENT'
      and (e.ocorrido_em at time zone 'America/Sao_Paulo')::date between lim.de and lim.ate
      and (p_vendedor is null or exists (select 1 from vendedores vd
                                          where vd.nome = p_vendedor and e.atendente = any (vd.nomes_planilha)))
    union all
    select extract(dow from e.ocorrido_em at time zone 'America/Sao_Paulo')::int,
           extract(hour from e.ocorrido_em at time zone 'America/Sao_Paulo')::int, 1
    from conversas_eventos e
    join conversas_mv c on c.id = e.conversa_id, lim
    where p_medida = 'recebidas' and e.evento = 'MESSAGE_RECEIVED'
      and (e.ocorrido_em at time zone 'America/Sao_Paulo')::date between lim.de and lim.ate
      and (p_vendedor is null or exists (select 1 from vendedores vd
                                          where vd.nome = p_vendedor and c.atendente = any (vd.nomes_planilha)))
    union all
    select c.dia_semana, c.hora, 1
    from conversas_mv c, lim
    where p_medida = 'chamadas' and c.quem_comecou = 'Nós procuramos'
      and c.inicio_sp::date between lim.de and lim.ate
      and (p_vendedor is null or exists (select 1 from vendedores vd
                                          where vd.nome = p_vendedor and c.atendente = any (vd.nomes_planilha)))
    union all
    select c.dia_semana, c.hora, 1
    from conversas_mv c, lim
    where p_medida = 'procuraram' and c.quem_comecou = 'Cliente procurou'
      and c.inicio_sp::date between lim.de and lim.ate
      and (p_vendedor is null or exists (select 1 from vendedores vd
                                          where vd.nome = p_vendedor and c.atendente = any (vd.nomes_planilha)))
    union all
    -- A planilha guarda so a data da venda, entao a hora so existe pelo CRM.
    select extract(dow from n.fechado_em at time zone 'America/Sao_Paulo')::int,
           extract(hour from n.fechado_em at time zone 'America/Sao_Paulo')::int, 1
    from v_negociacoes n, lim
    where p_medida = 'ganhas' and n.status = 'ganha' and n.trilha = 'comercial'
      and (n.fechado_em at time zone 'America/Sao_Paulo')::date between lim.de and lim.ate
      and (p_vendedor is null or exists (select 1 from vendedores vd
                                          where vd.nome = p_vendedor
                                            and (n.responsavel = any (vd.nomes_planilha) or vd.nome = n.responsavel)))
    union all
    -- Aqui o valor nao e contagem: a tela tira a media, e por isso a base vem junto.
    select c.dia_semana, c.hora, c.espera_min
    from conversas_mv c, lim
    where p_medida = 'espera' and c.espera_min is not null
      and c.quem_comecou = 'Cliente procurou'
      and c.inicio_sp::date between lim.de and lim.ate
      and (p_vendedor is null or exists (select 1 from vendedores vd
                                          where vd.nome = p_vendedor and c.atendente = any (vd.nomes_planilha)))
  )
  select b.d, (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[b.d + 1],
         b.h,
         case when p_medida = 'espera' then round(avg(b.v), 1) else sum(b.v) end,
         count(*)
  from bruto b
  where is_autorizado()
  group by b.d, b.h
  order by b.d, b.h;
$f$;
revoke all on function painel_mapa_calor(date, date, text, text) from public, anon;
grant execute on function painel_mapa_calor(date, date, text, text) to authenticated;
