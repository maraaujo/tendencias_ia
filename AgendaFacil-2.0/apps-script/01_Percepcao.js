/**
 * AgendaFácil 2.0 — CAMADA 1: PERCEPTIVA
 *
 * Recebe os dados brutos vindos do Google Forms (via Make), normaliza,
 * valida e analisa o texto livre em busca de tentativas de manipulação
 * (prompt injection) e de dados pessoais que não deveriam circular.
 *
 * Funções puras: não acessam rede nem planilha.
 */
var AgendaFacil = AgendaFacil || {};

(function (AF) {
  'use strict';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** Remove caracteres de controle e espaços repetidos. */
  AF.limparTexto = function (valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
      .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  /** Aceita AAAA-MM-DD, AAAA-MM-DDTHH:MM... (ISO) ou DD/MM/AAAA. Retorna AAAA-MM-DD ou null. */
  AF.normalizarData = function (valor) {
    var t = AF.limparTexto(valor);
    var a, m, d, r;
    if ((r = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/.exec(t))) { a = +r[1]; m = +r[2]; d = +r[3]; }
    else if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) { d = +r[1]; m = +r[2]; a = +r[3]; }
    else return null;
    var dt = new Date(Date.UTC(a, m - 1, d));
    if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return a + '-' + pad2(m) + '-' + pad2(d);
  };

  /** Aceita HH:MM, HH:MM:SS, 14h, 14h30. Retorna HH:MM ou null. */
  AF.normalizarHora = function (valor) {
    var t = AF.limparTexto(valor).toLowerCase();
    var r = /^(\d{1,2}):(\d{2})(:\d{2})?$/.exec(t) || /^(\d{1,2})h(\d{2})?$/.exec(t);
    if (!r) return null;
    var h = +r[1], m = r[2] ? +r[2] : 0;
    if (h > 23 || m > 59) return null;
    return pad2(h) + ':' + pad2(m);
  };

  AF.emailValido = function (email) {
    if (!email || email.length > AF.CONFIG.limites.email) return false;
    if (/\.\./.test(email)) return false;
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email);
  };

  function consentiu(valor) {
    if (valor === true) return true;
    var t = AF.limparTexto(valor).toLowerCase();
    return /^(sim|true|aceito|concordo|li e concordo|autorizo)/.test(t);
  }

  /**
   * Converte a entrada bruta em um objeto padronizado.
   * Somente campos conhecidos são lidos: qualquer outro campo é descartado
   * (minimização de dados). O NOME não é necessário para decidir e não é lido.
   */
  AF.normalizarEntrada = function (bruto) {
    bruto = bruto || {};
    return {
      email: AF.limparTexto(bruto.email).toLowerCase(),
      dataBruta: AF.limparTexto(bruto.data),
      horaBruta: AF.limparTexto(bruto.hora),
      data: AF.normalizarData(bruto.data),
      hora: AF.normalizarHora(bruto.hora),
      servico: AF.limparTexto(bruto.servico),
      observacoes: AF.limparTexto(bruto.observacoes),
      consentimento: consentiu(bruto.consentimento),
      protocoloAnterior: AF.limparTexto(bruto.protocoloAnterior).toUpperCase()
    };
  };

  /** Valida a solicitação normalizada. Retorna { valido, erros: [códigos] }. */
  AF.validarSolicitacao = function (s, cfg) {
    cfg = cfg || AF.CONFIG;
    var erros = [];
    if (!s.email) erros.push('EMAIL_OBRIGATORIO');
    else if (!AF.emailValido(s.email)) erros.push('EMAIL_INVALIDO');
    if (!s.dataBruta) erros.push('DATA_OBRIGATORIA');
    else if (!s.data) erros.push('DATA_INVALIDA');
    if (!s.horaBruta) erros.push('HORA_OBRIGATORIA');
    else if (!s.hora) erros.push('HORA_INVALIDA');
    if (!s.servico) erros.push('SERVICO_OBRIGATORIO');
    else if (cfg.servicos.indexOf(s.servico) === -1) erros.push('SERVICO_INVALIDO');
    if (!s.consentimento) erros.push('CONSENTIMENTO_AUSENTE');
    if (s.observacoes.length > cfg.limites.observacoes) erros.push('OBSERVACOES_MUITO_LONGAS');
    if (s.protocoloAnterior && !/^AF-\d{8}-[A-Z0-9]{6}$/.test(s.protocoloAnterior)) {
      erros.push('PROTOCOLO_ANTERIOR_INVALIDO');
    }
    return { valido: erros.length === 0, erros: erros };
  };

  function semAcento(t) {
    return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /** Padrões típicos de tentativa de manipulação das instruções do agente. */
  var PADROES_INJECAO = [
    { id: 'IGNORAR_INSTRUCOES', re: /\b(ignore|ignora|ignorar|desconsidere|desconsiderar|esqueca|esquecer|disregard)\b.{0,40}\b(instruc|regra|prompt|anterior|instruction|rule)/ },
    { id: 'PROMPT_DE_SISTEMA', re: /(system\s*prompt|prompt\s*(do|de)\s*sistema|instrucoes\s*(do|de)\s*sistema)/ },
    { id: 'TROCA_DE_PAPEL', re: /\b(aja|atue|finja|act|pretend)\b.{0,15}\b(como|as|ser)\b|\bvoce\s+agora\s+e\b|\bmodo\s+(desenvolvedor|admin)|developer\s*mode|jailbreak/ },
    { id: 'FORCAR_DECISAO', re: /\b(confirme|confirmar|confirma|aprove|aprovar|aprova|force|forcar|garanta|reserve)\b.{0,40}\b(agendamento|horario|reserva|vaga|status)/ },
    { id: 'ALTERAR_CAMPO', re: /\b(status|resultado|decisao|prioridade)\s*[:=]/ },
    { id: 'EXFILTRACAO', re: /\b(liste|listar|mostre|mostrar|revele|revelar|exiba|envie|informe)\b.{0,40}\b(agendamentos|e-?mails|dados|clientes|usuarios|chave|api|senha|token)/ },
    { id: 'MARCACAO_SUSPEITA', re: /<\s*\/?\s*(script|system|instruc|dados)|```|\{\{|\}\}/ }
  ];

  /** Termos que indicam dado pessoal sensível (LGPD art. 5º, II) — não são enviados à IA. */
  var TERMOS_SENSIVEIS = /\b(diagnostic\w*|doenca|hiv|cancer|gravidez|gestante|religiao|orientacao sexual|sindicato|deficiencia|cid\s?-?\d|laudo|medicament\w*)\b/;

  /**
   * Analisa o texto livre (observações).
   * Retorna { suspeitaInjecao, padroes, possivelDadoSensivel, textoMascarado }.
   * O texto mascarado remove identificadores (CPF, cartões, e-mails, telefones).
   */
  AF.analisarTextoLivre = function (texto) {
    var t = AF.limparTexto(texto);
    var norm = semAcento(t);
    var padroes = [];
    PADROES_INJECAO.forEach(function (p) { if (p.re.test(norm)) padroes.push(p.id); });
    var mascarado = t
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[E-MAIL REMOVIDO]')
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[DOCUMENTO REMOVIDO]')
      .replace(/\b(?:\d[ -]?){13,19}\b/g, '[NUMERO REMOVIDO]')
      .replace(/(\(?\b\d{2}\)?\s?)?\b9?\d{4}-?\d{4}\b/g, '[TELEFONE REMOVIDO]');
    return {
      suspeitaInjecao: padroes.length > 0,
      padroes: padroes,
      possivelDadoSensivel: TERMOS_SENSIVEIS.test(norm),
      textoMascarado: mascarado
    };
  };
})(AgendaFacil);
