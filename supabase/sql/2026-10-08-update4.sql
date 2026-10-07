-- Update 4. O corpo de cada função está no banco; aqui fica o que mudou e por quê.

-- 1. Classificação de curso do lead, em cascata.
--    lead_curso(negociacao_id, produto_id, origem_regra) e classificar_leads(p_desde).
--    Ordem: campanha do CRM, anúncio do Pigeon, primeira mensagem do cliente.
--    O que não classifica fica com produto nulo e aparece como Sem classificação.
--    A regra de cada curso vem de produtos.regra_curso, a mesma que lê o nome do
--    curso na planilha, então é fonte única.

-- 2. painel_time_comercial(p_de, p_ate, p_produto)
--    Lead passa a ser filtrado por lead_curso, não pelo produto da venda. Filtrar
--    pelo produto da venda só pegava quem comprou e dava sempre 100% de conversão.
--    Conversão vira ganhas sobre ganhas mais perdidas mais em aberto.

-- 3. painel_parados(p_de, p_ate, p_trilha, p_produto)
--    painel_motivos_perda(p_de, p_ate, p_produto)
--    Passam a respeitar o curso filtrado. A separação Funil Principal contra SDR
--    continua pela trilha, como já era.

-- 4. painel_ritmo()
--    Média e necessário por dia passam a contar só dia útil. Sábado e domingo
--    somam pouco mais de três por cento das matrículas e diluíam o número.
--    Entra a coluna anteriores, com as matrículas lançadas antes do início da
--    campanha, que antes eram simplesmente descartadas.
--    Auxiliar: dias_uteis(p_de, p_ate).

-- 5. painel_origem_matriculas(p_campanha, p_por)
--    A matrícula só conta para a peça quando aconteceu depois da conversão nela e
--    dentro de sessenta dias. Entra matriculas_unicas: quem converteu só naquela
--    peça no período e comprou.

-- Versões antigas renomeadas com sufixo e sem permissão de execução:
-- painel_time_comercial_v2, painel_parados_v1, painel_motivos_perda_v1,
-- painel_ritmo_v2, painel_origem_matriculas_v2.
