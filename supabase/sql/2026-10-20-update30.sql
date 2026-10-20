-- Update 30 — duas contas que estavam erradas.
--
-- 1. "Primeira compra na casa" era calculada por exclusão das três janelas de
--    cima, e todas as três têm corte de tempo (365 ou 540 dias). Quem estudou
--    aqui em 2025 e ficou 2026 inteiro parado voltava a ser contado como
--    cliente novo. No Método ACAFE 2º/2026 eram 9 pessoas de 119, uma delas com
--    compra de 2022.
--    Agora existe uma checagem sem janela nenhuma (ja_comprou), e entrou a linha
--    "Já era da casa, de antes" para quem comprou antes mas fora das janelas.
--    Número corrigido: 110 clientes novos de verdade (49,5%), não 119 (53,6%).
--
-- 2. A sincronização de mensagens lia cada conversa UMA vez e nunca voltava.
--    Como a leitura acontece em até 30 minutos depois de a conversa abrir, o
--    cliente que respondia duas horas depois ficava marcado para sempre como
--    "nunca respondeu". Em 7 dias isso dava 45 respostas onde existiam 150: a
--    conta subestimava três vezes, e pior justamente nos disparos, onde a
--    resposta demora mais.
--
--    pigeon_conversas ganhou a coluna gerada mexeu_depois, que diz se houve
--    movimento na conversa depois da última leitura. Existe porque o PostgREST
--    não compara duas colunas entre si num filtro, e é essa comparação que
--    decide se vale reler.

alter table pigeon_conversas
  add column if not exists mexeu_depois boolean
  generated always as (
    mensagens_lidas_em is null
    or (ultima_interacao is not null and ultima_interacao > mensagens_lidas_em)
  ) stored;

create index if not exists pigeon_conversas_reler
  on pigeon_conversas (ultima_interacao desc)
  where primeira_mensagem_cliente is null and mexeu_depois;

-- painel_recompra: ver o bloco ja_comprou / marcado2 e a linha voltou_de_longe.
