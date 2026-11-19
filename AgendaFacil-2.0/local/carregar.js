/**
 * Carrega os arquivos do Apps Script no Node.js, em um único contexto global
 * (exatamente como o Apps Script faz). Assim os testes executam o MESMO código
 * que vai para o Google, sem cópias.
 */
'use strict';
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PASTA = path.join(__dirname, '..', 'apps-script');
const NUCLEO = ['00_Config.js', '01_Percepcao.js', '02_Prompts.js', '02_Cognicao.js',
  '03_Decisao.js', '04_Memoria.js', '05_Agente.js'];

function carregarAgendaFacil(globaisExtras = {}, arquivosExtras = []) {
  const contexto = vm.createContext({ console, ...globaisExtras });
  for (const arq of NUCLEO.concat(arquivosExtras)) {
    const codigo = fs.readFileSync(path.join(PASTA, arq), 'utf8');
    vm.runInContext(codigo, contexto, { filename: arq });
  }
  return contexto.AgendaFacil;
}

/** Dependências locais equivalentes às do Apps Script (20_Codigo.js). */
function criarDependenciasLocais({ AF, repo, gemini = null, agora, sal = 'sal-de-teste' }) {
  let contador = 0;
  return {
    cfg: AF.CONFIG,
    repo,
    gemini,
    hash: (t) => crypto.createHash('sha256').update(sal + '|' + t, 'utf8').digest('hex'),
    agora: typeof agora === 'function' ? agora : () => agora,
    gerarProtocolo: (a) => {
      contador += 1;
      return 'AF-' + a.data.replace(/-/g, '') + '-' + String(contador).padStart(6, '0');
    },
    bloqueio: (fn) => fn()
  };
}

module.exports = { carregarAgendaFacil, criarDependenciasLocais };
