# Painel de Metas COC Online

Site de acompanhamento de metas de vendas, leads e time comercial.

- **Site:** Next.js exportado como estático (`out/`). Hospedagem de validação: Netlify (`coc-painel-bj26`). Destino final: Hostinger.
- **Motor:** Supabase `painel-metas-coc` (região São Paulo). Banco, login, funções e integrações.
- **Planilha:** `integracoes/apps_script_planilha.gs` roda dentro da planilha "Coc Online - Comercial" e envia a aba "Vendas 2026" a cada 15 minutos para a função `planilha-ingest`.
- **RD Station:** função `rd-oauth` (conexão OAuth do CRM e do Marketing). Credenciais cadastradas pela tela Configuração, nunca no código.

Funções publicadas no Supabase: `planilha-ingest`, `rd-oauth`, `rd-sync` (agendada a cada 5 minutos pelo pg_cron). Para baixar a versão publicada: `supabase functions download <nome>`.

## Rodar localmente
```
npm install
npm run dev
```
