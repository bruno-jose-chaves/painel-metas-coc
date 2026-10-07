-- Update 5.

-- 1. painel_metas_leads(p_campanha)
--    As metas de captação não tinham filtro de curso nenhum: leads contava toda
--    conversão do período e lives casava qualquer página com a palavra live.
--    Com isso ACAFE e UFSC mostravam exatamente o mesmo número nos dois cards.
--    Agora a conversão só entra quando o identificador casa com a regra do curso
--    da campanha, e a função devolve o array identificadores com as páginas que
--    entraram, para o número ser conferível em vez de acreditado.

-- 2. painel_recompra(p_campanha)
--    Rematrícula, curso longo, outro intensivo e primeira compra. A pessoa é
--    reconhecida por e-mail, telefone ou nome normalizado. As faixas se
--    sobrepõem de propósito.

-- Versão antiga renomeada e sem permissão: painel_metas_leads_v1.
