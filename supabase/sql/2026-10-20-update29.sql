-- Update 29 — Qualidade do lead ganha filtros, e o cruzamento de conversa vira
-- fonte única.
--
-- O que mudou de verdade: a conversa passou a ter telefone em 67% de setembro e
-- 87% de outubro, contra 4% antes. O Pigeon guarda o número no título da
-- conversa quando o contato não tem nome salvo, e ninguém estava lendo isso.
-- Com isso a conversão por canal deixa de ser só de outubro.
--
-- Casar pelo NOME do título foi testado e descartado. Recuperava 2,7% a mais e
-- introduzia um viés que inverteria a conclusão: só casaria com quem está na
-- planilha de vendas, ou seja, só com quem comprou, e a conversão subiria
-- sozinha por construção.

-- canais_whats / atendentes_whats — nome de gente e de canal no lugar de uuid.

-- conversas_resolvidas (view) + conversas_mv (materializada, cron a cada 10 min)
-- Quatro telas montavam o mesmo cruzamento por conta própria, cada uma com um
-- recorte um pouco diferente, e foi assim que o telefone errado passou meses
-- sem ninguém ver. Agora o cruzamento mora num lugar só.
-- A materialização não é luxo: pela view a tela levava 4,3 s, porque o curso
-- sai de uma varredura do JSON de 23 mil eventos. Materializada, 160 ms.

-- painel_qualidade_lead(de, ate, atendente, turma, so_dia_util, so_horario_comercial)
-- Fim de semana e madrugada entram ou saem por escolha, não por regra fixa: o
-- comercial não é cobrado por atender sábado, então deixar sábado na média
-- estraga a média, mas sumir com ele esconde que gente ficou esperando.

-- painel_espera_atendimento(de, ate, atendente, turma)
-- Ignora de propósito os filtros de dia e hora, e mostra sempre a semana
-- inteira, porque é ela que revela o buraco do fim de semana. Ganhou a coluna
-- de conversa que nunca recebeu resposta nenhuma.

-- painel_filtros_conversa(de, ate) — as opções dos seletores, com volume.

-- PENDENTE DE LIMPEZA: ficaram no banco duas funções sem uso,
-- painel_qualidade_lead(date,date) e painel_qualidade_lead_v2(...). A ferramenta
-- de administração recusa DROP por proteção contra comando destrutivo. Rodar à
-- mão no SQL editor do Supabase:
--   drop function if exists public.painel_qualidade_lead(date, date);
--   drop function if exists public.painel_qualidade_lead_v2(date,date,text,text,boolean,boolean);
