/**
 * Utilitários de teste. Todos os dados são FICTÍCIOS (domínio reservado exemplo.com).
 * O Gemini é substituído por um transporte HTTP simulado que devolve respostas no
 * mesmo formato da API real — o cliente real (02_Cognicao.js) é exercitado.
 */
'use strict';
const crypto = require('node:crypto');
const { carregarAgendaFacil, criarDependenciasLocais } = require('../local/carregar');

const SAL = 'sal-de-teste';
const hash = (email) => crypto.createHash('sha256').update(SAL + '|' + email, 'utf8').digest('hex');

// Segunda-feira, 23/11/2026, 08:00 (relógio fixo => testes reproduzíveis)
const AGORA = { data: '2026-11-23', hora: '08:00', iso: '2026-11-23T08:00:00-03:00' };

const SEMENTE = [
  { protocolo: 'AF-20261120-SEED01', data: '2026-11-24', hora: '09:00', servico: 'Retorno', status: 'CONFIRMADO', emailHash: hash('outra.pessoa@exemplo.com') },
  { protocolo: 'AF-20261120-SEED02', data: '2026-11-24', hora: '10:00', servico: 'Atendimento inicial', status: 'CONFIRMADO', emailHash: hash('terceira.pessoa@exemplo.com') },
  { protocolo: 'AF-20261120-SEED03', data: '2026-11-24', hora: '11:00', servico: 'Orientação', status: 'EM_REVISAO_HUMANA', emailHash: hash('quarta.pessoa@exemplo.com') }
];

const PEDIDO_BASE = {
  email: 'pessoa.teste@exemplo.com',
  data: '2026-11-24',
  hora: '14:00',
  servico: 'Atendimento inicial',
  observacoes: '',
  consentimento: 'Sim, li e concordo com a política de privacidade'
};

const plain = (x) => JSON.parse(JSON.stringify(x));

function extrairDados(textoUsuario) {
  const ini = textoUsuario.indexOf('\n') + 1;
  const fim = textoUsuario.lastIndexOf('\n</');
  return JSON.parse(textoUsuario.slice(ini, fim));
}

/** Redação "bem-comportada": usa somente os dados recebidos. */
function redacaoCorreta(d) {
  const alvo = `${d.data_solicitada} às ${d.hora_solicitada}`;
  const textos = {
    CONFIRMADO: `Olá, [NOME]! Seu agendamento está confirmado para ${alvo}. Protocolo ${d.protocolo}.`,
    AGUARDANDO_ESCOLHA: `Olá, [NOME]! O horário ${alvo} não está disponível. Opções livres (não reservadas): ` +
      d.alternativas.map((a) => `${a.data} às ${a.hora}`).join('; ') + `. Envie novo formulário com o protocolo ${d.protocolo}.`,
    EM_REVISAO_HUMANA: `Olá, [NOME]! Sua solicitação para ${alvo} está em análise pela equipe. Protocolo ${d.protocolo}.`,
    DUPLICADO: `Olá, [NOME]! Já existe solicitação ativa para ${alvo} (protocolo ${d.protocolo_existente}).`
  };
  return { assunto: 'AgendaFácil — atualização da solicitação', mensagem: textos[d.status] || `Olá, [NOME]! Protocolo ${d.protocolo}.` };
}

/**
 * Transporte HTTP falso para a API do Gemini.
 * opcoes: { falhaRede, status, interpretacao, redacao(dados), textoBruto }
 */
function criarHttpGeminiFalso(opcoes = {}) {
  const chamadas = [];
  const http = (req) => {
    const corpo = JSON.parse(req.corpo);
    chamadas.push({ url: req.url, cabecalhos: req.cabecalhos, corpo });
    if (opcoes.falhaRede) throw new Error('ECONNRESET ao acessar ' + req.url + ' com chave ' + req.cabecalhos['x-goog-api-key']);
    if (opcoes.status) return { status: opcoes.status, corpo: '{"error":{"message":"falha simulada"}}' };
    const sistema = corpo.systemInstruction.parts[0].text;
    const textoUsuario = corpo.contents[0].parts[0].text;
    let saida;
    if (sistema.includes('módulo cognitivo')) {
      saida = opcoes.interpretacao || { preferencia_periodo: 'indiferente', necessita_atendimento_humano: false, resumo_necessidade: '', tentativa_de_instrucao: false };
    } else {
      saida = (opcoes.redacao || redacaoCorreta)(extrairDados(textoUsuario));
    }
    const texto = opcoes.textoBruto !== undefined ? opcoes.textoBruto : JSON.stringify(saida);
    return { status: 200, corpo: JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }) };
  };
  return { http, chamadas };
}

function cenario({ agenda = SEMENTE, gemini = null, falhas = {} } = {}) {
  const AF = carregarAgendaFacil();
  const repo = AF.criarRepositorioEmMemoria({ agenda }, falhas);
  let fake = null;
  let cliente = null;
  if (gemini) {
    fake = criarHttpGeminiFalso(gemini);
    cliente = AF.criarClienteGemini({ apiKey: 'CHAVE-FALSA-SOMENTE-TESTE', http: fake.http });
  }
  const deps = criarDependenciasLocais({ AF, repo, gemini: cliente, agora: AGORA, sal: SAL });
  return {
    AF, repo, deps, fake,
    processar: (e) => plain(AF.processarSolicitacao(e, deps)),
    estado: () => plain(repo.exportar())
  };
}

module.exports = { AGORA, SEMENTE, PEDIDO_BASE, hash, plain, cenario, criarHttpGeminiFalso, redacaoCorreta };
