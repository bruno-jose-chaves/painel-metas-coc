-- Update 41 · 23/10/2026
-- O palpite do nome também vale na Passagem para o CRM.
--
-- A tela já sabia dizer "parece a campanha X", mas não dizia o curso, mesmo
-- sabendo: "mr" é material rico, "ufsc" é Missão UFSC, "reservas" é reserva.
-- Agora a sugestão vem completa e vira um clique só.
--
-- A função não podia mudar de assinatura no lugar, então a antiga virou _v2 e
-- a nova chama ela e acrescenta as três colunas do palpite.
alter function painel_passagem_crm(date, date) rename to painel_passagem_crm_v2;

create or replace function painel_passagem_crm(p_desde date default null, p_ate date default null)
returns table (identificador text, conversoes bigint, campanhas text[], pessoas_crm bigint, taxa numeric,
               situacao text, primeira date, ultima date, diagnostico text, sugestao text,
               sugestao_produto text, sugestao_produto_nome text, sugestao_indicador text)
language sql stable security definer set search_path to 'public', 'extensions' as $f$
  select v.*, s.produto_id, s.produto, s.indicador
  from painel_passagem_crm_v2(p_desde, p_ate) v
  left join lateral sugerir_regra(v.identificador) s on true;
$f$;

revoke all on function painel_passagem_crm(date, date) from public, anon;
revoke all on function painel_passagem_crm_v2(date, date) from public, anon;
grant execute on function painel_passagem_crm(date, date) to authenticated;
