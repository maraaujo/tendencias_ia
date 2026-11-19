/**
 * AgendaFácil 2.0 — ORQUESTRADOR DO AGENTE + CAMADA 4: EXECUTIVA
 *
 *   Camada 1 Perceptiva  -> normaliza, valida, analisa texto livre
 *   Camada 2 Cognitiva   -> Gemini interpreta observações (opcional, com fallback)
 *   Camada 3 Decisória   -> regras verificáveis decidem (AF.decidir)
 *   Camada 4 Executiva   -> grava agenda, atualiza status, gera mensagem, registra log
 *
 * Dependências injetadas (`deps`):
 *   repo            repositório (planilha ou memória)
 *   gemini          cliente do Gemini ou null
 *   hash(texto)     SHA-256 com sal -> identificador anônimo
 *   agora()         { data:'AAAA-MM-DD', hora:'HH:MM', iso }
 *   gerarProtocolo  function(agora) -> 'AF-AAAAMMDD-XXXXXX'
 *   bloqueio(fn)    exclusão mútua (LockService no Apps Script)
 *   cfg             configuração (opcional)
 */
var AgendaFacil = AgendaFacil || {};

(function (AF) {
  'use strict';

  /** Executa uma ação somente se ela estiver na lista de permissões do agente. */
  AF.executarAcao = function (nome, fn) {
    if (AF.ACOES_PERMITIDAS.indexOf(nome) === -1) {
      throw new Error('Ação não permitida para o agente: ' + nome);
    }
    return fn();
  };

  function dadosParaRedacao(protocolo, sol, decisao) {
    return {
      status: decisao.status,
      protocolo: protocolo,
      protocolo_existente: decisao.protocoloExistente || '',
      servico: sol.servico || '',
      data_solicitada: sol.data ? AF.formatarDataBR(sol.data) : '',
      hora_solicitada: sol.hora || '',
      alternativas: (decisao.alternativas || []).map(function (a) {
        return { data: AF.formatarDataBR(a.data), hora: a.hora };
      }),
      motivos: decisao.motivos.map(function (c) { return { codigo: c, descricao: AF.MOTIVOS[c] || c }; })
    };
  }

  function permitidoNaMensagem(dados) {
    var datas = [], horas = [];
    if (dados.data_solicitada) datas.push(dados.data_solicitada);
    if (dados.hora_solicitada) horas.push(dados.hora_solicitada);
    dados.alternativas.forEach(function (a) { datas.push(a.data); horas.push(a.hora); });
    return {
      status: dados.status, datas: datas, horas: horas,
      protocolos: [dados.protocolo, dados.protocolo_existente].filter(Boolean)
    };
  }

  /**
   * Processa uma solicitação de agendamento de ponta a ponta.
   * Retorna o objeto que o Make usa para enviar o e-mail. Não contém e-mail nem nome.
   */
  AF.processarSolicitacao = function (entrada, deps) {
    var cfg = deps.cfg || AF.CONFIG;
    var S = AF.STATUS;
    var agora = deps.agora();
    var protocolo = deps.gerarProtocolo(agora);
    var flags = [];
    var usoIA = { interpretacao: 'NAO_NECESSARIA', redacao: 'NAO_UTILIZADA' };
    var bloqueio = deps.bloqueio || function (fn) { return fn(); };

    // ===================== CAMADA 1 — PERCEPTIVA =====================
    var sol = AF.normalizarEntrada(entrada);
    var ctx = AF.criarContextoTemporario(sol);
    var validacao = AF.validarSolicitacao(sol, cfg);
    var decisao, emailHash = '', interp = null, prev = null, vinculoValido = false;

    try {
      if (!validacao.valido) {
        decisao = {
          status: S.DADOS_INVALIDOS, resultadoVerificacao: 'NAO_VERIFICADO',
          acao: 'SOLICITAR_CORRECAO', motivos: validacao.erros, alternativas: []
        };
        return finalizar(false);
      }
      emailHash = deps.hash(sol.email);
      var analise = AF.analisarTextoLivre(sol.observacoes);
      if (analise.suspeitaInjecao) flags.push('SUSPEITA_MANIPULACAO:' + analise.padroes.join('+'));
      if (analise.possivelDadoSensivel) flags.push('POSSIVEL_DADO_SENSIVEL');

      // ===================== CAMADA 2 — COGNITIVA =====================
      if (sol.observacoes) {
        if (analise.suspeitaInjecao) usoIA.interpretacao = 'BLOQUEADA_POR_SEGURANCA';
        else if (analise.possivelDadoSensivel) usoIA.interpretacao = 'BLOQUEADA_DADO_SENSIVEL';
        else if (!deps.gemini) usoIA.interpretacao = 'NAO_CONFIGURADA';
        else {
          var r = AF.interpretarSolicitacao(deps.gemini,
            { servico: sol.servico, observacoes: analise.textoMascarado }, cfg);
          if (r.ok) {
            interp = r.dados;
            usoIA.interpretacao = 'OK';
            if (interp.tentativa_de_instrucao) flags.push('IA_DETECTOU_INSTRUCAO');
          } else {
            usoIA.interpretacao = 'FALHA:' + r.erro;
            flags.push('IA_INDISPONIVEL');
          }
        }
      }
      // Sinal de IA só pode PEDIR revisão humana (mais cautela), nunca confirmar.
      // Se houve tentativa de manipulação, o sinal da IA é desconsiderado.
      var pedeHumano = !!(interp && interp.necessita_atendimento_humano && !interp.tentativa_de_instrucao);
      var preferencia = interp ? interp.preferencia_periodo : 'indiferente';

      // ===================== CAMADA 3 — DECISÓRIA (com bloqueio) =====================
      return bloqueio(function () {
        var agendamentos;
        try {
          agendamentos = deps.repo.listarAgendamentos(AF.janelaDeBusca(sol.data, agora, cfg));
          if (sol.protocoloAnterior) prev = deps.repo.buscarPorProtocolo(sol.protocoloAnterior);
        } catch (e) {
          decisao = {
            status: S.ERRO_TEMPORARIO, resultadoVerificacao: 'NAO_VERIFICADO',
            acao: 'ADIAR_E_NOTIFICAR_EQUIPE', motivos: ['FALHA_CONSULTA_AGENDA'], alternativas: []
          };
          flags.push('FALHA_PLANILHA_LEITURA');
          return finalizar(false);
        }

        if (sol.protocoloAnterior) {
          if (!prev) flags.push('PROTOCOLO_ANTERIOR_INEXISTENTE');
          else if (prev.emailHash !== emailHash) flags.push('PROTOCOLO_ANTERIOR_NAO_PERTENCE');
          else if (prev.status !== S.AGUARDANDO_ESCOLHA) flags.push('PROTOCOLO_ANTERIOR_NAO_ABERTO');
          else vinculoValido = true;
        }

        decisao = AF.decidir({
          data: sol.data, hora: sol.hora, servico: sol.servico, idAnonimo: emailHash,
          agora: agora, agendamentos: agendamentos, preferencia: preferencia,
          necessitaRevisaoHumana: pedeHumano, cfg: cfg
        });

        // ===================== CAMADA 4 — EXECUTIVA =====================
        if (decisao.status !== S.DUPLICADO) {
          try {
            AF.executarAcao('REGISTRAR_AGENDAMENTO', function () {
              deps.repo.inserirAgendamento({
                protocolo: protocolo, criadoEm: agora.iso, data: sol.data, hora: sol.hora,
                servico: sol.servico, status: decisao.status, emailHash: emailHash,
                alternativas: JSON.stringify(decisao.alternativas),
                protocoloAnterior: vinculoValido ? sol.protocoloAnterior : '', atualizadoEm: agora.iso
              });
            });
          } catch (e) {
            flags.push('FALHA_PLANILHA_ESCRITA');
            decisao = {
              status: S.ERRO_TEMPORARIO, resultadoVerificacao: decisao.resultadoVerificacao,
              acao: 'ADIAR_E_NOTIFICAR_EQUIPE', motivos: ['FALHA_GRAVACAO_AGENDA'], alternativas: []
            };
            return finalizar(false);
          }
          var resolveuEscolha = decisao.status === S.CONFIRMADO || decisao.status === S.EM_REVISAO_HUMANA;
          if (vinculoValido && resolveuEscolha) {
            try {
              AF.executarAcao('ATUALIZAR_STATUS', function () {
                deps.repo.atualizarStatus(sol.protocoloAnterior, S.SUBSTITUIDO, agora.iso);
              });
            } catch (e) { flags.push('FALHA_ATUALIZAR_PROTOCOLO_ANTERIOR'); }
          }
        }
        return finalizar(true);
      });
    } finally {
      AF.descartarContexto(ctx);
    }

    function finalizar(verificado) {
      var dados = dadosParaRedacao(protocolo, sol, decisao);
      // DADOS_INVALIDOS: o texto pode conter lixo/ataques; usa-se mensagem-modelo.
      var cliente = decisao.status === S.DADOS_INVALIDOS ? null : deps.gemini;
      var msg = AF.executarAcao('GERAR_MENSAGEM', function () {
        return AF.redigirMensagem(cliente, dados, permitidoNaMensagem(dados));
      });
      usoIA.redacao = cliente ? msg.uso : 'NAO_UTILIZADA';
      if (cliente && !msg.geradaPorIA) flags.push('MENSAGEM_PADRAO_USADA');

      var justificativa = AF.gerarJustificativa(decisao, sol.data, sol.hora);
      var registro = AF.montarRegistroDecisao({
        registradoEm: agora.iso, protocolo: protocolo, data: sol.data, hora: sol.hora,
        servico: sol.servico, decisao: decisao, justificativa: justificativa,
        usoIA: usoIA, flags: flags
      });
      try {
        AF.executarAcao('REGISTRAR_DECISAO', function () { deps.repo.registrarDecisao(registro); });
      } catch (e) { flags.push('FALHA_REGISTRO_LOG'); }

      return {
        ok: true,
        protocolo: protocolo,
        status: decisao.status,
        verificadoNaAgenda: verificado,
        requerRevisaoHumana: decisao.status === S.EM_REVISAO_HUMANA || decisao.status === S.ERRO_TEMPORARIO,
        horario: sol.data && sol.hora ? { data: sol.data, hora: sol.hora } : null,
        alternativas: decisao.alternativas,
        protocoloExistente: decisao.protocoloExistente || null,
        motivos: decisao.motivos,
        justificativa: justificativa,
        mensagem: { assunto: msg.assunto, corpo: msg.corpo, geradaPorIA: msg.geradaPorIA },
        flags: flags
      };
    }
  };

  /**
   * Consulta o estado de uma solicitação. Exige protocolo E o mesmo e-mail usado
   * no pedido (comparado por hash). Para dados que não conferem, a resposta é
   * idêntica à de "não encontrado" — não revela se o protocolo existe.
   */
  AF.consultarStatus = function (entrada, deps) {
    var protocolo = AF.limparTexto(entrada && entrada.protocolo).toUpperCase();
    var email = AF.limparTexto(entrada && entrada.email).toLowerCase();
    var naoEncontrado = { ok: true, encontrado: false, mensagem: 'Não encontramos solicitação para os dados informados.' };
    var agora = deps.agora();
    var resultado = 'NAO_ENCONTRADO';
    var resposta = naoEncontrado;
    if (/^AF-\d{8}-[A-Z0-9]{6}$/.test(protocolo) && AF.emailValido(email)) {
      var reg;
      try { reg = deps.repo.buscarPorProtocolo(protocolo); }
      catch (e) { return { ok: false, erro: 'FALHA_CONSULTA_AGENDA' }; }
      if (reg && reg.emailHash === deps.hash(email)) {
        resultado = 'ENCONTRADO';
        var alts = [];
        try { alts = reg.alternativas ? JSON.parse(reg.alternativas) : []; } catch (e) { alts = []; }
        resposta = {
          ok: true, encontrado: true, protocolo: reg.protocolo, status: reg.status,
          data: reg.data, hora: reg.hora, servico: reg.servico, alternativas: alts
        };
      } else if (reg) {
        resultado = 'NEGADO_TITULAR_DIVERGENTE';
      }
    }
    try {
      deps.repo.registrarDecisao(AF.montarRegistroDecisao({
        registradoEm: agora.iso, protocolo: protocolo.slice(0, 20), evento: 'CONSULTA_STATUS',
        statusFinal: resultado
      }));
    } catch (e) { /* consulta não depende do log */ }
    return resposta;
  };

  /** Transições que uma pessoa da equipe pode fazer na revisão humana. */
  AF.TRANSICOES_REVISAO = {
    EM_REVISAO_HUMANA: ['CONFIRMADO', 'RECUSADO'],
    CONFIRMADO: ['CANCELADO'],
    AGUARDANDO_ESCOLHA: ['RECUSADO'],
    ERRO_TEMPORARIO: ['CONFIRMADO', 'RECUSADO'],
    RECUSADO: ['CONFIRMADO']
  };

  /**
   * Revisão humana de uma decisão. Para confirmar, as regras de disponibilidade
   * são verificadas novamente (a pessoa não pode criar conflito sem perceber).
   * p: { protocolo, novoStatus, revisor, motivo }
   */
  AF.revisarDecisao = function (p, deps) {
    var cfg = deps.cfg || AF.CONFIG;
    var agora = deps.agora();
    var reg = deps.repo.buscarPorProtocolo(p.protocolo);
    if (!reg) return { ok: false, erro: 'PROTOCOLO_NAO_ENCONTRADO' };
    var permitidas = AF.TRANSICOES_REVISAO[reg.status] || [];
    if (permitidas.indexOf(p.novoStatus) === -1) {
      return { ok: false, erro: 'TRANSICAO_NAO_PERMITIDA', de: reg.status, para: p.novoStatus };
    }
    if (!AF.limparTexto(p.motivo)) return { ok: false, erro: 'MOTIVO_OBRIGATORIO' };
    if (p.novoStatus === 'CONFIRMADO') {
      var outros = deps.repo.listarAgendamentos({ dataInicio: reg.data, dataFim: reg.data })
        .filter(function (a) { return a.protocolo !== reg.protocolo; });
      if (AF.contarOcupacao(outros, reg.data, reg.hora) >= cfg.capacidadePorHorario) {
        return { ok: false, erro: 'HORARIO_OCUPADO' };
      }
    }
    deps.repo.atualizarStatus(reg.protocolo, p.novoStatus, agora.iso);
    deps.repo.registrarDecisao(AF.montarRegistroDecisao({
      registradoEm: agora.iso, protocolo: reg.protocolo, evento: 'REVISAO_HUMANA',
      data: reg.data, hora: reg.hora, servico: reg.servico,
      justificativa: 'Revisão humana: ' + reg.status + ' -> ' + p.novoStatus + '. Motivo: ' + AF.limparTexto(p.motivo).slice(0, 200),
      statusFinal: p.novoStatus, responsavel: p.revisor || 'equipe'
    }));
    return { ok: true, protocolo: reg.protocolo, de: reg.status, para: p.novoStatus };
  };
})(AgendaFacil);
