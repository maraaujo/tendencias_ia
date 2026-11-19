/**
 * AgendaFácil 2.0 — CAMADA 2: COGNITIVA (e redação assistida por IA)
 *
 * Cliente da API do Gemini com:
 *  - saída estruturada (JSON + responseSchema) e validação local do esquema;
 *  - tratamento de falhas (rede, HTTP, resposta vazia, JSON inválido);
 *  - guardrails sobre o texto gerado (não pode inventar datas/horas nem
 *    "confirmar" o que não foi confirmado);
 *  - mensagens-modelo determinísticas para quando a IA falha.
 *
 * O transporte HTTP é injetado (`http`), para funcionar com UrlFetchApp
 * no Apps Script e com um cliente simulado nos testes locais.
 */
var AgendaFacil = AgendaFacil || {};

(function (AF) {
  'use strict';

  function ErroIA(codigo) {
    var e = new Error(codigo);
    e.codigo = codigo;
    return e;
  }

  /** Validação mínima de esquema (OBJECT, STRING, BOOLEAN, ARRAY, enum, maxLength, required). */
  AF.validarEsquema = function (valor, esquema, caminho) {
    caminho = caminho || '$';
    var tipo = String(esquema.type).toLowerCase();
    var erros = [];
    if (tipo === 'object') {
      if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return [caminho + ': deve ser objeto'];
      (esquema.required || []).forEach(function (k) {
        if (!(k in valor)) erros.push(caminho + '.' + k + ': obrigatório');
      });
      Object.keys(esquema.properties || {}).forEach(function (k) {
        if (k in valor) erros = erros.concat(AF.validarEsquema(valor[k], esquema.properties[k], caminho + '.' + k));
      });
    } else if (tipo === 'string') {
      if (typeof valor !== 'string') return [caminho + ': deve ser texto'];
      if (esquema.enum && esquema.enum.indexOf(valor) === -1) erros.push(caminho + ': valor fora da lista');
      if (esquema.maxLength && valor.length > esquema.maxLength) erros.push(caminho + ': texto longo demais');
    } else if (tipo === 'boolean') {
      if (typeof valor !== 'boolean') erros.push(caminho + ': deve ser booleano');
    } else if (tipo === 'array') {
      if (!Array.isArray(valor)) return [caminho + ': deve ser lista'];
      valor.forEach(function (v, i) { erros = erros.concat(AF.validarEsquema(v, esquema.items, caminho + '[' + i + ']')); });
    }
    return erros;
  };

  /** Remove chaves que só usamos na validação local (ex.: maxLength) antes de enviar ao Gemini. */
  function esquemaParaGemini(esquema) {
    var copia = {};
    Object.keys(esquema).forEach(function (k) {
      if (k === 'maxLength') return;
      if (k === 'properties') {
        copia.properties = {};
        Object.keys(esquema.properties).forEach(function (p) {
          copia.properties[p] = esquemaParaGemini(esquema.properties[p]);
        });
      } else if (k === 'items') copia.items = esquemaParaGemini(esquema.items);
      else copia[k] = esquema[k];
    });
    return copia;
  }

  /**
   * Cria o cliente do Gemini. Retorna null se não houver chave configurada
   * (o agente continua funcionando com mensagens-modelo).
   * opcoes: { apiKey, modelo, temperatura, http: function(req) -> {status, corpo} }
   */
  AF.criarClienteGemini = function (opcoes) {
    if (!opcoes || !opcoes.apiKey || typeof opcoes.http !== 'function') return null;
    var modelo = opcoes.modelo || AF.CONFIG.gemini.modelo;
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(modelo) + ':generateContent';

    return {
      modelo: modelo,
      /** Envia instrução + dados e devolve o objeto JSON validado. Lança ErroIA. */
      gerarJSON: function (prompt, dados, parametros) {
        var corpo = {
          systemInstruction: { parts: [{ text: AF.montarInstrucao(prompt, parametros) }] },
          contents: [{ role: 'user', parts: [{ text: AF.montarBlocoDeDados(prompt.rotuloDados, dados) }] }],
          generationConfig: {
            temperature: opcoes.temperatura !== undefined ? opcoes.temperatura : AF.CONFIG.gemini.temperatura,
            responseMimeType: 'application/json',
            responseSchema: esquemaParaGemini(prompt.esquema)
          }
        };
        var resp;
        try {
          resp = opcoes.http({
            url: url,
            metodo: 'POST',
            cabecalhos: { 'Content-Type': 'application/json', 'x-goog-api-key': opcoes.apiKey },
            corpo: JSON.stringify(corpo)
          });
        } catch (e) {
          throw ErroIA('IA_FALHA_COMUNICACAO'); // a mensagem original pode conter URL/cabeçalhos: não é propagada
        }
        if (!resp || resp.status !== 200) throw ErroIA('IA_HTTP_' + (resp ? resp.status : 'SEM_RESPOSTA'));
        var texto;
        try {
          var json = JSON.parse(resp.corpo);
          texto = json.candidates[0].content.parts[0].text;
        } catch (e) {
          throw ErroIA('IA_RESPOSTA_VAZIA_OU_BLOQUEADA');
        }
        var obj;
        try { obj = JSON.parse(texto); } catch (e) { throw ErroIA('IA_JSON_INVALIDO'); }
        if (AF.validarEsquema(obj, prompt.esquema).length) throw ErroIA('IA_FORA_DO_ESQUEMA');
        return obj;
      }
    };
  };

  /** Camada cognitiva: interpreta o texto livre. Nunca lança; retorna { ok, dados | erro }. */
  AF.interpretarSolicitacao = function (cliente, entrada, cfg) {
    cfg = cfg || AF.CONFIG;
    try {
      var dados = cliente.gerarJSON(AF.PROMPTS.interpretacao,
        { servico: entrada.servico, observacoes: entrada.observacoes },
        { SERVICOS: cfg.servicos.join(', ') });
      return { ok: true, dados: dados };
    } catch (e) {
      return { ok: false, erro: e.codigo || 'IA_ERRO_DESCONHECIDO' };
    }
  };

  /**
   * Guardrail sobre o texto gerado: toda data/hora citada precisa estar entre as
   * permitidas; "confirmado" só pode aparecer se o status for CONFIRMADO; sem
   * links, e-mails ou telefones; deve conter o marcador [NOME] no máximo uma vez.
   */
  AF.validarMensagemGerada = function (texto, permitido) {
    var problemas = [];
    (String(texto).match(/AF-\d{8}-[A-Z0-9]{6}/g) || []).forEach(function (p) {
      if ((permitido.protocolos || []).indexOf(p) === -1) problemas.push('PROTOCOLO_NAO_PERMITIDO:' + p);
    });
    texto = String(texto).replace(/AF-\d{8}-[A-Z0-9]{6}/g, '[PROTOCOLO]');
    var horas = texto.match(/\b\d{1,2}[:h]\d{2}\b/g) || [];
    horas.forEach(function (h) {
      var n = AF.normalizarHora(h);
      if (permitido.horas.indexOf(n) === -1) problemas.push('HORA_NAO_PERMITIDA:' + h);
    });
    var datas = texto.match(/\b\d{2}\/\d{2}(\/\d{4})?\b/g) || [];
    datas.forEach(function (d) {
      var ok = permitido.datas.some(function (p) { return p === d || p.slice(0, 5) === d; });
      if (!ok) problemas.push('DATA_NAO_PERMITIDA:' + d);
    });
    if (permitido.status !== 'CONFIRMADO') {
      var semNegacao = texto.toLowerCase().replace(/n[aã]o\s+(est[aá]|foi|ser[aá]|fica)?\s*confirmad/g, '');
      if (/confirmad[oa]/.test(semNegacao)) problemas.push('CONFIRMACAO_INDEVIDA');
    }
    if (/https?:\/\/|www\.|@[a-z0-9-]+\.|\b\d{4,5}-?\d{4}\b/i.test(texto)) problemas.push('CONTEUDO_NAO_PERMITIDO');
    return { valida: problemas.length === 0, problemas: problemas };
  };

  /** Mensagens-modelo determinísticas (usadas sem IA ou quando a IA falha/é rejeitada). */
  AF.mensagemPadrao = function (d) {
    var alvo = d.data_solicitada && d.hora_solicitada ? d.data_solicitada + ' às ' + d.hora_solicitada : '';
    var motivos = (d.motivos || []).map(function (m) { return m.descricao; }).join(' ');
    var alt = (d.alternativas || []).map(function (a) { return '- ' + a.data + ' às ' + a.hora; }).join('\n');
    var S = AF.STATUS;
    var assunto, corpo;
    switch (d.status) {
      case S.CONFIRMADO:
        assunto = 'Agendamento confirmado — protocolo ' + d.protocolo;
        corpo = 'Olá, [NOME]!\n\nSeu agendamento de ' + d.servico + ' está confirmado para ' + alvo + '.\nProtocolo: ' + d.protocolo + '.';
        break;
      case S.AGUARDANDO_ESCOLHA:
        assunto = 'Horário indisponível — escolha uma alternativa';
        corpo = 'Olá, [NOME]!\n\nNão foi possível agendar ' + alvo + '. ' + motivos +
          '\n\nHorários livres verificados agora (ainda NÃO reservados):\n' + alt +
          '\n\nPara escolher, envie um novo formulário com o horário desejado e informe o protocolo ' + d.protocolo + ' no campo "Protocolo anterior".';
        break;
      case S.EM_REVISAO_HUMANA:
        assunto = 'Solicitação em análise — protocolo ' + d.protocolo;
        corpo = 'Olá, [NOME]!\n\nRecebemos sua solicitação para ' + alvo + '. O horário foi pré-reservado e uma pessoa da equipe vai analisá-la e responder em breve.\nProtocolo: ' + d.protocolo + '.';
        break;
      case S.DUPLICADO:
        assunto = 'Solicitação já registrada';
        corpo = 'Olá, [NOME]!\n\nJá existe uma solicitação ativa sua para ' + alvo + ' (protocolo ' + d.protocolo_existente + '). Nenhum novo registro foi criado.';
        break;
      case S.DADOS_INVALIDOS:
        assunto = 'Não foi possível processar sua solicitação';
        corpo = 'Olá, [NOME]!\n\nSua solicitação não pôde ser processada: ' + motivos + '\nPor favor, envie o formulário novamente com os dados corrigidos.';
        break;
      case S.ERRO_TEMPORARIO:
        assunto = 'Solicitação recebida — verificação pendente';
        corpo = 'Olá, [NOME]!\n\nRecebemos sua solicitação (protocolo ' + d.protocolo + '), mas não foi possível verificar a agenda agora. Seu horário NÃO foi reservado. A equipe vai verificar e entrar em contato.';
        break;
      default:
        assunto = 'Solicitação não atendida';
        corpo = 'Olá, [NOME]!\n\nNão foi possível atender a solicitação para ' + alvo + '. ' + motivos +
          (alt ? '\n\nAlternativas:\n' + alt : '\nTente outra data pelo formulário.') + '\nProtocolo: ' + d.protocolo + '.';
    }
    return { assunto: assunto, mensagem: corpo };
  };

  AF.AVISO_IA = '\n\n—\nEsta mensagem foi redigida com auxílio de Inteligência Artificial (Google Gemini). ' +
    'A decisão foi tomada por regras automáticas verificáveis, aplicadas igualmente a todas as pessoas. ' +
    'Para pedir revisão humana, responda a este e-mail informando o protocolo.';
  AF.AVISO_SEM_IA = '\n\n—\nMensagem automática do AgendaFácil 2.0. ' +
    'A decisão foi tomada por regras automáticas verificáveis, aplicadas igualmente a todas as pessoas. ' +
    'Para pedir revisão humana, responda a este e-mail informando o protocolo.';

  /**
   * Gera a mensagem final: tenta o Gemini; se falhar ou violar o guardrail,
   * usa a mensagem-modelo. Retorna { assunto, corpo, geradaPorIA, uso }.
   */
  AF.redigirMensagem = function (cliente, dadosDecisao, permitido) {
    var uso = 'NAO_CONFIGURADA';
    if (cliente) {
      try {
        var r = cliente.gerarJSON(AF.PROMPTS.redacao, dadosDecisao, {});
        var g = AF.validarMensagemGerada(r.assunto + '\n' + r.mensagem, permitido);
        if (g.valida) {
          return { assunto: r.assunto, corpo: r.mensagem + AF.AVISO_IA, geradaPorIA: true, uso: 'OK' };
        }
        uso = 'REJEITADA_GUARDRAIL';
      } catch (e) {
        uso = 'FALHA:' + (e.codigo || 'IA_ERRO_DESCONHECIDO');
      }
    }
    var p = AF.mensagemPadrao(dadosDecisao);
    return { assunto: p.assunto, corpo: p.mensagem + AF.AVISO_SEM_IA, geradaPorIA: false, uso: uso };
  };

  /** Substitui o marcador [NOME] pelo primeiro nome (feito fora do agente, no Make). */
  AF.personalizarMensagem = function (corpo, nome) {
    var primeiro = AF.limparTexto(nome).split(' ')[0].replace(/[^\p{L}'-]/gu, '').slice(0, 40);
    return primeiro ? corpo.replace(/\[NOME\]/g, primeiro) : corpo.replace(/,?\s*\[NOME\]/g, '');
  };
})(AgendaFacil);
