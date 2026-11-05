-- Update 61 — o bloco 315 ajustado, a fonte do CRM fora de decisão, e a lentidão
-- das abas novas resolvida

-- 1. LENTIDÃO. As abas novas estavam sem os índices que o resto do site já tinha.
--    Três consultas correlacionadas varriam tabela inteira uma vez por linha.
--
--    painel_performance_resposta: 15.396 ms -> 283 ms
--      A conversa sem carimbo de primeira resposta procurava a primeira mensagem
--      nossa dentro da conversa, e conversas_eventos não tinha índice por
--      conversa: 39 mil eventos varridos por conversa medida, com 11.936
--      conversas sem carimbo.
--    painel_performance_semana: 2.676 ms -> 326 ms
--      A coorte procura compra pelo telefone do aluno e do responsável
--      financeiro, e o do responsável não tinha índice. É ele que paga.
--    painel_performance_hoje: 1.332 ms -> 91 ms
--    painel_performance_periodo: 153 ms -> 33 ms
--    painel_fechamento_origem: ~8 s -> 677 ms
create index if not exists conversas_eventos_conversa_envio
  on public.conversas_eventos (conversa_id, ocorrido_em) where evento = 'MESSAGE_SENT';
create index if not exists conversas_eventos_conversa
  on public.conversas_eventos (conversa_id, evento, ocorrido_em);
create index if not exists conversas_mv_telefone on public.conversas_mv (telefone);
create index if not exists conversas_mv_telefone_inicio on public.conversas_mv (telefone, inicio_sp);
create index if not exists conversas_mv_quem_inicio on public.conversas_mv (quem_comecou, inicio_sp);
create index if not exists conversas_mv_atendente on public.conversas_mv (atendente);
create index if not exists rd_negociacoes_contato_telefone on public.rd_negociacoes (contato_telefone_norm);
create index if not exists rd_negociacoes_contato_email on public.rd_negociacoes (contato_email_norm);
create index if not exists rd_conversoes_telefone_norm on public.rd_conversoes (telefone_norm);
create index if not exists vendas_resp_telefone_norm on public.vendas (resp_telefone_norm);
create index if not exists vendas_data_produto on public.vendas (data, produto_id);

-- 2. "Na base há" passou a olhar quatro origens em vez de três. A mais antiga
--    das quatro vale:
--      contato criado no RD (Marketing e CRM compartilham o cadastro de contato,
--        com histórico desde 19/09/2024)
--      conversão de formulário no RD Marketing (rd_conversoes, desde 02/10/2026)
--      primeira conversa no WhatsApp (desde 01/08/2026)
--      compra anterior na planilha
--    Antes só olhava negociação, conversa e compra anterior, e por isso o lead
--    que existia no RD Marketing desde 2024 aparecia como novo.
--    (corpo completo de painel_fechamento_origem aplicado no banco)

-- 3. painel_fechamento_lista: a mesma conta, uma linha por matrícula, para
--    conferir se a mediana conta a verdade. Ordenada por quem está na base há
--    mais tempo, que é onde mora a surpresa.

-- 4. A visão por fonte saiu do bloco 315. Das 10.029 negociações criadas em
--    2026, 87,7% estão sem fonte preenchida, contra 11,7% sem campanha.
--    Agrupar por um campo vazio em nove de cada dez casos joga quase tudo em uma
--    linha de "sem origem" e dá aparência de número a um dado que não existe.
--    Os outros dois lugares do painel que usam fonte, Campanha > Da origem à
--    matrícula e Marketing > Origem dos negócios no CRM, passaram a dizer isso
--    na própria nota, com o número, e a apontar a leitura por campanha.
