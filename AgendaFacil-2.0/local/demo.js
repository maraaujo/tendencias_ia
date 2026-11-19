/**
 * Demonstração local do agente AgendaFácil 2.0 (dados fictícios).
 *
 *   npm run demo                    -> modo sem IA (mensagens-modelo)
 *   GEMINI_API_KEY=... npm run demo -> usa o Gemini real (chave via ambiente ou arquivo .env)
 *
 * Simula o papel do Make: envia cada "linha do formulário" ao agente e
 * personaliza o e-mail com o primeiro nome somente no final.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { carregarAgendaFacil, criarDependenciasLocais } = require('./carregar');
const { httpSincrono } = require('./http-sincrono');

// Lê .env (opcional) sem dependências externas. O arquivo .env não é versionado.
const arquivoEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(arquivoEnv)) {
  for (const linha of fs.readFileSync(arquivoEnv, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const AF = carregarAgendaFacil();
const dados = JSON.parse(fs.readFileSync(path.join(__dirname, 'dados-ficticios.json'), 'utf8'));
const repo = AF.criarRepositorioEmMemoria({ agenda: [] });
const gemini = AF.criarClienteGemini({
  apiKey: process.env.GEMINI_API_KEY,
  modelo: process.env.GEMINI_MODELO,
  http: httpSincrono
});
const deps = criarDependenciasLocais({
  AF, repo, gemini, agora: dados.agora, sal: process.env.AF_SAL_HASH || 'sal-somente-demo'
});

// Agenda inicial: agendamentos fictícios já confirmados
for (const a of dados.agendaInicial) {
  repo.inserirAgendamento({ ...a, emailHash: deps.hash(a.email), alternativas: '[]', criadoEm: dados.agora.iso });
}

console.log('AgendaFácil 2.0 — demonstração local');
console.log('Relógio fixo:', dados.agora.data, dados.agora.hora, '| Gemini:', gemini ? `ATIVO (${gemini.modelo})` : 'NÃO CONFIGURADO (mensagens-modelo)');
console.log('='.repeat(78));

const protocolos = {};
for (const caso of dados.casos) {
  const entrada = { ...caso.entrada };
  if (entrada.protocoloAnterior && protocolos[entrada.protocoloAnterior]) {
    entrada.protocoloAnterior = protocolos[entrada.protocoloAnterior];
  }
  const r = AF.processarSolicitacao(entrada, deps);
  protocolos[caso.id] = r.protocolo;
  console.log(`\n[${caso.id}] ${caso.descricao}`);
  console.log(`  status: ${r.status} | protocolo: ${r.protocolo} | motivos: ${r.motivos.join(', ')}`);
  if (r.alternativas.length) console.log('  alternativas:', r.alternativas.map((a) => `${a.data} ${a.hora}`).join(' | '));
  if (r.flags.length) console.log('  flags:', r.flags.join(', '));
  console.log('  justificativa:', r.justificativa);
  const corpo = AF.personalizarMensagem(r.mensagem.corpo, caso.entrada.nome || '');
  console.log(`  e-mail (${r.mensagem.geradaPorIA ? 'redigido com IA' : 'mensagem-modelo'}): ${r.mensagem.assunto}`);
  console.log('  ' + corpo.split('\n').join('\n  '));
}

console.log('\n' + '='.repeat(78));
const consulta = AF.consultarStatus({ protocolo: protocolos.C1, email: 'bruno.ficticio@exemplo.com' }, deps);
console.log('Consulta de status pelo titular (C1):', JSON.stringify({ encontrado: consulta.encontrado, status: consulta.status }));
const alheia = AF.consultarStatus({ protocolo: protocolos.C1, email: 'intruso@exemplo.com' }, deps);
console.log('Consulta do mesmo protocolo por outro e-mail:', JSON.stringify(alheia));

const estado = repo.exportar();
console.log('\nAba "Agenda" (o que fica armazenado):');
console.table(estado.agenda.map((a) => ({ protocolo: a.protocolo, data: a.data, hora: a.hora, status: a.status, emailHash: a.emailHash.slice(0, 12) + '…' })));
console.log('Aba "Log_Decisoes" (últimos registros):');
console.table(estado.log.slice(-6).map((l) => ({ protocolo: l.protocolo, evento: l.evento, acao: l.acao, status: l.statusFinal, usoIA: l.usoIA, flags: l.flags })));
