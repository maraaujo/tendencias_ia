/** Testes de privacidade (LGPD), segurança das credenciais e do repositório Google Sheets (simulado). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PEDIDO_BASE, cenario, plain } = require('./apoio');
const { carregarAgendaFacil } = require('../local/carregar');

test('P01 — agenda e log não guardam e-mail, nome nem observações', () => {
  const c = cenario({ gemini: {} });
  c.processar({ ...PEDIDO_BASE, nome: 'Fulana Fictícia', observacoes: 'Prefiro manhã, meu telefone é 11 98765-4321' });
  const tudo = JSON.stringify(c.estado());
  assert.ok(!tudo.includes('pessoa.teste@exemplo.com'));
  assert.ok(!tudo.includes('Fulana'));
  assert.ok(!tudo.includes('98765'));
  assert.ok(!tudo.includes('Prefiro'));
});

test('P02 — dados enviados ao Gemini: sem e-mail, sem nome, identificadores mascarados, dados delimitados', () => {
  const c = cenario({ gemini: {} });
  c.processar({ ...PEDIDO_BASE, nome: 'Fulana Fictícia', observacoes: 'Prefiro manhã. CPF 123.456.789-09, tel 11 98765-4321, contato fulana@exemplo.com' });
  assert.equal(c.fake.chamadas.length, 2, 'interpretação + redação');
  for (const ch of c.fake.chamadas) {
    const texto = JSON.stringify(ch.corpo);
    assert.ok(!texto.includes('pessoa.teste@exemplo.com'));
    assert.ok(!texto.includes('Fulana'));
    assert.ok(!texto.includes('123.456.789-09'));
    assert.ok(!texto.includes('98765-4321'));
    assert.ok(!texto.includes('fulana@exemplo.com'));
    assert.ok(!ch.corpo.systemInstruction.parts[0].text.includes('Prefiro'), 'dados nunca vão nas instruções');
    assert.match(ch.corpo.contents[0].parts[0].text, /^<dados_da_(solicitacao|decisao)>/);
    assert.equal(ch.corpo.generationConfig.responseMimeType, 'application/json');
    assert.ok(!ch.url.includes('CHAVE'), 'chave vai no cabeçalho, não na URL');
  }
});

test('P03 — possível dado sensível (saúde) não é enviado à IA', () => {
  const c = cenario({ gemini: {} });
  const r = c.processar({ ...PEDIDO_BASE, observacoes: 'Tenho diagnóstico de doença crônica.' });
  assert.equal(r.status, 'CONFIRMADO');
  assert.ok(r.flags.includes('POSSIVEL_DADO_SENSIVEL'));
  const interp = c.fake.chamadas.filter((ch) => ch.corpo.systemInstruction.parts[0].text.includes('módulo cognitivo'));
  assert.equal(interp.length, 0);
});

test('P04 — resposta ao Make não contém e-mail; nome é aplicado só no envio', () => {
  const c = cenario({ gemini: {} });
  const r = c.processar({ ...PEDIDO_BASE, nome: 'Fulana Fictícia' });
  assert.ok(!JSON.stringify(r).includes('pessoa.teste'));
  assert.ok(!JSON.stringify(r).includes('Fulana'));
  assert.match(r.mensagem.corpo, /\[NOME\]/);
  assert.match(c.AF.personalizarMensagem(r.mensagem.corpo, 'Fulana Fictícia'), /^Olá, Fulana!/);
  assert.match(c.AF.personalizarMensagem(r.mensagem.corpo, ''), /^Olá!/);
});

test('P05 — campos desconhecidos enviados pelo formulário são descartados', () => {
  const c = cenario();
  const s = plain(c.AF.normalizarEntrada({ ...PEDIDO_BASE, cpf: '123.456.789-09', telefone: '11999999999' }));
  assert.ok(!('cpf' in s));
  assert.ok(!('telefone' in s));
});

test('P06 — erros de IA não expõem a chave nem a URL', () => {
  const AF = carregarAgendaFacil();
  const cliente = AF.criarClienteGemini({ apiKey: 'CHAVE-SECRETA-XYZ', http: () => { throw new Error('falha em https://x?key=CHAVE-SECRETA-XYZ'); } });
  const r = AF.interpretarSolicitacao(cliente, { servico: 'Retorno', observacoes: 'oi' });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'IA_FALHA_COMUNICACAO');
  assert.equal(AF.criarClienteGemini({ apiKey: '', http: () => ({}) }), null, 'sem chave -> sem cliente');
});

// ---------------------------------------------------------------------------
// Repositório Google Sheets com um SpreadsheetApp simulado (mesma API usada)
// ---------------------------------------------------------------------------
function criarPlanilhaFalsa() {
  const abas = {};
  function aba(nome) {
    const dados = [];
    return {
      dados,
      getDataRange: () => ({ getValues: () => dados.map((l) => l.slice()) }),
      appendRow: (linha) => dados.push(linha.slice()),
      getLastColumn: () => (dados[0] || []).length,
      getRange: (l, col, nl, nc) => ({
        getValues: () => dados.slice(l - 1, l - 1 + (nl || 1)).map((x) => x.slice(col - 1, col - 1 + (nc || 1))),
        setValue: (v) => { dados[l - 1][col - 1] = v; }
      })
    };
  }
  return {
    abas,
    criarAba: (nome, cab) => { abas[nome] = aba(nome); abas[nome].appendRow(cab); return abas[nome]; },
    getSheetByName: (n) => abas[n] || null
  };
}

test('S01 — repositório de planilha: gravar, listar, consultar e atualizar status', () => {
  const Utilities = { formatDate: (d) => d.toISOString().slice(0, 16) };
  const AF = carregarAgendaFacil({ Utilities }, ['10_RepositorioPlanilha.js']);
  const pl = criarPlanilhaFalsa();
  pl.criarAba('Agenda', AF.COLUNAS_AGENDA);
  pl.criarAba('Log_Decisoes', AF.COLUNAS_LOG);
  const repo = AF.criarRepositorioPlanilha(pl);
  repo.inserirAgendamento({ protocolo: 'AF-20261123-AAAAAA', data: '2026-11-24', hora: '14:00', status: 'CONFIRMADO', emailHash: 'h1' });
  // célula editada manualmente que o Sheets converteu em Date
  pl.abas.Agenda.appendRow(['AF-20261123-BBBBBB', '', new Date(Date.UTC(2026, 10, 25)), '09:00', 'Retorno', 'CONFIRMADO', 'h2', '[]', '', '']);
  assert.equal(repo.listarAgendamentos({ dataInicio: '2026-11-24', dataFim: '2026-11-25' }).length, 2);
  assert.equal(repo.buscarPorProtocolo('AF-20261123-BBBBBB').data, '2026-11-25');
  repo.atualizarStatus('AF-20261123-AAAAAA', 'CANCELADO', '2026-11-23T09:00');
  assert.equal(repo.buscarPorProtocolo('AF-20261123-AAAAAA').status, 'CANCELADO');
  repo.registrarDecisao(AF.montarRegistroDecisao({ registradoEm: 'x', protocolo: 'AF-20261123-AAAAAA', statusFinal: 'CANCELADO' }));
  assert.equal(pl.abas.Log_Decisoes.dados.length, 2);
  assert.throws(() => AF.criarRepositorioPlanilha(criarPlanilhaFalsa()), /configurarPlanilha/);
});
