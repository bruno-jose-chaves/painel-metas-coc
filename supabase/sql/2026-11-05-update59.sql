-- Update 59 — a planilha de 2021 e 2022 reconciliada, e o aviso de erro em Ajustes
--
-- O bloco de importação em Ajustes mostrava 16 linhas recusadas por data ilegível,
-- todas de 2021 e 2022. Conferidas uma a uma na planilha: 14 tinham data válida e
-- só nunca foram relidas (abas de ano fechado não voltam sozinhas), 2 eram data
-- escrita errada de verdade e foram corrigidas na planilha:
--   Vendas 2021, nº 837: "0912/2021"   -> 09/12/2021
--   Vendas 2022, nº 701: "10/10/2023"  -> 10/10/2022 (ano errado dentro da aba de 2022)
--
-- Das 14 linhas que faltavam no painel, 12 entraram. Duas ficaram de fora porque
-- são a mesma matrícula já lançada em outra linha da própria planilha:
--   Vendas 2022, nº 688 = nº 700 (Vinicius Giovane dagnoni)
--   Vendas 2022, nº 696 = nº 702 (Leticia Moro)
--
-- Efeito: 2021 vai de 782 para 786 matrículas, 2022 de 788 para 798, e 2023 perde
-- a matrícula que estava com ano errado. Nenhuma ficou órfã de turma.

-- 1. as 14 linhas que faltavam (12 inseridas, 2 ignoradas por duplicidade)
--    o insert original está no histórico da conversa; chave = aba|numero

-- 2. a data corrigida no painel, para bater com a planilha
update vendas set data = '2022-10-10' where chave = 'Vendas 2022|701' and data = '2023-10-10';

-- 3. um registro novo de importação para cada aba releitura, com o que foi visto
--    em "avisos". painel_importacoes usa a última leitura de cada aba, então o
--    aviso antigo de recusa sai da tela sem apagar o histórico.

-- 4. painel_importacoes passa a devolver "avisos": o que a importação percebeu
--    mas não impediu de entrar (número repetido, linha lançada duas vezes, data
--    corrigida à mão). Avisos iguais que só mudam o número da linha viram uma
--    linha só, com a contagem, para a coluna não virar parede de texto.
alter function painel_importacoes() rename to painel_importacoes_v1;
-- create or replace function painel_importacoes() ... (corpo aplicado no banco)
