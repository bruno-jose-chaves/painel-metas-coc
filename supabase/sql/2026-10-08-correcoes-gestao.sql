-- Correções após o Update 7. Aplicadas direto no banco em 08/10/2026.

-- 1. A aba Gestão aparecia zerada para quem usa o painel.
--    pigeon_contatos tinha RLS ligada e nenhuma política, então ninguém lia
--    nada, e rd_contatos fica fechada de propósito porque é dado pessoal.
--    A função agora roda como dona e barra quem não tem acesso ao painel. Ela
--    só devolve contagem, nunca o dado da pessoa.
create policy pigeon_contatos_leitura on pigeon_contatos
  for select to authenticated using (is_autorizado());

-- painel_gestao e painel_gestao_dia passaram a ter
--   security definer set search_path = public
-- e um with permissao as (select is_autorizado() as ok) usado em todo CTE que
-- lê tabela. Corpo completo em 2026-10-08-gestao.sql, com essas duas mudanças.

-- 2. Pendências ganhou piso de volume. A cauda de peça antiga que ainda
--    captura um lead ou dois por mês atrapalha mais do que ajuda.
--    Assinatura nova: painel_pendencias(p_desde date, p_minimo int default 10).

-- 3. Importação do Pigeon recuada de 25/08 para 01/08/2026, para cobrir o mês
--    inteiro antes das campanhas do ACAFE.
update pigeon_sync_estado
set desde = '2026-08-01T00:00:00Z', pagina = 1, concluido_em = null,
    ultimo_corte = null, erro = null, atualizado_em = now()
where recurso = 'conversas';
