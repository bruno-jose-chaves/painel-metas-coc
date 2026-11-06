-- Update 64 — cinco coisas que não funcionavam

-- 1. APONTAR ETIQUETA DO PIGEON (bloco 536) não salvava, e o motivo era o pior
--    possível: a função apontar_etiqueta_whats, que a tela chama desde o update
--    58, NUNCA FOI CRIADA no banco. O botão chamava uma função inexistente, o
--    PostgREST devolvia erro, e a tela mostrava a mensagem de sucesso porque o
--    erro vinha em um campo que ela não lia.
--    Criada agora, com um destino que faltava: "ignorar". Etiqueta de uso
--    interno do time existe e não quer dizer nada para o painel, e sem esse
--    destino ela ficava para sempre na lista de pendência.
create or replace function public.apontar_etiqueta_whats(
  p_etiqueta text, p_tipo text, p_valor text default null)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare v_norm text; v_ordem integer; v_valor text;
begin
  if not is_admin() then raise exception 'Só a diretoria aponta etiqueta'; end if;
  v_norm := norm_etiqueta(p_etiqueta);
  if v_norm is null then raise exception 'Etiqueta vazia'; end if;
  if p_tipo not in ('curso', 'vendedor', 'etapa', 'ignorar') then
    raise exception 'Tipo inválido: %', p_tipo;
  end if;
  v_valor := nullif(btrim(coalesce(p_valor, '')), '');
  if p_tipo <> 'ignorar' and v_valor is null then raise exception 'Destino vazio'; end if;
  select coalesce(max(e.ordem), 0) + 1 into v_ordem from etiquetas_whats e where e.tipo = p_tipo;
  insert into etiquetas_whats (etiqueta_norm, etiqueta, tipo, valor, ordem)
  values (v_norm, btrim(p_etiqueta), p_tipo, coalesce(v_valor, 'ignorar'), v_ordem)
  on conflict (etiqueta_norm) do update
    set etiqueta = excluded.etiqueta, tipo = excluded.tipo, valor = excluded.valor;
  return v_norm;
end $function$;
revoke all on function public.apontar_etiqueta_whats(text,text,text) from public, anon;

-- 2. OS QUATRO PAPÉIS não apareciam porque o banco não aceitava: o CHECK da
--    tabela de usuários só permitia leitor e admin. Escolher comercial no
--    seletor era rejeitado, e a tela não dizia nada. Ontem eu montei o menu por
--    papel e não conferi a ponta do cadastro.
alter table public.usuarios_autorizados drop constraint if exists usuarios_autorizados_papel_check;
alter table public.usuarios_autorizados add constraint usuarios_autorizados_papel_check
  check (papel = any (array['leitor','comercial','marketing','admin']));
-- aprovar_acesso() passou a aceitar os quatro, e o botão de aprovar já define o
-- papel em vez de criar sempre como leitor.

-- 3. LANÇAMENTOS: o filtro de vendedor não tinha como listar a venda
--    automática, porque ele só oferecia nomes que existem na planilha e elas
--    justamente não têm nome. Agora tem a opção "Venda automática", que filtra
--    a linha sem vendedor. É por ela que se confere as 56.

-- 4. CAMPANHA, DA ORIGEM À MATRÍCULA: ao tirar o botão "Por fonte" eu deixei a
--    linha de filtros vazia no meio da tela. A faixa branca era isso.

-- 5. Nada de desempenho neste update.
