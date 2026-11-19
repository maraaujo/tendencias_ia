/**
 * Transporte HTTP síncrono para a demonstração local.
 * O código do agente é síncrono (como o UrlFetchApp do Apps Script); no Node,
 * executamos o fetch em um processo filho e aguardamos o resultado.
 * A chave de API é passada pela entrada padrão do processo filho (não aparece
 * em argumentos de linha de comando nem em logs).
 */
'use strict';
const { execFileSync } = require('node:child_process');

const TRABALHADOR = `
let entrada = '';
process.stdin.on('data', (c) => (entrada += c));
process.stdin.on('end', async () => {
  const req = JSON.parse(entrada);
  try {
    const r = await fetch(req.url, { method: req.metodo, headers: req.cabecalhos, body: req.corpo,
      signal: AbortSignal.timeout(20000) });
    process.stdout.write(JSON.stringify({ status: r.status, corpo: await r.text() }));
  } catch (e) {
    process.stdout.write(JSON.stringify({ erro: 'FALHA_REDE' }));
  }
});`;

function httpSincrono(req) {
  const saida = execFileSync(process.execPath, ['-e', TRABALHADOR], {
    input: JSON.stringify(req), maxBuffer: 5 * 1024 * 1024, timeout: 30000
  });
  const r = JSON.parse(saida.toString('utf8'));
  if (r.erro) throw new Error(r.erro);
  return r;
}

module.exports = { httpSincrono };
