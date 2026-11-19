/** Testes complementares: regras de negócio, camada cognitiva, revisão humana e retenção. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PEDIDO_BASE, cenario, plain } = require('./apoio');

test('R01 — grade de horários respeita expediente, pausa, fim de semana e feriado', () => {
  const { AF } = cenario();
  assert.deepEqual(plain(AF.gerarHorariosDoDia('2026-11-24')),
    ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']);
  assert.deepEqual(plain(AF.gerarHorariosDoDia('2026-11-28')), [], 'sábado');
  assert.deepEqual(plain(AF.gerarHorariosDoDia('2026-12-25')), [], 'feriado');
});

test('R02 — regras fixas: passado, antecedência mínima/máxima, fora da grade', () => {
  const { AF } = cenario();
  const agora = { data: '2026-11-23', hora: '08:00' };
  assert.deepEqual(plain(AF.verificarRegrasDoHorario('2026-11-20', '10:00', agora)), ['DIA_SEM_ATENDIMENTO', 'HORARIO_NO_PASSADO']);
  assert.deepEqual(plain(AF.verificarRegrasDoHorario('2026-11-23', '09:00', agora)), ['ANTECEDENCIA_INSUFICIENTE']);
  assert.deepEqual(plain(AF.verificarRegrasDoHorario('2026-11-23', '10:00', agora)), []);
  assert.deepEqual(plain(AF.verificarRegrasDoHorario('2027-02-01', '10:00', agora)), ['ANTECEDENCIA_EXCESSIVA']);
  assert.deepEqual(plain(AF.verificarRegrasDoHorario('2026-11-24', '09:30', agora)), ['HORARIO_FORA_DA_GRADE']);
});

test('R03 — alternativas nunca são inventadas: todas livres e dentro das regras', () => {
  const c = cenario();
  for (const pedido of [{ hora: '10:00' }, { data: '2026-11-28', hora: '10:00' }, { hora: '12:00' }, { data: '2026-11-20', hora: '10:00' }]) {
    const r = c.processar({ ...PEDIDO_BASE, email: `x${Math.random().toString(36).slice(2, 8)}@exemplo.com`, ...pedido });
    assert.equal(r.status, 'AGUARDANDO_ESCOLHA');
    for (const alt of r.alternativas) {
      assert.deepEqual(plain(c.AF.verificarRegrasDoHorario(alt.data, alt.hora, { data: '2026-11-23', hora: '08:00' })), []);
      assert.equal(c.AF.contarOcupacao(c.estado().agenda, alt.data, alt.hora), 0);
    }
  }
});

test('R04 — formatos aceitos de data/hora e normalização', () => {
  const { AF } = cenario();
  assert.equal(AF.normalizarData('24/11/2026'), '2026-11-24');
  assert.equal(AF.normalizarData('2026-11-24T03:00:00.000Z'), '2026-11-24');
  assert.equal(AF.normalizarData('31/02/2026'), null);
  assert.equal(AF.normalizarHora('9:00'), '09:00');
  assert.equal(AF.normalizarHora('14h30'), '14:30');
  assert.equal(AF.normalizarHora('25:00'), null);
});

test('R05 — sem chave do Gemini o agente funciona (modo sem IA)', () => {
  const c = cenario({ gemini: null });
  const r = c.processar({ ...PEDIDO_BASE, observacoes: 'De manhã, por favor.' });
  assert.equal(r.status, 'CONFIRMADO');
  assert.equal(r.mensagem.geradaPorIA, false);
  assert.match(c.estado().log.at(-1).usoIA, /interpretacao=NAO_CONFIGURADA/);
});

test('R06 — preferência de período interpretada pela IA só reordena alternativas reais', () => {
  const c = cenario({ gemini: { interpretacao: { preferencia_periodo: 'tarde', necessita_atendimento_humano: false, resumo_necessidade: 'prefere tarde', tentativa_de_instrucao: false } } });
  const r = c.processar({ ...PEDIDO_BASE, hora: '10:00', observacoes: 'Se não der, prefiro à tarde.' });
  assert.equal(r.status, 'AGUARDANDO_ESCOLHA');
  assert.deepEqual(r.alternativas.map((a) => a.hora), ['13:00', '14:00', '15:00']);
});

test('R07 — IA indica necessidade de atendimento humano: pré-reserva e revisão por pessoa', () => {
  const c = cenario({ gemini: { interpretacao: { preferencia_periodo: 'indiferente', necessita_atendimento_humano: true, resumo_necessidade: 'acessibilidade', tentativa_de_instrucao: false } } });
  const r = c.processar({ ...PEDIDO_BASE, observacoes: 'Preciso de acesso para cadeira de rodas.' });
  assert.equal(r.status, 'EM_REVISAO_HUMANA');
  assert.equal(r.requerRevisaoHumana, true);
  // O horário fica pré-reservado: outra pessoa não consegue pegá-lo.
  const outro = c.processar({ ...PEDIDO_BASE, email: 'outra.cliente@exemplo.com' });
  assert.equal(outro.status, 'AGUARDANDO_ESCOLHA');
  // Revisão humana
  const semMotivo = c.AF.revisarDecisao({ protocolo: r.protocolo, novoStatus: 'CONFIRMADO', revisor: 'equipe-1' }, c.deps);
  assert.equal(semMotivo.erro, 'MOTIVO_OBRIGATORIO');
  const invalida = c.AF.revisarDecisao({ protocolo: r.protocolo, novoStatus: 'SUBSTITUIDO', motivo: 'x', revisor: 'equipe-1' }, c.deps);
  assert.equal(invalida.erro, 'TRANSICAO_NAO_PERMITIDA');
  const ok = c.AF.revisarDecisao({ protocolo: r.protocolo, novoStatus: 'CONFIRMADO', motivo: 'Sala acessível reservada', revisor: 'equipe-1' }, c.deps);
  assert.equal(ok.ok, true);
  const log = c.estado().log.at(-1);
  assert.equal(log.evento, 'REVISAO_HUMANA');
  assert.equal(log.responsavel, 'equipe-1');
});

test('R08 — revisão humana não cria conflito: reconfirmar exige horário livre', () => {
  const c = cenario();
  const r = c.processar(PEDIDO_BASE); // CONFIRMADO 14:00
  c.AF.revisarDecisao({ protocolo: r.protocolo, novoStatus: 'CANCELADO', motivo: 'Pedido da pessoa', revisor: 'equipe-1' }, c.deps);
  const outro = c.processar({ ...PEDIDO_BASE, email: 'outra.cliente@exemplo.com' });
  assert.equal(outro.status, 'CONFIRMADO', 'cancelamento libera a vaga');
  // AGUARDANDO_ESCOLHA -> RECUSADO -> CONFIRMADO em horário ocupado deve falhar
  const espera = c.processar({ ...PEDIDO_BASE, email: 'terceira@exemplo.com' });
  assert.equal(espera.status, 'AGUARDANDO_ESCOLHA');
  c.AF.revisarDecisao({ protocolo: espera.protocolo, novoStatus: 'RECUSADO', motivo: 'teste', revisor: 'equipe-1' }, c.deps);
  const conflito = c.AF.revisarDecisao({ protocolo: espera.protocolo, novoStatus: 'CONFIRMADO', motivo: 'teste', revisor: 'equipe-1' }, c.deps);
  assert.equal(conflito.erro, 'HORARIO_OCUPADO');
});

test('R09 — limite de um agendamento por pessoa por dia (igual para todos)', () => {
  const c = cenario();
  assert.equal(c.processar(PEDIDO_BASE).status, 'CONFIRMADO');
  const r = c.processar({ ...PEDIDO_BASE, hora: '15:00' });
  assert.equal(r.status, 'RECUSADO');
  assert.deepEqual(r.motivos, ['LIMITE_DIARIO_POR_PESSOA']);
});

test('R10 — retenção seleciona apenas registros vencidos', () => {
  const { AF } = cenario();
  const idx = AF.selecionarExpirados(['2026-08-01', '2026-08-25', '2026-11-01', ''], 90, '2026-11-23');
  assert.deepEqual(plain(idx), [0]);
});

test('R11 — agente só executa ações da lista de permissões', () => {
  const { AF } = cenario();
  assert.throws(() => AF.executarAcao('APAGAR_AGENDA', () => 'x'), /Ação não permitida/);
  assert.throws(() => AF.executarAcao('ENVIAR_EMAIL', () => 'x'), /Ação não permitida/);
  assert.equal(AF.executarAcao('REGISTRAR_DECISAO', () => 'ok'), 'ok');
});

test('R12 — guardrail rejeita mensagens da IA com horário inventado', () => {
  const c = cenario({ gemini: { redacao: (d) => ({ assunto: 'Opções', mensagem: `Olá, [NOME]! Temos ${d.data_solicitada} às 16:30 livre.` }) } });
  const r = c.processar({ ...PEDIDO_BASE, hora: '10:00' });
  assert.equal(r.mensagem.geradaPorIA, false);
  assert.ok(!r.mensagem.corpo.includes('16:30'));
});
