/**
 * Painel de Metas COC Online · envio automático da planilha "Coc Online - Comercial".
 *
 * Instalação (uma vez só):
 *   1. Na planilha, menu Extensões > Apps Script.
 *   2. Apague o conteúdo do arquivo Código.gs e cole este arquivo inteiro. Salve.
 *   3. No seletor de funções, escolha "instalar" e clique em Executar. Autorize com sua conta Google.
 *   4. Pronto: a aba "Vendas 2026" passa a ser enviada a cada 15 minutos.
 *   5. Para carregar o histórico, execute "importarHistorico" uma vez.
 *
 * O script só lê a planilha. Nada é alterado nela.
 */

const PAINEL_URL = 'https://raelmxfhzplsvipnthrd.supabase.co/functions/v1/planilha-ingest';
const PAINEL_CHAVE = '__CHAVE__';
const ABA_ATUAL = 'Vendas 2026';
const ABAS_HISTORICO = ['Vendas 2025', 'Vendas 2024', 'Vendas 2023', 'Vendas 2022', 'Vendas 2021'];

function enviarAba_(nomeAba) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nomeAba);
  if (!aba) throw new Error('Aba não encontrada: ' + nomeAba);
  const valores = aba.getDataRange().getDisplayValues();
  const payload = { aba: nomeAba, cabecalho: valores[0], linhas: valores.slice(1) };
  const resp = UrlFetchApp.fetch(PAINEL_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-chave-painel': PAINEL_CHAVE },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  console.log(nomeAba + ': ' + resp.getResponseCode() + ' ' + resp.getContentText());
  return resp.getResponseCode();
}

function enviarVendasAtuais() {
  enviarAba_(ABA_ATUAL);
}

function importarHistorico() {
  ABAS_HISTORICO.forEach(function (a) { enviarAba_(a); });
}

function instalar() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'enviarVendasAtuais'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('enviarVendasAtuais').timeBased().everyMinutes(15).create();
  enviarVendasAtuais();
}
