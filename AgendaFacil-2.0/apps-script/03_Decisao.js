/**
 * AgendaFácil 2.0 — CAMADA 3: DECISÓRIA
 *
 * Decisões críticas (confirmar, recusar, sugerir alternativas) são tomadas
 * AQUI, por regras determinísticas e verificáveis. O texto gerado pela IA
 * nunca decide nada.
 *
 * Princípio de equidade: a função `decidir` NÃO recebe nome, e-mail, texto
 * livre ou qualquer característica pessoal. Recebe apenas data, hora, serviço,
 * um identificador anônimo (hash do e-mail, usado só para detectar duplicidade)
 * e a agenda. Portanto, as mesmas regras valem para todas as pessoas.
 */
var AgendaFacil = AgendaFacil || {};

(function (AF) {
  'use strict';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  AF.paraMinutos = function (hhmm) {
    var p = hhmm.split(':');
    return (+p[0]) * 60 + (+p[1]);
  };
  AF.paraHora = function (min) { return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); };

  function paraDataUTC(iso) {
    var p = iso.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }
  AF.diaDaSemana = function (iso) { return paraDataUTC(iso).getUTCDay(); };
  AF.somarDias = function (iso, n) {
    var d = paraDataUTC(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  AF.diferencaDias = function (deIso, ateIso) {
    return Math.round((paraDataUTC(ateIso) - paraDataUTC(deIso)) / 86400000);
  };
  AF.formatarDataBR = function (iso) {
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  };

  /** Grade de horários de um dia (vazia em fins de semana e feriados). */
  AF.gerarHorariosDoDia = function (data, cfg) {
    cfg = cfg || AF.CONFIG;
    if (cfg.expediente.diasSemana.indexOf(AF.diaDaSemana(data)) === -1) return [];
    if (cfg.feriados.indexOf(data) !== -1) return [];
    var ini = AF.paraMinutos(cfg.expediente.inicio);
    var fim = AF.paraMinutos(cfg.expediente.fim);
    var dur = cfg.duracaoMinutos;
    var pausas = cfg.expediente.pausas.map(function (p) {
      return [AF.paraMinutos(p.inicio), AF.paraMinutos(p.fim)];
    });
    var horarios = [];
    for (var m = ini; m + dur <= fim; m += dur) {
      var conflitaPausa = pausas.some(function (p) { return m < p[1] && m + dur > p[0]; });
      if (!conflitaPausa) horarios.push(AF.paraHora(m));
    }
    return horarios;
  };

  /** Verifica as regras fixas de um horário. Retorna lista de códigos violados (vazia = ok). */
  AF.verificarRegrasDoHorario = function (data, hora, agora, cfg) {
    cfg = cfg || AF.CONFIG;
    var violacoes = [];
    var grade = AF.gerarHorariosDoDia(data, cfg);
    if (grade.length === 0) violacoes.push('DIA_SEM_ATENDIMENTO');
    else if (grade.indexOf(hora) === -1) violacoes.push('HORARIO_FORA_DA_GRADE');

    var dias = AF.diferencaDias(agora.data, data);
    var minutosAte = dias * 1440 + AF.paraMinutos(hora) - AF.paraMinutos(agora.hora);
    if (minutosAte < 0) violacoes.push('HORARIO_NO_PASSADO');
    else if (minutosAte < cfg.antecedenciaMinimaMinutos) violacoes.push('ANTECEDENCIA_INSUFICIENTE');
    if (dias > cfg.antecedenciaMaximaDias) violacoes.push('ANTECEDENCIA_EXCESSIVA');
    return violacoes;
  };

  AF.contarOcupacao = function (agendamentos, data, hora) {
    return agendamentos.filter(function (a) {
      return a.data === data && a.hora === hora && AF.STATUS_QUE_OCUPAM.indexOf(a.status) !== -1;
    }).length;
  };

  /** Intervalo de datas que a camada decisória precisa consultar na agenda. */
  AF.janelaDeBusca = function (data, agora, cfg) {
    cfg = cfg || AF.CONFIG;
    var inicio = data < agora.data ? data : agora.data;
    var baseBusca = data < agora.data ? agora.data : data;
    return { dataInicio: inicio, dataFim: AF.somarDias(baseBusca, cfg.janelaBuscaAlternativasDias) };
  };

  /**
   * Busca horários alternativos REAIS: dentro das regras e livres na agenda.
   * Ordenação objetiva e igual para todos: proximidade do horário pedido
   * (empate -> o mais cedo). A preferência de período (manhã/tarde) informada
   * pela própria pessoa é usada apenas como critério de ordenação.
   */
  AF.buscarAlternativas = function (p) {
    var cfg = p.cfg || AF.CONFIG;
    var inicioBusca = p.data < p.agora.data ? p.agora.data : p.data;
    var alvo = AF.diferencaDias(p.agora.data, p.data) * 1440 + AF.paraMinutos(p.hora);
    var candidatos = [];
    for (var i = 0; i <= cfg.janelaBuscaAlternativasDias; i++) {
      var dia = AF.somarDias(inicioBusca, i);
      AF.gerarHorariosDoDia(dia, cfg).forEach(function (h) {
        if (dia === p.data && h === p.hora) return;
        if (AF.verificarRegrasDoHorario(dia, h, p.agora, cfg).length) return;
        if (AF.contarOcupacao(p.agendamentos, dia, h) >= cfg.capacidadePorHorario) return;
        var pos = AF.diferencaDias(p.agora.data, dia) * 1440 + AF.paraMinutos(h);
        candidatos.push({ data: dia, hora: h, distancia: Math.abs(pos - alvo), pos: pos });
      });
    }
    function noPeriodo(c) {
      if (p.preferencia === 'manha') return AF.paraMinutos(c.hora) < 720 ? 0 : 1;
      if (p.preferencia === 'tarde') return AF.paraMinutos(c.hora) >= 720 ? 0 : 1;
      return 0;
    }
    candidatos.sort(function (a, b) {
      return (noPeriodo(a) - noPeriodo(b)) || (a.distancia - b.distancia) || (a.pos - b.pos);
    });
    // Seleciona as mais próximas e as apresenta em ordem cronológica (mais fácil de ler).
    return candidatos.slice(0, cfg.maxAlternativas).sort(function (a, b) { return a.pos - b.pos; }).map(function (c) {
      return { data: c.data, hora: c.hora };
    });
  };

  /**
   * DECISÃO DO AGENTE (pura e determinística).
   * Entrada: { data, hora, servico, idAnonimo, agora, agendamentos, preferencia,
   *            necessitaRevisaoHumana, cfg }
   * Saída:   { status, resultadoVerificacao, acao, motivos[], alternativas[], protocoloExistente }
   */
  AF.decidir = function (e) {
    var cfg = e.cfg || AF.CONFIG;
    var S = AF.STATUS;
    var ags = e.agendamentos || [];

    // 1) Duplicidade: mesma pessoa, mesmo horário, solicitação ainda ativa.
    var duplicado = ags.filter(function (a) {
      return a.emailHash === e.idAnonimo && a.data === e.data && a.hora === e.hora &&
        AF.STATUS_ATIVOS.indexOf(a.status) !== -1;
    })[0];
    if (duplicado) {
      return {
        status: S.DUPLICADO, resultadoVerificacao: 'DUPLICADO', acao: 'INFORMAR_DUPLICIDADE',
        motivos: ['SOLICITACAO_DUPLICADA'], alternativas: [], protocoloExistente: duplicado.protocolo,
        statusExistente: duplicado.status
      };
    }

    // 2) Limite por pessoa no dia (igual para todos).
    var ativosNoDia = ags.filter(function (a) {
      return a.emailHash === e.idAnonimo && a.data === e.data && AF.STATUS_QUE_OCUPAM.indexOf(a.status) !== -1;
    }).length;
    if (ativosNoDia >= cfg.maxAgendamentosPorPessoaNoDia) {
      return {
        status: S.RECUSADO, resultadoVerificacao: 'LIMITE_ATINGIDO', acao: 'RECUSAR',
        motivos: ['LIMITE_DIARIO_POR_PESSOA'], alternativas: []
      };
    }

    // 3) Regras fixas e 4) ocupação.
    var violacoes = AF.verificarRegrasDoHorario(e.data, e.hora, e.agora, cfg);
    var ocupado = violacoes.length === 0 &&
      AF.contarOcupacao(ags, e.data, e.hora) >= cfg.capacidadePorHorario;

    if (violacoes.length || ocupado) {
      var motivos = ocupado ? ['HORARIO_OCUPADO'] : violacoes;
      var alternativas = AF.buscarAlternativas({
        data: e.data, hora: e.hora, agora: e.agora, agendamentos: ags,
        preferencia: e.preferencia, cfg: cfg
      });
      if (alternativas.length === 0) {
        return {
          status: S.RECUSADO, resultadoVerificacao: ocupado ? 'OCUPADO' : 'FORA_DAS_REGRAS',
          acao: 'RECUSAR', motivos: motivos.concat(['SEM_ALTERNATIVAS']), alternativas: []
        };
      }
      return {
        status: S.AGUARDANDO_ESCOLHA, resultadoVerificacao: ocupado ? 'OCUPADO' : 'FORA_DAS_REGRAS',
        acao: 'SUGERIR_ALTERNATIVAS', motivos: motivos, alternativas: alternativas
      };
    }

    // 5) Horário livre, mas a solicitação precisa de uma pessoa (pré-reserva).
    if (e.necessitaRevisaoHumana) {
      return {
        status: S.EM_REVISAO_HUMANA, resultadoVerificacao: 'DISPONIVEL',
        acao: 'ENCAMINHAR_REVISAO_HUMANA', motivos: ['HORARIO_LIVRE', 'NECESSITA_ATENDIMENTO_HUMANO'],
        alternativas: []
      };
    }

    // 6) Horário livre e dentro das regras.
    return {
      status: S.CONFIRMADO, resultadoVerificacao: 'DISPONIVEL', acao: 'REGISTRAR_CONFIRMACAO',
      motivos: ['HORARIO_LIVRE'], alternativas: []
    };
  };

  /** Texto de justificativa, montado a partir dos códigos (sem dados pessoais). */
  AF.gerarJustificativa = function (decisao, data, hora) {
    var alvo = data && hora ? (AF.formatarDataBR(data) + ' ' + hora) : 'horário não verificado';
    var partes = decisao.motivos.map(function (c) { return AF.MOTIVOS[c] || c; });
    var txt = 'Solicitação para ' + alvo + ': ' + partes.join(' ');
    if (decisao.alternativas && decisao.alternativas.length) {
      txt += ' Alternativas livres verificadas: ' + decisao.alternativas.map(function (a) {
        return AF.formatarDataBR(a.data) + ' ' + a.hora;
      }).join(', ') + ' (não reservadas).';
    }
    return txt;
  };
})(AgendaFacil);
