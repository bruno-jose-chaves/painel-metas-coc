-- Update 20 — Cursos e produtos: o fim das matrículas sem destino
-- Aplicado direto no banco em 15/10/2026. Este arquivo é o registro.

-- O problema: 1.052 matrículas, 19,6% do total e R$ 309.792, não pertenciam a
-- produto nenhum. Elas existiam nas contas globais e sumiam de qualquer tela
-- filtrada por curso, o que é a pior combinação possível.
-- A causa é que o destino era resolvido só por expressão sobre o nome do curso,
-- e nome de curso na planilha varia: "Coc Aprova Med" e "COC APROVA MED" eram
-- dois cursos diferentes para o banco.

-- 1. produtos.conta_aluno (boolean, default true)
--    Falso para o que é venda mas não é matrícula. Hoje só material avulso.

-- 2. Três produtos novos
--    prep-enem  Preparação ENEM     824 vendas, R$ 262.491, 2021 a 2024
--    material   Material avulso      94 vendas, R$  20.326, conta_aluno = false
--    outros     Outros              134 vendas, R$  26.975
--    O ENEM é produto de verdade, com quatro variantes de nome, e volta a ser
--    vendido este ano. Ano sem venda não aparece nas telas daquele ano, mas o
--    histórico fica.
--    O MED FURB entra em Outros por decisão do Bruno: foi oferta de uma vez só,
--    não se repete todo ano, e virar produto próprio sujaria o portfólio.

-- 3. norm_curso(texto)
--    Caixa, acento e espaço repetido fora. É a chave do de-para.

-- 4. curso_produto (curso_norm, curso, produto_id, criado_em, criado_por)
--    De-para manual. Apontado uma vez, fica apontado.

-- 5. vendas_preparar() alterada
--    O de-para manual passou a ser consultado ANTES da expressão. Manual ganha
--    da regra, sempre. Depois do backfill: zero matrículas sem produto.

-- 6. e_matricula(produto) e o filtro nas contagens
--    Material virou produto, e produto aparece em tela filtrada. Sem o filtro,
--    43 vendas de apostila em 2026 entrariam como aluno.
--    Aplicado em painel_vendas_periodo, painel_time_comercial,
--    painel_vendas_detalhe, resumo_do_dia e painel_apv_dia.
--    As funções de campanha não precisaram: material não tem campanha_id.
--    painel_resumo_periodo também não: ela já filtra campanha_id not null.

-- 7. painel_cursos() e apontar_curso(curso, produto)
--    A tela de Ajustes > Cursos e produtos. Lista todo nome de curso com para
--    onde vai e por qual caminho (apontado na mão, pela regra, sem destino), e
--    deixa a diretoria trocar o destino, o que reclassifica na hora.
--    "Outros" não é balde: cada nome continua discriminado, com quantos e
--    quanto, que era o pedido.
