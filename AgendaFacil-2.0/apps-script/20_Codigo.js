/**
 * AgendaFácil 2.0 — Pontos de entrada no Google Apps Script
 *
 *  doPost(e)                      Web App chamado pelo Make (ações: processar, consultar_status)
 *  configurarPlanilha()           cria abas, cabeçalhos, formato texto e proteções
 *  gerarSegredos()                cria o token do webhook e o sal do hash (Propriedades do Script)
 *  aplicarRetencao()              apaga dados vencidos (LGPD) — agendar diariamente
 *  instalarGatilhoRetencao()      cria o gatilho diário da retenção
 *  onOpen() / revisarSolicitacao  menu de revisão humana na planilha
 *
 * Credenciais ficam APENAS em Propriedades do Script:
 *   GEMINI_API_KEY, GEMINI_MODELO (opcional), AF_TOKEN_WEBHOOK, AF_SAL_HASH,
 *   AF_PLANILHA_ID, AF_FORM_ID (opcional, para retenção no Forms)
 */

// --------------------------------------------------------------------------
// Web App (Make -> Apps Script)
// --------------------------------------------------------------------------
function doPost(e) {
  var resposta;
  try {
    var props = PropertiesService.getScriptProperties();
    var corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!tokenValido_(corpo.token, props.getProperty('AF_TOKEN_WEBHOOK'))) {
      resposta = { ok: false, erro: 'NAO_AUTORIZADO' };
    } else if (corpo.acao === 'processar') {
      resposta = AgendaFacil.processarSolicitacao(corpo.dados || {}, criarDependencias_());
    } else if (corpo.acao === 'consultar_status') {
      resposta = AgendaFacil.consultarStatus(corpo.dados || {}, criarDependencias_());
    } else {
      resposta = { ok: false, erro: 'ACAO_NAO_PERMITIDA' };
    }
  } catch (err) {
    // Nunca devolver detalhes internos (podem conter dados ou configurações).
    console.error('AgendaFacil doPost: ' + (err && err.message ? err.message.slice(0, 120) : 'erro'));
    resposta = { ok: false, erro: 'ERRO_INTERNO' };
  }
  return ContentService.createTextOutput(JSON.stringify(resposta))
    .setMimeType(ContentService.MimeType.JSON);
}

function tokenValido_(recebido, esperado) {
  if (!esperado || typeof recebido !== 'string' || recebido.length !== esperado.length) return false;
  var dif = 0;
  for (var i = 0; i < esperado.length; i++) dif |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

function obterPlanilha_() {
  var id = PropertiesService.getScriptProperties().getProperty('AF_PLANILHA_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function criarDependencias_() {
  var props = PropertiesService.getScriptProperties();
  var cfg = AgendaFacil.CONFIG;
  var sal = props.getProperty('AF_SAL_HASH');
  if (!sal) throw new Error('AF_SAL_HASH não configurado. Execute gerarSegredos().');
  return {
    cfg: cfg,
    repo: AgendaFacil.criarRepositorioPlanilha(obterPlanilha_(), cfg),
    gemini: AgendaFacil.criarClienteGemini({
      apiKey: props.getProperty('GEMINI_API_KEY'),
      modelo: props.getProperty('GEMINI_MODELO') || cfg.gemini.modelo,
      http: httpUrlFetch_
    }),
    hash: function (texto) {
      var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '|' + texto, Utilities.Charset.UTF_8);
      return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
    },
    agora: function () {
      var d = new Date();
      return {
        data: Utilities.formatDate(d, cfg.fusoHorario, 'yyyy-MM-dd'),
        hora: Utilities.formatDate(d, cfg.fusoHorario, 'HH:mm'),
        iso: Utilities.formatDate(d, cfg.fusoHorario, "yyyy-MM-dd'T'HH:mm:ssXXX")
      };
    },
    gerarProtocolo: function (agora) {
      var sufixo = Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
      return 'AF-' + agora.data.replace(/-/g, '') + '-' + sufixo;
    },
    bloqueio: function (fn) {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000); // evita duas confirmações simultâneas no mesmo horário
      try { return fn(); } finally { lock.releaseLock(); }
    }
  };
}

function httpUrlFetch_(req) {
  var r = UrlFetchApp.fetch(req.url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': req.cabecalhos['x-goog-api-key'] },
    payload: req.corpo,
    muteHttpExceptions: true
  });
  return { status: r.getResponseCode(), corpo: r.getContentText() };
}

// --------------------------------------------------------------------------
// Configuração inicial (executar manualmente uma vez no editor)
// --------------------------------------------------------------------------
function configurarPlanilha() {
  var cfg = AgendaFacil.CONFIG;
  var planilha = obterPlanilha_();
  [[cfg.abas.agenda, AgendaFacil.COLUNAS_AGENDA], [cfg.abas.log, AgendaFacil.COLUNAS_LOG]].forEach(function (par) {
    var aba = planilha.getSheetByName(par[0]) || planilha.insertSheet(par[0]);
    if (aba.getLastRow() === 0) aba.appendRow(par[1]);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, aba.getMaxRows(), par[1].length).setNumberFormat('@');
    // Controle de acesso: somente o proprietário edita estas abas.
    var protecao = aba.protect().setDescription('AgendaFácil 2.0 — somente o agente e o responsável');
    protecao.addEditor(Session.getEffectiveUser());
    protecao.removeEditors(protecao.getEditors().filter(function (u) {
      return u.getEmail() !== Session.getEffectiveUser().getEmail();
    }));
    if (protecao.canDomainEdit()) protecao.setDomainEdit(false);
  });
  return 'Planilha configurada.';
}

function gerarSegredos() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('AF_TOKEN_WEBHOOK')) props.setProperty('AF_TOKEN_WEBHOOK', Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty('AF_SAL_HASH')) props.setProperty('AF_SAL_HASH', Utilities.getUuid());
  return 'Segredos gerados. Copie AF_TOKEN_WEBHOOK em Configurações do projeto > Propriedades do script e cole no Make.';
}

// --------------------------------------------------------------------------
// Retenção de dados (LGPD — limitação do armazenamento)
// --------------------------------------------------------------------------
function aplicarRetencao() {
  var cfg = AgendaFacil.CONFIG;
  var props = PropertiesService.getScriptProperties();
  var hoje = Utilities.formatDate(new Date(), cfg.fusoHorario, 'yyyy-MM-dd');
  var planilha = obterPlanilha_();
  var removidos = { respostas: 0, log: 0, forms: 0 };

  function limpar(aba, colunaData, dias) {
    if (!aba || aba.getLastRow() < 2) return 0;
    var valores = aba.getRange(2, colunaData, aba.getLastRow() - 1, 1).getValues().map(function (l) {
      var v = l[0];
      return v instanceof Date ? Utilities.formatDate(v, cfg.fusoHorario, 'yyyy-MM-dd') : String(v).slice(0, 10);
    });
    var idx = AgendaFacil.selecionarExpirados(valores, dias, hoje);
    for (var i = idx.length - 1; i >= 0; i--) aba.deleteRow(idx[i] + 2); // de baixo para cima
    return idx.length;
  }

  // Coluna 1 das respostas do Forms = "Carimbo de data/hora"
  removidos.respostas = limpar(planilha.getSheetByName(cfg.abas.respostas), 1, cfg.retencaoDias.respostasFormulario);
  removidos.log = limpar(planilha.getSheetByName(cfg.abas.log), 1, cfg.retencaoDias.logDecisoes);

  var formId = props.getProperty('AF_FORM_ID');
  if (formId) {
    var limite = new Date(Date.now() - cfg.retencaoDias.respostasFormulario * 86400000);
    var form = FormApp.openById(formId);
    form.getResponses().forEach(function (r) {
      if (r.getTimestamp() < limite) { form.deleteResponse(r.getId()); removidos.forms++; }
    });
  }
  console.log('Retenção aplicada: ' + JSON.stringify(removidos));
  return removidos;
}

function instalarGatilhoRetencao() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'aplicarRetencao') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('aplicarRetencao').timeBased().everyDays(1).atHour(3).create();
}

// --------------------------------------------------------------------------
// Revisão humana (menu na planilha)
// --------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('AgendaFácil 2.0')
    .addItem('Revisar solicitação (decisão humana)', 'revisarSolicitacao')
    .addToUi();
}

function revisarSolicitacao() {
  var ui = SpreadsheetApp.getUi();
  var p = ui.prompt('Revisão humana', 'Protocolo (ex.: AF-20261124-ABC123):', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  var s = ui.prompt('Revisão humana', 'Novo status (CONFIRMADO, RECUSADO ou CANCELADO):', ui.ButtonSet.OK_CANCEL);
  if (s.getSelectedButton() !== ui.Button.OK) return;
  var m = ui.prompt('Revisão humana', 'Motivo da decisão (obrigatório, sem dados pessoais):', ui.ButtonSet.OK_CANCEL);
  if (m.getSelectedButton() !== ui.Button.OK) return;
  var deps = criarDependencias_();
  var r = AgendaFacil.revisarDecisao({
    protocolo: p.getResponseText().trim().toUpperCase(),
    novoStatus: s.getResponseText().trim().toUpperCase(),
    motivo: m.getResponseText(),
    revisor: Session.getActiveUser().getEmail() || 'equipe'
  }, deps);
  ui.alert(r.ok ? 'Status atualizado: ' + r.de + ' → ' + r.para + '. Avise a pessoa pelo e-mail da resposta do formulário.'
    : 'Não foi possível revisar: ' + r.erro);
}
