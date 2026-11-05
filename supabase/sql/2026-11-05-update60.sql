-- Update 60 — origem de quem fechou, dois dados que vinham vazios, e o painel
-- do comercial fechado em quem está logado

-- 1. Mensagem enviada guarda o atendente como id do Pigeon, não como nome. Por
--    isso a medida "Mensagens que você mandou" do quadro de horário vinha
--    sempre vazia quando filtrada em uma pessoa: o id nunca casava com o nome
--    da planilha. A tradução agora passa por atendentes_whats.
--    (corpo completo de painel_mapa_calor aplicado no banco)

-- 2. Quem pode ver quem. A restrição mora no banco, não na tela, porque a tela
--    é só uma sugestão: a chamada pode ser forjada.
create or replace function public.vendedor_visivel(p_vendedor text default null)
returns text language sql stable security definer set search_path to 'public' as $$
  select case when is_admin() then p_vendedor else vendedor_atual() end;
$$;
revoke all on function public.vendedor_visivel(text) from public, anon;

-- 3. As telas de gestão passam a exigir diretoria. A 360, Performance
--    individual, mostra nome, carteira e comissão de todo mundo.
--    where is_autorizado() -> where is_admin() em:
--    painel_performance_periodo, painel_performance_semana, painel_performance_hoje,
--    painel_performance_carteira, painel_performance_perdas, painel_performance_pessoas

-- 4. As três consultas que a tela de gestão e o painel do comercial
--    compartilham viraram par: a versão _todos devolve o time inteiro e não tem
--    permissão para ninguém, e a versão que a tela chama corta no que a pessoa
--    pode ver. Antes o navegador do comercial recebia a comissão do time todo e
--    filtrava a própria linha em JavaScript.
--    painel_performance_mix, painel_performance_resposta, painel_comissao
--    e a legada painel_performance_resposta(date,date), sem permissão.

-- 5. coalesce(p_vendedor, vendedor_atual()) -> coalesce(vendedor_visivel(p_vendedor), vendedor_atual())
--    em painel_meu_resumo, painel_minha_fila e painel_meu_contra_time.

-- 6. Bloco novo: De onde veio quem fechou (315).
--    Três relógios por matrícula, todos olhando só o que aconteceu antes dela:
--      dias_fechar  = da negociação que originou a venda até a matrícula
--      dias_contato = da primeira conversa de WhatsApp até a matrícula
--      dias_base    = do primeiro registro da pessoa em qualquer base
--    Mediana, não média, porque um lead de dois anos atrás puxa qualquer média.
--    (corpo completo de painel_fechamento_origem aplicado no banco)
