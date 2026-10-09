-- Update 14 — Lead frio separado, decisão que gruda, e regra por turma
-- Aplicado direto no banco em 09/10/2026. Este arquivo é o registro.

-- 1. indicadores_captacao
--    A lista de indicadores vivia copiada em três telas. Virou tabela, com uma
--    coluna que faltava: conta_como_lead.
--      leads            Leads captados                    conta
--      inscritos_lives  Inscritos nas lives               conta
--      reservas         Reservas                          conta
--      material_rico    Material rico (lead frio)         NÃO conta
--    Material rico vai para o Agente de Pré-vendas, não para a fila do
--    comercial. Somar os dois na mesma linha infla a captação e piora a
--    conversão do time sem ninguém ter feito nada errado.

-- 2. captacao_regras aponta para turma, não só para campanha
--    alter table captacao_regras add column turma_id text references turmas(id);
--    alter table captacao_regras alter column campanha_id drop not null;
--    check (campanha_id is not null or turma_id is not null)
--    Curso que vende o ano inteiro sem campanha montada no painel, como o
--    Semiextensivo, não tinha para onde apontar. "inscricoes-prevest-26-2", com
--    274 conversões, era o caso que apareceu.

-- 3. classificar_leads ignorava a decisão apontada à mão
--    A função só olhava regex de produto, etiqueta, anúncio e primeira
--    mensagem. Nunca leu captacao_regras. Por isso campanha do CRM apontada em
--    "Esperando a sua decisão" continuava na lista para sempre: a decisão não
--    virava produto no lead.
--    Agora a regra manual é a primeira fonte, nesta ordem:
--      regra_manual      regra em captacao_regras sobre a campanha do CRM
--      regra_formulario  regra sobre formulário, casada pelo contato
--      campanha_crm      regex do produto no nome da campanha
--      etiqueta_rd / anuncio_pigeon / mensagem_cliente
--    Efeito do reprocessamento: 2.450 leads passaram a ter curso por regra
--    manual, e sem_classificacao caiu de 3.410 para 3.278.

-- 4. painel_pendencias tira da lista na hora
--    Para formulário já checava captacao_regras; para campanha do CRM não
--    checava nada, só esperava a classificação. Agora checa os dois.

-- 5. painel_metas_leads
--    a) Formulário apontado para indicador com conta_como_lead = false sai da
--       base automática de "Leads captados".
--    b) Indicador com regra e sem meta aparece com meta zero, em vez de sumir.
--
--    Efeito em Método ACAFE 2º/2026: leads captados foi de 3.459 para 2.840.
--    48 conversões saíram por serem material rico. O resto é a janela: ela
--    começava em 11/07 porque um formulário de material rico de 2025 estava
--    apontado como lead e puxava o início para trás. Voltou a começar em 25/08,
--    que é o início da campanha.

-- 6. Regras ajustadas
--    ago-2025-material-rico-simulado        leads -> material_rico
--    set-2025-material-rico-redacao-ufsc    leads -> material_rico
--    inscricoes-prevest-26-2                nova, turma semi-extensivo-2026-2,
--                                           indicador leads
