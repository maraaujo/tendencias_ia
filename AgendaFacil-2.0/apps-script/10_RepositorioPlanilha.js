/**
 * AgendaFácil 2.0 — Repositório Google Sheets (somente Apps Script)
 *
 * Mesma interface do repositório em memória (04_Memoria.js):
 *   listarAgendamentos, buscarPorProtocolo, inserirAgendamento,
 *   atualizarStatus, registrarDecisao
 *
 * Todas as células são gravadas como texto (formato "@"), para que o
 * Sheets não converta "2026-11-24" ou "09:00" em datas automaticamente.
 */
var AgendaFacil = AgendaFacil || {};

(function (AF) {
  'use strict';

  function paraTexto(v, cfg) {
    if (Object.prototype.toString.call(v) === '[object Date]') {
      // Defesa extra: se alguém editar a célula manualmente e o Sheets converter em data.
      return Utilities.formatDate(v, cfg.fusoHorario, "yyyy-MM-dd'T'HH:mm");
    }
    return v === null || v === undefined ? '' : String(v);
  }

  AF.criarRepositorioPlanilha = function (planilha, cfg) {
    cfg = cfg || AF.CONFIG;
    var abaAgenda = planilha.getSheetByName(cfg.abas.agenda);
    var abaLog = planilha.getSheetByName(cfg.abas.log);
    if (!abaAgenda || !abaLog) {
      throw new Error('Abas "' + cfg.abas.agenda + '" e "' + cfg.abas.log + '" não encontradas. Execute configurarPlanilha().');
    }

    function lerAgenda() {
      var valores = abaAgenda.getDataRange().getValues();
      if (valores.length < 2) return [];
      var cab = valores[0].map(String);
      return valores.slice(1).map(function (linha, i) {
        var o = { _linha: i + 2 };
        AF.COLUNAS_AGENDA.forEach(function (c) {
          var idx = cab.indexOf(c);
          o[c] = idx === -1 ? '' : paraTexto(linha[idx], cfg);
        });
        // datas/horas gravadas como Date por edição manual
        o.data = o.data.slice(0, 10);
        if (o.hora.length > 5) o.hora = o.hora.slice(-5);
        return o;
      }).filter(function (o) { return o.protocolo; });
    }

    function semLinha(o) { var c = {}; Object.keys(o).forEach(function (k) { if (k !== '_linha') c[k] = o[k]; }); return c; }

    return {
      listarAgendamentos: function (filtro) {
        filtro = filtro || {};
        return lerAgenda().filter(function (a) {
          return (!filtro.dataInicio || a.data >= filtro.dataInicio) &&
            (!filtro.dataFim || a.data <= filtro.dataFim);
        }).map(semLinha);
      },
      buscarPorProtocolo: function (protocolo) {
        var r = lerAgenda().filter(function (a) { return a.protocolo === protocolo; })[0];
        return r ? semLinha(r) : null;
      },
      inserirAgendamento: function (reg) {
        abaAgenda.appendRow(AF.COLUNAS_AGENDA.map(function (c) { return paraTexto(reg[c], cfg); }));
      },
      atualizarStatus: function (protocolo, status, quando) {
        var r = lerAgenda().filter(function (a) { return a.protocolo === protocolo; })[0];
        if (!r) throw new Error('Protocolo não encontrado');
        var cab = abaAgenda.getRange(1, 1, 1, abaAgenda.getLastColumn()).getValues()[0].map(String);
        abaAgenda.getRange(r._linha, cab.indexOf('status') + 1).setValue(status);
        abaAgenda.getRange(r._linha, cab.indexOf('atualizadoEm') + 1).setValue(quando);
      },
      registrarDecisao: function (reg) {
        abaLog.appendRow(AF.COLUNAS_LOG.map(function (c) { return paraTexto(reg[c], cfg); }));
      }
    };
  };
})(AgendaFacil);
