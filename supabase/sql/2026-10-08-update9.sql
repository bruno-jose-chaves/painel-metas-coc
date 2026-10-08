-- Update 9. Aplicado direto no banco em 08/10/2026.

-- 1. CORREÇÃO SÉRIA na atribuição de anúncio. painel_anuncios atribuía à peça
--    qualquer venda feita dentro do período, inclusive venda fechada ANTES de a
--    pessoa falar com a gente por aquele anúncio. No "CURSINHO 100% GRÁTIS",
--    quatro das onze vendas tinham dia negativo, entre elas uma de R$ 7.005 do
--    Semi fechada 56 dias antes da primeira conversa. O anúncio aparecia como o
--    melhor da casa por causa de venda que não era dele.
--    Agora a venda tem que ser posterior à primeira conversa daquela pessoa
--    vinda daquela peça. Resultado real: de 9 matrículas e R$ 15.834 para
--    4 matrículas e R$ 2.580.

-- 2. Janela de atribuição por produto, em produtos.janela_atribuicao:
--    45 dias no Método ACAFE e no Missão UFSC, 60 no Semi e no Extensivo.
--    Era 60 fixo para todo mundo. Vale em painel_anuncios e em
--    painel_origem_matriculas, via janela_do_produto(p_produto).

-- 3. Temporada no histórico. O Método ACAFE e o Semi têm duas turmas por ano e
--    comparar ano cheio contra ano cheio juntava as duas. O corte é 1º de
--    julho, que é onde a venda separa de fato: o ACAFE 1º vende de janeiro a
--    junho com pico em abril, e o 2º de julho a novembro com pico em setembro.
--    produtos.duas_temporadas marca quem tem duas turmas.
--    Leitura correta do 2º semestre: 200 alunos em 2026 contra 253 em 2025 na
--    mesma data, 21% abaixo. Antes aparecia 401 contra 520, somando as turmas.

-- 4. Tela de conferência para o time comercial: painel_sugestoes(p_desde) lista
--    o que está estranho na base, e painel_sugestoes_casos(p_tipo, p_desde)
--    abre a relação nominal. Sete verificações: negócio parado há mais de 30
--    dias, perda sem motivo, venda sem vendedor, data impossível, venda sem
--    contato, negócio sem campanha e pessoa com mais de um negócio aberto.
--    O painel não corrige nada: quem decide é quem conhece a negociação.

-- 5. Credencial própria do resumo, serviço 'resumo', para o n8n não precisar
--    carregar a chave que dispara todas as rotinas. A Edge Function
--    resumo-diario aceita as duas.

-- O que o Bruno decidiu e não entra: T5, o simulador de preço. A escada de
-- preço é decidida antes da campanha começar, para a comunicação comercial e
-- de marketing ficar isonômica. Mudar preço no meio não é uma opção.
