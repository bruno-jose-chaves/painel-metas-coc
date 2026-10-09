-- Update 15 — Ritmo honesto, meta ajustada por fase, regra por curso,
--             estrela por pessoa, gráfico diário e detalhe clicável
-- Aplicado direto no banco em 09/10/2026. Este arquivo é o registro.

-- 1. O cartão de Ritmo dizia o contrário do que acontecia
--    Ele comparava "precisa 3,24 por dia" com "hoje está em 4,62 por dia" e
--    parecia folga. Os dois números não se comparam:
--      3,24  = o que falta dividido por DIA CORRIDO, domingo incluído
--      4,62  = média da campanha INTEIRA, com o pico de lançamento dentro
--    A leitura certa já existia em painel_ritmo() e não estava sendo usada:
--      necessario_dia      5,00 por dia útil
--      media_7             3,20 por dia nas últimas semanas
--      projecao_restante   35 alunos no que sobra de campanha
--      falta               55 alunos
--    Ou seja, o buraco é de 20 alunos. O cartão passou a mostrar isso.

-- 2. painel_fases ganhou meta ajustada
--      saldo_anterior = soma de (alunos - meta) de todas as fases anteriores
--      meta_ajustada  = meta da fase - saldo_anterior
--      falta_na_fase  = meta_ajustada - alunos
--    Só para fase em curso e futura: ajustar meta de fase encerrada é
--    reescrever o passado. Se toda fase bater a ajustada, a campanha fecha
--    exatamente na meta.
--    ACAFE 2026/2: a fase Pós-live tem meta 36 e ajustada 44, porque as três
--    anteriores juntas ficaram 8 abaixo, já descontado o superávit de 60 que
--    veio de antes da campanha.

-- 3. Regra de captação aponta para CURSO, e o ano se resolve sozinho
--    captacao_regras ganhou produto_id. Antes a regra precisava de campanha ou
--    turma, e envelhecia: "material rico do ACAFE" é verdade todo ano, mas a
--    turma muda, e alguém teria que repontar em janeiro. Apontando para o
--    produto, a data do lead decide a turma e a campanha.
--    produtos.regra_nome: padrão para ler o nome do formulário ou da campanha,
--    sem a exclusão de "material" que existe em regra_curso.
--    sugerir_regra(valor): palpite de curso e indicador lendo o nome.
--      ago-2025-material-rico-simulado-ufsc  -> Missão UFSC, material rico
--      [AGO/2025] MÉTODO ACAFE - MATERIAL RICO -> Método ACAFE, material rico
--      inscricoes-prevest-26-2               -> sem palpite
--    painel_pendencias devolve o palpite, e a tela tem um botão para aceitar
--    todos de uma vez, mostrando antes o que vai criar.

-- 4. Estrela por pessoa
--    usuarios_autorizados.vendedor_id liga a conta ao vendedor.
--    painel_insights passou a devolver `para text[]` e filtra no banco: quem é
--    do comercial vê o que é dele mais o que é de todo o time; a diretoria vê
--    tudo. Novo gerador:
--      lead_quente_pre_venda — lead com 3 ou mais mensagens nos últimos 7 dias
--      parado no funil do Agente de Pré-vendas. Se a pessoa já foi de alguém do
--      comercial, volta para quem já falou com ela; se não foi de ninguém, vira
--      sugestão para o time inteiro.

-- 5. Filtro que valia só para parte da página
--    painel_pre_venda não aceitava curso, então o bloco do Agente de Pré-vendas
--    era o único que ignorava o filtro no Time Comercial e na Captação.
--    Agora aceita. O curso de um lead de pré-vendas vem do contato, porque a
--    negociação do funil SDR não é classificada (curso_do_contato).

-- 6. painel_vendas_periodo(de, ate, produto)
--    Matrícula por dia no período e no curso, para o gráfico do Comercial.

-- 7. painel_vendas_detalhe(de, ate, produto, vendedor, campanha, fase, limite)
--    Drill-down: qualquer número agregado passa o mesmo recorte e recebe as
--    matrículas uma a uma. Ligado no ranking de vendedores e na escada de fases.
