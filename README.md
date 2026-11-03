# Painel de Metas COC Online

Site de acompanhamento de metas de vendas, leads, campanhas e time comercial.

## Como isso vai para o ar

Código no GitHub (`main`) → push → Cloudflare Pages constrói e publica em cerca de
1 minuto. O GitHub é a fonte da verdade: nada entra em produção por upload manual.
O navegador fala direto com o Supabase, sem servidor no meio.

- **Site:** Next.js 15 exportado como estático (`out/`), publicado pelo Cloudflare Pages.
- **Motor:** Supabase `painel-metas-coc` (região São Paulo). Banco, login, funções e integrações.
- `_headers`, `_redirects` e `404.html` em sintaxe Cloudflare. O "!" do Netlify invalida
  a regra em silêncio, então não usar.

## De onde vêm os dados

| Fonte | Como entra | Ritmo |
|---|---|---|
| Planilha de vendas | `integracoes/apps_script_planilha.gs` roda dentro da planilha "Coc Online - Comercial" e envia as abas de vendas para `planilha-ingest` | a cada 15 min |
| RD Station CRM e Marketing | `rd-oauth` faz a conexão, `rd-sync` traz negociações, contatos e conversões | `rd-sync` a cada 5 min |
| RD Station (webhook) | `rd-webhook` recebe mudança de negociação na hora | evento |
| Pigeon Post | `pigeon-sync` traz contatos e conversas, `pigeon-mensagens` traz as mensagens | 10 min e 5 min |
| Pigeon Post (webhook) | `conversas-ingest` recebe mensagem, etiqueta e sessão na hora | evento |

Credenciais ficam em `privado.credenciais`, cadastradas pela tela Ajustes → Acesso e
integrações. Nunca no código, nunca no repositório.

## Funções publicadas no Supabase

`planilha-ingest`, `rd-oauth`, `rd-sync`, `rd-webhook`, `rd-notas`, `pigeon-sync`,
`pigeon-mensagens`, `conversas-ingest`, `resumo-diario`, `admin-usuarios`, `n8n`, `pigeon`.

Para baixar a versão publicada: `supabase functions download <nome>`.

As tarefas agendadas vivem no `pg_cron` do banco (`select * from cron.job`), não aqui.

## O mapa do painel

`lib/telas.ts` é a fonte única do que existe: cinco áreas (Hoje 100, Campanha 200,
Comercial 300, Marketing 400, Ajustes 500), as abas de cada uma, os quadros de cada
aba e os apelidos que a busca entende. Código de três dígitos é setor, aba e quadro:
o 311 é o primeiro quadro da primeira aba de Comercial. Serve para conversar ("olha o
341") e é o que a busca usa para levar direto ao quadro.

Toda tela nova, aba nova ou quadro novo entra nesse arquivo. A conferência abaixo
compara a lista com o que a página desenha, então o mapa não envelhece em silêncio.

## Conferência antes de subir

```
npm run build        # tem que compilar
npx serve out        # sem -s, senão toda rota devolve a home
npm run verificar    # desenha todas as telas, confere os quadros contra o mapa e testa a busca
npm run varrer       # clica em todo botão, filtro e número clicável de todas as telas
```

As duas conferências usam Playwright com o Supabase simulado, então rodam sem tocar
no banco. `npm run verificar` também guarda retratos de notebook e de telefone em
`/tmp`, para olho humano.

## Histórico de mudanças no banco

`supabase/sql/` guarda um arquivo por update, em ordem de data, com o SQL aplicado e o
porquê. Mudança de banco entra lá no mesmo commit da mudança de tela.

## Rodar localmente

```
npm install
npm run dev
```
