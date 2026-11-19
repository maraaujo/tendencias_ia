# Testes e resultados — AgendaFácil 2.0

## Como executar

```bash
npm test
```

- Ambiente da execução registrada: Windows 11, Node.js v22.13.1, executor nativo `node:test`, sem dependências externas.
- Relógio fixo em **segunda-feira, 23/11/2026, 08:00** (testes reproduzíveis).
- O Gemini foi substituído por um **transporte HTTP simulado** que devolve respostas no formato da API real. Assim, o cliente real (`02_Cognicao.js`) é exercitado: montagem da requisição, leitura de `candidates[0].content.parts[0].text`, validação de esquema e tratamento de erros.
- O Google Sheets foi substituído por (a) um repositório em memória com a mesma interface e (b) um `SpreadsheetApp` simulado para testar `10_RepositorioPlanilha.js`.
- Dados 100% fictícios (domínio reservado `exemplo.com`).
- Saída bruta: [evidencias/saida-testes.txt](evidencias/saida-testes.txt).

## Resultado geral

**29 testes executados · 29 aprovados · 0 falhas.**

## Os 10 cenários exigidos

| # | Cenário | O que o teste faz | Resultado observado |
|---|---|---|---|
| T01 | Horário disponível | Pede 24/11 14:00 (livre) | ✅ `CONFIRMADO`, motivo `HORARIO_LIVRE`, registro na Agenda e no Log, aviso de IA na mensagem |
| T02 | Horário ocupado | Pede 24/11 10:00 (ocupado) | ✅ `AGUARDANDO_ESCOLHA`, alternativas 08:00, 13:00 e 14:00. Outra pessoa confirmou 08:00 em seguida (alternativas não são reservadas). A primeira pessoa escolheu 13:00 com o protocolo anterior: `CONFIRMADO`, e o pedido anterior virou `SUBSTITUIDO` |
| T03 | Dados incompletos | Data, hora, serviço e consentimento vazios | ✅ `DADOS_INVALIDOS` com 4 códigos; nenhuma linha nova na Agenda; **0 chamadas** ao Gemini |
| T04 | E-mail inválido | 6 variações (`sem-arroba.com`, `a@b`, `x@@...`, `nome..duplo@...`, com espaço, com `<script>`) | ✅ Todas rejeitadas com `EMAIL_INVALIDO` |
| T05 | Solicitação duplicada | Mesmo pedido duas vezes, o segundo com e-mail em maiúsculas e espaços | ✅ `DUPLICADO`, aponta o protocolo original, Agenda inalterada |
| T06 | Falha do Gemini | Erro de rede, HTTP 503, HTTP 429, texto não JSON, JSON fora do esquema | ✅ Nos 5 casos: `CONFIRMADO` mantido (regras), mensagem-modelo, flag `MENSAGEM_PADRAO_USADA`, log com `FALHA:IA_...`, chave ausente do estado |
| T07 | Falha da planilha | Leitura falha / gravação falha / só o log falha | ✅ `ERRO_TEMPORARIO` com "NÃO foi reservado" e `requerRevisaoHumana = true`; falha só do log → decisão mantida e flag `FALHA_REGISTRO_LOG` |
| T08 | Manipulação das instruções | 4 ataques nas observações (ignorar instruções, falso system prompt, troca de papel + exfiltração, fechar delimitador) em horário ocupado | ✅ Decisão inalterada (`AGUARDANDO_ESCOLHA`), texto **não enviado** à IA, flag `SUSPEITA_MANIPULACAO`. Teste extra: uma IA "comprometida" que escreve "foi confirmado" é barrada pelo guardrail (`REJEITADA_GUARDRAIL`) |
| T09 | Dados de outro usuário | Consultar protocolo alheio; usar protocolo alheio como "anterior" | ✅ Resposta idêntica à de protocolo inexistente; tentativa registrada como `NEGADO_TITULAR_DIVERGENTE`; registro alheio inalterado; hash alheio não aparece na resposta |
| T10 | Tratamento inconsistente | 6 perfis fictícios (nomes e domínios diversos) × 5 pedidos sobre agendas idênticas | ✅ Status, motivos, alternativas e justificativa **idênticos** entre perfis; desempate só por ordem de chegada |

## Testes complementares

| # | Verificação | Resultado |
|---|---|---|
| R01 | Grade de horários (pausa de almoço, sábado, feriado) | ✅ |
| R02 | Passado, antecedência mínima/máxima, fora da grade | ✅ |
| R03 | Toda alternativa sugerida é válida e livre (4 situações) | ✅ |
| R04 | Normalização de datas/horas (`24/11/2026`, ISO, `14h30`, datas impossíveis) | ✅ |
| R05 | Funcionamento sem chave do Gemini | ✅ |
| R06 | Preferência "tarde" da IA só reordena alternativas reais | ✅ 13:00, 14:00, 15:00 |
| R07 | IA pede atendimento humano → pré-reserva → revisão exige motivo e transição válida | ✅ |
| R08 | Revisão humana não cria conflito (reverifica a ocupação) | ✅ |
| R09 | Limite de 1 agendamento por pessoa/dia | ✅ |
| R10 | Seleção de registros vencidos para retenção | ✅ |
| R11 | Ações fora da lista de permissões são bloqueadas | ✅ |
| R12 | Guardrail rejeita horário inventado pela IA (16:30) | ✅ |
| P01 | Agenda/Log sem e-mail, nome, observações ou telefone | ✅ |
| P02 | Requisição ao Gemini: sem nome/e-mail; CPF, telefone e e-mail mascarados; dados fora das instruções; chave no cabeçalho, não na URL | ✅ |
| P03 | Possível dado de saúde não é enviado à IA | ✅ |
| P04 | Resposta ao Make sem e-mail/nome; `[NOME]` substituído só no envio | ✅ |
| P05 | Campos extras (CPF, telefone) descartados na entrada | ✅ |
| P06 | Erro de rede não propaga a chave nem a URL | ✅ |
| S01 | Repositório Google Sheets (com `SpreadsheetApp` simulado): gravar, listar, buscar, atualizar, célula convertida em Date | ✅ |

## Verificação de mutação (os testes detectam erros?)

Em uma cópia temporária do projeto, introduzimos defeitos de propósito e executamos a suíte:

| Defeito introduzido | Testes que falharam |
|---|---|
| Ignorar ocupação (capacidade 999) | 7 |
| Desligar detecção de injeção | 1 (T08) |
| Desligar guardrail de mensagens | 2 (T08, R12) |
| Consulta de status sem conferir o titular | 1 (T09) |

Todos os defeitos foram detectados.

## Demonstração local

`npm run demo` executa 7 casos fictícios (confirmação, ocupado + alternativas, escolha da alternativa, ataque de injeção, dados inválidos, duplicidade, sábado) e mostra o que fica armazenado. Saída registrada (sem Gemini): [evidencias/saida-demo-sem-ia.txt](evidencias/saida-demo-sem-ia.txt).

## Testes de integração (não executados)

Os itens abaixo **não foram executados**, porque dependem das contas do grupo. Preencha a coluna "Resultado observado" depois de seguir [configuracao.md](configuracao.md).

| # | Teste | Resultado observado | Data | Evidência |
|---|---|---|---|---|
| G1 | `npm run demo` com `GEMINI_API_KEY` real (verificar se mensagens passam no guardrail) | _não executado_ | | |
| G2 | Gemini com texto de ataque não detectado pelo filtro (ex.: em inglês) → conferir `tentativa_de_instrucao` | _não executado_ | | |
| I1–I7 | Roteiro ponta a ponta Forms → Make → Apps Script → e-mail ([configuracao.md, passo 5](configuracao.md#passo-5--teste-ponta-a-ponta-registrar-em-docstestesmd)) | _não executado_ | | |
| I8 | Dois envios simultâneos para o mesmo horário (testa o `LockService`) | _não executado_ | | |
| I9 | `aplicarRetencao()` com linhas antigas fictícias | _não executado_ | | |
