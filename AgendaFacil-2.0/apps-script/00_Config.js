/**
 * AgendaFácil 2.0 — Configuração e regras de negócio.
 *
 * Este arquivo roda tanto no Google Apps Script quanto no Node.js (testes locais).
 * Todas as regras de disponibilidade ficam aqui, em um único lugar, e valem
 * igualmente para todos os usuários.
 *
 * NÃO coloque chaves de API neste arquivo. Credenciais ficam em
 * Propriedades do Script (Apps Script) ou em variáveis de ambiente (local).
 */
var AgendaFacil = AgendaFacil || {};

AgendaFacil.CONFIG = {
  versao: '2.0.0',
  versaoRegras: 'regras-2026-11',
  fusoHorario: 'America/Sao_Paulo',

  // Expediente: 1 = segunda ... 5 = sexta (0 = domingo, 6 = sábado)
  expediente: {
    diasSemana: [1, 2, 3, 4, 5],
    inicio: '08:00',
    fim: '18:00',
    pausas: [{ inicio: '12:00', fim: '13:00' }]
  },
  duracaoMinutos: 60,
  capacidadePorHorario: 1,
  antecedenciaMinimaMinutos: 120,
  antecedenciaMaximaDias: 60,
  janelaBuscaAlternativasDias: 7,
  maxAlternativas: 3,
  maxAgendamentosPorPessoaNoDia: 1,
  feriados: ['2026-11-20', '2026-12-25', '2027-01-01'],

  // Serviços aceitos (lista fechada: evita texto arbitrário no campo).
  servicos: ['Atendimento inicial', 'Retorno', 'Orientação'],

  limites: { observacoes: 300, email: 254 },

  // Retenção (LGPD — limitação do armazenamento)
  retencaoDias: { respostasFormulario: 90, logDecisoes: 365 },

  gemini: { modelo: 'gemini-2.5-flash', temperatura: 0.2 },

  abas: { agenda: 'Agenda', log: 'Log_Decisoes', respostas: 'Respostas ao formulário 1' }
};

/** Status possíveis de uma solicitação. */
AgendaFacil.STATUS = {
  CONFIRMADO: 'CONFIRMADO',
  AGUARDANDO_ESCOLHA: 'AGUARDANDO_ESCOLHA',
  EM_REVISAO_HUMANA: 'EM_REVISAO_HUMANA',
  RECUSADO: 'RECUSADO',
  DUPLICADO: 'DUPLICADO',
  DADOS_INVALIDOS: 'DADOS_INVALIDOS',
  ERRO_TEMPORARIO: 'ERRO_TEMPORARIO',
  SUBSTITUIDO: 'SUBSTITUIDO',
  CANCELADO: 'CANCELADO'
};

/** Status que ocupam vaga na agenda. Alternativas sugeridas NÃO ocupam vaga. */
AgendaFacil.STATUS_QUE_OCUPAM = ['CONFIRMADO', 'EM_REVISAO_HUMANA'];
/** Status considerados "ativos" para fins de duplicidade. */
AgendaFacil.STATUS_ATIVOS = ['CONFIRMADO', 'EM_REVISAO_HUMANA', 'AGUARDANDO_ESCOLHA'];

/**
 * Ações que o agente tem permissão de executar (camada executiva).
 * Qualquer outra ação é bloqueada. O agente não apaga registros, não envia
 * e-mails (o Make envia) e não altera regras.
 */
AgendaFacil.ACOES_PERMITIDAS = [
  'REGISTRAR_AGENDAMENTO',
  'ATUALIZAR_STATUS',
  'REGISTRAR_DECISAO',
  'GERAR_MENSAGEM'
];

/** Descrição legível de cada código de motivo (usada nas justificativas). */
AgendaFacil.MOTIVOS = {
  // Validação (camada perceptiva)
  EMAIL_OBRIGATORIO: 'O e-mail não foi informado.',
  EMAIL_INVALIDO: 'O e-mail informado não é válido.',
  DATA_OBRIGATORIA: 'A data desejada não foi informada.',
  DATA_INVALIDA: 'A data informada não é válida.',
  HORA_OBRIGATORIA: 'O horário desejado não foi informado.',
  HORA_INVALIDA: 'O horário informado não é válido.',
  SERVICO_OBRIGATORIO: 'O tipo de atendimento não foi informado.',
  SERVICO_INVALIDO: 'O tipo de atendimento não está entre as opções oferecidas.',
  CONSENTIMENTO_AUSENTE: 'O consentimento para tratamento dos dados não foi registrado.',
  OBSERVACOES_MUITO_LONGAS: 'O campo de observações excede o tamanho permitido.',
  PROTOCOLO_ANTERIOR_INVALIDO: 'O protocolo anterior não está no formato esperado.',
  // Regras (camada decisória)
  DIA_SEM_ATENDIMENTO: 'Não há atendimento na data solicitada (fim de semana ou feriado).',
  HORARIO_FORA_DA_GRADE: 'O horário solicitado não faz parte da grade de atendimento.',
  HORARIO_NO_PASSADO: 'O horário solicitado já passou.',
  ANTECEDENCIA_INSUFICIENTE: 'O horário solicitado não respeita a antecedência mínima.',
  ANTECEDENCIA_EXCESSIVA: 'A data solicitada ultrapassa o limite de antecedência máxima.',
  HORARIO_OCUPADO: 'O horário solicitado já está ocupado.',
  SEM_ALTERNATIVAS: 'Não há horários alternativos livres na janela de busca.',
  SOLICITACAO_DUPLICADA: 'Já existe uma solicitação ativa idêntica para este horário.',
  LIMITE_DIARIO_POR_PESSOA: 'Já existe um agendamento ativo para esta pessoa nesta data.',
  HORARIO_LIVRE: 'O horário está livre e atende a todas as regras.',
  NECESSITA_ATENDIMENTO_HUMANO: 'A solicitação contém necessidade que exige análise de uma pessoa da equipe.',
  // Infraestrutura
  FALHA_CONSULTA_AGENDA: 'Não foi possível consultar a agenda no momento.',
  FALHA_GRAVACAO_AGENDA: 'Não foi possível gravar o agendamento no momento.',
  REVISAO_HUMANA: 'Decisão revisada por uma pessoa da equipe.'
};
