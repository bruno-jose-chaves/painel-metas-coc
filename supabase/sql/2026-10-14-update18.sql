-- Update 18 — Saúde das fontes, comparação por turma e turma contra turma
-- Aplicado direto no banco em 14/10/2026. Este arquivo é o registro.

-- 1. painel_saude_fontes()
--    Cada carga declara de quanto em quanto tempo deveria rodar. Dentro do
--    limite é "ok"; até o dobro é "atencao"; acima do dobro, sem marca de tempo
--    ou com a última corrida falhando, é "fora".
--    Cobre as cinco cargas de dado (CRM, Marketing, planilha comercial, Pigeon,
--    catálogo) e todas as rotinas ativas do cron, pelo histórico de corridas.
--    O nome é "saude_fontes" e não "fontes" porque painel_fontes(de, ate,
--    produto) já existe e é outra coisa: origem das matrículas.
--
--    Lista completa em Ajustes. No resto do site só aparece a tarja, e só
--    quando alguma fonte está fora, para não virar enfeite que se aprende a
--    ignorar.

-- (corpo aplicado no banco; ver pg_get_functiondef se precisar reler)
-- alter function public.painel_fontes() rename to painel_saude_fontes;
-- revoke all on function public.painel_saude_fontes() from public, anon;
-- grant execute on function public.painel_saude_fontes() to authenticated;

-- 2. painel_vendas_periodo(..., p_comparar = 'turma')
--    Quarta leitura da comparação do gráfico de vendas: a mesma turma do ano
--    anterior. Método/2 compara com Método/2 e Semi/1 com Semi/1, em vez de
--    comparar com o que por acaso estava vendendo na mesma data.
--    O deslocamento não é um ano redondo: é a distância entre o começo de uma
--    turma e o começo da outra, pelo campo venda_de da tabela turmas. Turma que
--    abriu mais cedo ou mais tarde que a do ano anterior deixa de atrapalhar.
--    Só existe com um curso escolhido no filtro, porque sem produto não há
--    turma; a tela volta sozinha para "período anterior" se o curso sair.

-- 3. painel_comparar_turmas(p_a, p_b)
--    Duas turmas alinhadas pelo DIA DA TURMA, não pela data: o dia 1 de uma
--    encosta no dia 1 da outra. É o que torna comparáveis turmas que abrem em
--    meses diferentes.
--    Cada turma desenha só até onde já viveu: a que está em curso para no dia
--    de hoje em vez de cair para zero no resto do eixo.
--    A atribuição de venda a turma é a mesma de painel_turmas: turma_da_venda
--    (produto, curso, data).

-- 4. painel_comparar_turmas_resumo(p_a, p_b)
--    Uma linha por turma: alunos, faturamento, ticket, desconto médio, janela
--    de venda, dias corridos, se está em curso, e o melhor dia com quantos.
--    A tela usa isto para o total fechado, e usa a curva para o número que fica
--    em destaque, que é sempre no mesmo ponto das duas. Comparar o total de uma
--    turma em curso com o total de uma turma fechada é a armadilha óbvia desta
--    tela, e o desenho não deixa cair nela.

-- Permissões, nas quatro: revogadas de public e anon, concedidas a
-- authenticated. Toda recriação de função devolve o grant padrão a PUBLIC, e
-- PUBLIC inclui o papel anônimo, então o revoke vem sempre depois do create.
