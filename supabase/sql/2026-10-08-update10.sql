-- Update 10. Aplicado direto no banco em 08/10/2026.
-- Investigação da live do ACAFE, que mostrava 543 inscrições contra 827 no RD.

-- A CAUSA
-- A importação de conversões do RD Marketing andava para trás com um ponteiro
-- único, recuo_ate. A cada volta montava um lote de 25 dias e, no fim, gravava
-- o ponteiro como se os 25 tivessem sido buscados. Só que o laço interrompia o
-- lote quando o tempo da função acabava ou quando a API devolvia erro: os dias
-- restantes eram pulados para sempre, sem deixar rastro.
-- Resultado: 04/09 a 26/09 de 2026 não existia na base. Vinte e três dias, para
-- TODOS os formulários, no meio da campanha do ACAFE.
-- Só nessa live eram 488 conversões faltando. Depois da recuperação, o
-- formulário live-acafe-21-a-23-do-09 foi de 543 para 1.031.

-- A CORREÇÃO
-- Tabela rd_mkt_dias registra cada dia efetivamente buscado, depois de gravado.
-- rd_mkt_fila(p_quantos) devolve o que falta, do mais recente para o mais
-- antigo. A rd-sync passou a trabalhar por essa fila, e erro em um dia não
-- derruba o resto nem marca o dia como feito.
-- painel_cobertura_marketing() mostra a cobertura na tela de integrações.

-- POR QUE 1.031 NÃO É IGUAL A 827
-- São unidades diferentes, e as duas estão certas:
--   827  = pessoas que se inscreveram, que é o que o RD Marketing mostra no evento
--   1.031 = envios de formulário, que é o que a API de conversões devolve
--   707  = pessoas com negociação no CRM vindas da campanha, dentro da janela
-- Quem preenche duas vezes conta duas vezes no número de envios. Por isso, para
-- inscritos nas lives, vale o número do CRM, que conta gente.
-- A diferença entre 827 inscritos e 707 com negociação é gente que preencheu o
-- formulário e não virou negociação no CRM. Isso é falha de automação do RD,
-- não do painel, e vale investigar do lado do marketing.

-- NOME DE CAMPANHA NÃO É ESTÁVEL
-- O fluxo do RD renomeia a campanha, e o nome novo vale para trás. Hoje 155
-- negociações de abril e maio, que são da live do 1º semestre, carregam o nome
-- "[ACAFE 26/2] LIVE". Contar por nome de campanha sem recorte de data mistura
-- edições. Por isso a contagem passou a começar no primeiro dia em que o
-- formulário daquela campanha registrou inscrição.

-- DUAS CORREÇÕES QUE APARECERAM NO CAMINHO
-- 1. "Leads captados" zerou quando apontei um formulário de 2025 como ACAFE,
--    porque a regra era excludente. Agora leads captados soma o padrão do curso
--    mais o apontado na mão, sem contar duas vezes. Saiu de 0 para 3.444.
-- 2. A janela de contagem começava no início da campanha. A inscrição na live
--    começou em 10/08 e a campanha abre em 25/08, então duas semanas ficavam de
--    fora. Agora começa no primeiro dia de conversão do formulário, limitado a
--    45 dias antes da campanha para formulário reaproveitado entre anos não
--    puxar o ano inteiro.

-- NÚMEROS DEPOIS DA CORREÇÃO
--   ACAFE leads captados: 3.444 de 3.400 (antes 1.907)
--   ACAFE inscritos nas lives: 707 pessoas, 1.031 envios (antes 680 e 543)
--   UFSC inscritos nas lives: 313 pessoas, 469 envios
