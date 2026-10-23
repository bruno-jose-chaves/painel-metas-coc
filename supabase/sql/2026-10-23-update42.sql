-- Update 42 · 23/10/2026
-- Dois degraus novos na classificação de curso, e os dois saíram de dado que já
-- estava guardado e ninguém usava.
--
-- 1. A ETIQUETA DO PIGEON. A etiqueta não fica no contato, porque o comercial
--    põe e tira na mesma hora: ela serve de gatilho para mover o card no CRM.
--    Só que o evento da troca fica guardado, e é nele que está escrito o curso,
--    com todas as letras: "MISSÃO UFSC - 2026", "MÉTODO ACAFE/2 - 2026",
--    "SEMI/1 - 2027", "EXTENSIVO - 2027". São 877 pessoas com curso declarado
--    que o painel estava ignorando.
--
-- 2. O QUE A PESSOA COMPROU. Último recurso, e só vale para quem fechou: se o
--    lead virou matrícula, o curso é o que ela comprou. Não resolve lead em
--    aberto, resolve buraco no histórico.
--
-- Resultado na primeira corrida: 138 leads pela etiqueta do Pigeon e 302 pela
-- compra, e "sem classificação" caiu de 3.239 para 2.799.

create or replace view etiquetas_pigeon_curso as
select e.telefone_norm, p.id as produto_id, max(e.ocorrido_em) as quando
from conversas_eventos e
cross join lateral jsonb_array_elements_text(coalesce(e.corpo#>'{content,tags}', '[]'::jsonb)) t
join produtos p on p.regra_curso is not null and t ~* p.regra_curso
where e.evento = 'CONTACT_TAG_UPDATE' and e.telefone_norm is not null
group by 1, 2;

revoke all on etiquetas_pigeon_curso from anon, authenticated;

-- A função ganhou duas colunas de contagem, então a antiga virou _v2. O corpo
-- completo da nova está no banco; o que muda em relação à anterior são os dois
-- lateral joins pt (etiqueta do Pigeon) e pv (compra), nessa ordem, depois de
-- todos os degraus que já existiam.
alter function classificar_leads(date) rename to classificar_leads_v2;

-- A nova mantém os seis degraus anteriores e acrescenta dois no fim da cascata.
-- Os trechos novos são só estes dois lateral joins, colocados depois de pm:
--
--   left join lateral (
--     select ec.produto_id as id from etiquetas_pigeon_curso ec
--     where pr.id is null and pf.id is null and pc.id is null and pe.id is null
--       and pa.id is null and pm.id is null
--       and ct.telefone_norm is not null and ec.telefone_norm = ct.telefone_norm
--     order by ec.quando desc limit 1
--   ) pt on true
--   left join lateral (
--     select v.produto_id as id from vendas v
--     where pr.id is null and pf.id is null and pc.id is null and pe.id is null
--       and pa.id is null and pm.id is null and pt.id is null
--       and coalesce(lower(v.status), '') not like 'cancel%' and v.produto_id is not null
--       and ((ct.telefone_norm is not null and v.telefone_norm = ct.telefone_norm)
--         or (ct.email_norm is not null and v.email_norm = ct.email_norm))
--       and v.data >= n.criado_em::date
--     order by v.data limit 1
--   ) pv on true
--
-- mais 'etiqueta_pigeon' e 'compra' no case da origem, no coalesce do produto e
-- nas duas colunas novas de contagem. O corpo inteiro, como está rodando, sai
-- com: select pg_get_functiondef('classificar_leads(date)'::regprocedure);

revoke all on function classificar_leads(date) from public, anon;
revoke all on function classificar_leads_v2(date) from public, anon;
