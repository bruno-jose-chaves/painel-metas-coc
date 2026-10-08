-- Update 6.

-- 1. captacao_regras(campanha_id, indicador, tipo, valor)
--    Quais campanhas do CRM e quais formulários contam para cada indicador de
--    captação. Vira dado editável pelo painel em vez de regra escondida no
--    código, porque só quem toca a operação sabe qual peça é de qual indicador.
--    Já cadastradas as regras das lives, como Bruno definiu em 08/10.

-- 2. painel_metas_leads(p_campanha)
--    Quando o indicador tem regra, ela manda. O CRM é contado por pessoa, porque
--    tem identidade; o formulário por conversão, porque o histórico diário não
--    guarda quem é. Quando os dois caminhos existem vale o do CRM, senão quem
--    veio pelos dois seria contado duas vezes. A saída traz os dois separados.

-- 3. painel_pendencias(p_desde)
--    Campanhas e formulários que o painel não conseguiu ligar a um curso, com
--    volume e quantos viraram matrícula, ordenado pelo maior. Alimenta a tela
--    nova de Pendências, onde a decisão é apontada e vira regra permanente.

-- 4. painel_upsell_origem(p_campanha)
--    De quais cursos vieram as pessoas que compraram esta campanha, com o tempo
--    entre a compra anterior e esta.

-- 5. cron classificar-leads a cada quinze minutos, para lead novo entrar
--    classificado sem esperar a próxima sessão.

-- Versão antiga renomeada e sem permissão: painel_metas_leads_v2.

-- 6. Leads por curso (T9)
--    painel_leads_dia, painel_leads_origem, painel_fontes e painel_tags passam a
--    aceitar p_produto. Auxiliar formulario_do_curso(identificador, produto):
--    vale primeiro a regra apontada na tela de Pendências, depois o nome do
--    próprio formulário. Assim o que você aponta uma vez vale em toda a tela.
--    Versões antigas renomeadas: painel_leads_dia_v2, painel_leads_origem_v1,
--    painel_fontes_v1, painel_tags_v1.
