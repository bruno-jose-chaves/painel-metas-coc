-- Update 25 — o resumo diário sai do n8n, e o funil do WhatsApp vira
-- conferência de passagem para o CRM.
--
-- 1. O resumo das 20h ficou seis dias fora com erro 401. A chave não tinha
--    mudado: o agendador do n8n estava com um registro congelado da versão
--    velha do nó, que ainda mandava a chave na query. Salvar pela tela
--    re-registra; PATCH por API não, e ativar por API é ignorado em silêncio.
--    Então o horário sai do n8n e passa para o pg_cron, e o n8n só entrega.
-- 2. resumo_do_dia levava 6,4 s no primeiro disparo e estourava o tempo limite
--    do banco. O filtro inicio::date varria pigeon_conversas inteira, e cada
--    linha carrega o jsonb bruto. Virou faixa e usa o índice que já existia.
-- 3. conversas_eventos gravou o número de protocolo da sessão do Pigeon como
--    telefone em 2.395 eventos. Todo cruzamento de conversa com CRM dava zero
--    e ninguém via, porque zero parece resposta.
-- 4. O funil por etiqueta era leitura errada: a etiqueta é botão de automação,
--    posta e retirada na hora, não é estado. Trocado por conversa contra card.

create table if not exists privado.resumo_entrega (
  id int primary key default 1 check (id = 1),
  url text not null,
  para text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);

-- Função nova: enviar_resumo_whats(date) — monta o texto e empurra para o
-- webhook do n8n, marcando a própria entrega para a saúde das fontes vigiar.
-- Agendada em cron.schedule('resumo-whats', '0 23 * * *', ...), que é 20h em
-- Brasília. Entra desligada: ligar só depois do Active no fluxo novo do n8n,
-- senão a mensagem sai duas vezes.

-- resumo_do_dia: filtro de data virou faixa, e o plural de "1 matrícula".
-- painel_whats_crm(de, ate): cada pessoa que conversou e se tem card no CRM.
-- painel_tempo_etapa(funil): dias parados por etapa, com quem concentra.
-- painel_funil_whats e painel_etiquetas_whats saem de uso.

-- Correção do histórico, já aplicada:
-- update conversas_eventos
--   set telefone_norm = norm_telefone(corpo->'content'->'contactDetails'->>'phonenumber')
--  where evento like 'SESSION%' and telefone_norm ~ '^20[0-9]{11}$' ...
-- 2.153 linhas recuperadas, 242 ficaram nulas por não ter telefone no corpo.

-- No painel a etapa passa a se chamar pelo que ela é. O nome da etiqueta no
-- Pigeon não muda, porque é ele que dispara a automação do CRM.
update etiquetas_whats set valor = 'Aguardando pagamento'
where etiqueta_norm = 'VENDA REALIZADA RD';
