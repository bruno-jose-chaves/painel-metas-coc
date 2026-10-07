-- Correções do Update 3. O registro completo de cada função está no banco; aqui
-- fica o que mudou e por quê.

-- 1. Curso vira filtro de verdade no Time comercial.
--    Antes a campanha só mexia na data, então a tabela somava venda de todos os
--    cursos dentro da janela da campanha.
--    painel_time_comercial(p_de, p_ate, p_produto default null)

-- 2. Da origem à matrícula passa a ler a campanha do CRM.
--    A fonte diz o canal, mas não diz qual peça trouxe o lead.
--    painel_origem_matriculas(p_campanha, p_por default 'campanha')

-- 3. Pré-vendas separa captação de resultado.
--    Captado é quem entrou no SDR no período. Matrícula é a venda fechada no
--    período de quem passou pelo SDR a qualquer momento, inclusive antes, que é
--    o caso da reserva feita na campanha anterior. A coluna ganhos_de_antes
--    mostra quanto do resultado veio desse passado.
--    painel_pre_venda(p_de, p_ate) -> ..., ganhos, ganhos_de_antes, ...

-- 4. Canal de Instagram e Messenger passa a se chamar redes sociais.
update pigeon_canais set papel = 'redes_sociais' where papel = 'outro';
alter table pigeon_canais alter column papel set default 'redes_sociais';

-- As versões antigas ficaram renomeadas com sufixo, sem permissão de execução,
-- até a próxima limpeza do banco: painel_time_comercial_v1,
-- painel_origem_matriculas_v1, painel_pre_venda_v2.
