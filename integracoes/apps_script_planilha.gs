/**
 * Painel de Metas COC Online · envio automático da planilha "Coc Online - Comercial".
 *
 * Instalação (uma vez só):
 *   1. Na planilha, menu Extensões > Apps Script.
 *   2. Apague o conteúdo do arquivo Código.gs e cole este arquivo inteiro. Salve.
 *   3. No seletor de funções, escolha "instalar" e clique em Executar. Autorize com sua conta Google.
 *   4. Pronto: toda aba "Vendas <ano>" do ano corrente em diante passa a ser
 *      enviada a cada 15 minutos. Ano novo não exige mexer no script.
 *   5. Para carregar o histórico, execute "importarHistorico" uma vez.
 *
 * O script só lê a planilha. Nada é alterado nela.
 */

const PAINEL_URL = 'https://raelmxfhzplsvipnthrd.supabase.co/functions/v1/planilha-ingest';
const PAINEL_CHAVE = '__CHAVE__';
// O ano da aba é descoberto pelo nome, e não escrito aqui. A versão anterior
// tinha 'Vendas 2026' fixo, e por isso a aba de 2027 existia na planilha e
// nunca chegava no painel: matrícula acontecendo e invisível.
const PADRAO_ABA = /^Vendas\s+(20\d\d)$/;

function abasDeVenda_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .map(function (a) { return a.getName(); })
    .map(function (n) { var m = n.match(PADRAO_ABA); return m ? { nome: n, ano: Number(m[1]) } : null; })
    .filter(function (x) { return x !== null; })
    .sort(function (a, b) { return a.ano - b.ano; });
}

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

// Do ano corrente em diante: é onde cai venda nova. Em novembro de 2026 isso
// já são duas abas, 2026 e 2027, e as duas precisam chegar.
function enviarVendasAtuais() {
  const anoMinimo = new Date().getFullYear();
  const alvo = abasDeVenda_().filter(function (a) { return a.ano >= anoMinimo; });
  if (alvo.length === 0) throw new Error('Nenhuma aba "Vendas <ano>" de ' + anoMinimo + ' em diante.');
  alvo.forEach(function (a) { enviarAba_(a.nome); });
}

// O histórico inteiro, para rodar uma vez na instalação ou quando precisar
// recarregar tudo.
function importarHistorico() {
  abasDeVenda_().forEach(function (a) { enviarAba_(a.nome); });
}

// Diagnóstico: imprime no log o nome de toda aba da planilha e quais foram
// reconhecidas como aba de venda. Serve para quando uma aba não chega no
// painel e a suspeita é o nome.
function listarAbas() {
  const todas = SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .map(function (a) { return a.getName(); });
  console.log('Abas da planilha: ' + todas.join(' | '));
  console.log('Reconhecidas como venda: ' + abasDeVenda_().map(function (a) { return a.nome; }).join(' | '));
}

function instalar() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'enviarVendasAtuais'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('enviarVendasAtuais').timeBased().everyMinutes(15).create();
  enviarVendasAtuais();
}
