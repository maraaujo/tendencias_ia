/**
 * AgendaFácil 2.0 — MEMÓRIA E CONTEXTO (controlados)
 *
 * Três tipos de memória, separados de propósito:
 *
 * 1. Contexto temporário de processamento (`criarContextoTemporario`):
 *    existe só durante uma execução; contém e-mail e observações; é
 *    descartado ao final (`descartarContexto`). Nunca é gravado.
 *
 * 2. Histórico necessário do agendamento (aba "Agenda"):
 *    protocolo, data, hora, serviço, status, alternativas e um identificador
 *    anônimo (hash SHA-256 do e-mail com "sal" secreto). Sem nome, sem e-mail,
 *    sem observações.
 *
 * 3. Registro de decisões e ações (aba "Log_Decisoes"):
 *    somente campos de uma lista branca (ver `montarRegistroDecisao`).
 *
 * Não existe memória permanente irrestrita: o agente não guarda conversas,
 * textos livres nem respostas completas, e há rotina de retenção.
 */
var AgendaFacil = AgendaFacil || {};

(function (AF) {
  'use strict';

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  /** Colunas persistidas (lista branca). */
  AF.COLUNAS_AGENDA = ['protocolo', 'criadoEm', 'data', 'hora', 'servico', 'status',
    'emailHash', 'alternativas', 'protocoloAnterior', 'atualizadoEm'];
  AF.COLUNAS_LOG = ['registradoEm', 'protocolo', 'evento', 'dataSolicitada', 'horaSolicitada',
    'servico', 'resultadoVerificacao', 'acao', 'motivos', 'justificativa', 'statusFinal',
    'usoIA', 'flags', 'responsavel', 'versaoRegras'];

  AF.criarContextoTemporario = function (solicitacao) {
    return { solicitacao: solicitacao, criadoEm: Date.now() };
  };
  AF.descartarContexto = function (ctx) {
    if (!ctx) return;
    if (ctx.solicitacao) {
      ctx.solicitacao.email = null;
      ctx.solicitacao.observacoes = null;
    }
    ctx.solicitacao = null;
  };

  /** Monta o registro de decisão apenas com campos permitidos (sem dados pessoais). */
  AF.montarRegistroDecisao = function (p) {
    var reg = {
      registradoEm: p.registradoEm,
      protocolo: p.protocolo,
      evento: p.evento || 'SOLICITACAO',
      dataSolicitada: p.data || '',
      horaSolicitada: p.hora || '',
      servico: p.servico || '',
      resultadoVerificacao: p.decisao ? p.decisao.resultadoVerificacao : '',
      acao: p.decisao ? p.decisao.acao : '',
      motivos: p.decisao ? p.decisao.motivos.join(',') : '',
      justificativa: p.justificativa || '',
      statusFinal: p.statusFinal || (p.decisao ? p.decisao.status : ''),
      usoIA: p.usoIA ? 'interpretacao=' + p.usoIA.interpretacao + ';redacao=' + p.usoIA.redacao : '',
      flags: (p.flags || []).join(','),
      responsavel: p.responsavel || 'agente',
      versaoRegras: AF.CONFIG.versaoRegras
    };
    var limpo = {};
    AF.COLUNAS_LOG.forEach(function (c) { limpo[c] = reg[c]; });
    return limpo;
  };

  /**
   * Repositório em memória (usado nos testes e na demonstração local).
   * Implementa a mesma interface do repositório de planilha.
   * `falhas` permite simular indisponibilidade: { leitura: bool, escrita: bool, log: bool }.
   */
  AF.criarRepositorioEmMemoria = function (inicial, falhas) {
    var agenda = ((inicial && inicial.agenda) || []).map(clonar);
    var log = [];
    falhas = falhas || {};
    return {
      falhas: falhas,
      listarAgendamentos: function (filtro) {
        if (falhas.leitura) throw new Error('Falha simulada ao ler a planilha');
        filtro = filtro || {};
        return agenda.filter(function (a) {
          return (!filtro.dataInicio || a.data >= filtro.dataInicio) &&
            (!filtro.dataFim || a.data <= filtro.dataFim);
        }).map(clonar);
      },
      buscarPorProtocolo: function (protocolo) {
        if (falhas.leitura) throw new Error('Falha simulada ao ler a planilha');
        var r = agenda.filter(function (a) { return a.protocolo === protocolo; })[0];
        return r ? clonar(r) : null;
      },
      inserirAgendamento: function (reg) {
        if (falhas.escrita) throw new Error('Falha simulada ao gravar na planilha');
        var linha = {};
        AF.COLUNAS_AGENDA.forEach(function (c) { linha[c] = reg[c] === undefined ? '' : reg[c]; });
        agenda.push(clonar(linha));
      },
      atualizarStatus: function (protocolo, status, quando) {
        if (falhas.escrita) throw new Error('Falha simulada ao gravar na planilha');
        var r = agenda.filter(function (a) { return a.protocolo === protocolo; })[0];
        if (!r) throw new Error('Protocolo não encontrado');
        r.status = status;
        r.atualizadoEm = quando;
      },
      registrarDecisao: function (reg) {
        if (falhas.log) throw new Error('Falha simulada ao gravar o log');
        log.push(clonar(reg));
      },
      // utilitários de inspeção (testes/demonstração)
      exportar: function () { return { agenda: clonar(agenda), log: clonar(log) }; }
    };
  };

  /**
   * Retenção (LGPD — limitação do armazenamento): retorna os índices das
   * linhas cuja data é mais antiga que `dias` em relação a `hojeIso`.
   */
  AF.selecionarExpirados = function (datasIso, dias, hojeIso) {
    var limite = AF.somarDias(hojeIso, -dias);
    var idx = [];
    datasIso.forEach(function (d, i) { if (d && String(d).slice(0, 10) < limite) idx.push(i); });
    return idx;
  };
})(AgendaFacil);
