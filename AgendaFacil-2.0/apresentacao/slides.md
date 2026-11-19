---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  section { font-size: 26px; }
  h1 { color: #0b3d91; }
  h2 { color: #0b3d91; }
  table { font-size: 20px; }
  .pequeno { font-size: 18px; color: #555; }
---

<!-- Slides em Markdown (Marp). Exportar: extensão "Marp for VS Code" → Export Slide Deck (PDF/PPTX). -->

# AgendaFácil 2.0
## Agente Inteligente de Agendamentos

Arquitetura de 4 camadas · decisões verificáveis · memória controlada · ética aplicada

Maria Cacília Araujo Lemos · Gabriella Dias
Engenharia de Prompt e Aplicações em IA

---

## Problema e objetivo

**Problema**
- Agendamento manual → retrabalho, demora e conflitos
- No 1.0, a IA só **gerava texto**: não verificava horários e poderia "confirmar" um horário ocupado
- Modelos de linguagem podem **inventar**, ser **manipulados** e tratar pessoas de forma **inconsistente**

**Objetivo**
> Um agente que verifica a disponibilidade real, sugere alternativas, responde com IA e **registra por que decidiu**, com privacidade e equidade.

---

## Evolução: 1.0 → 2.0

| | 1.0 | 2.0 |
|---|---|---|
| Disponibilidade | ❌ não verificava | ✅ grade, ocupação, feriados, antecedência |
| Papel da IA | gerava a resposta | interpreta e redige; **não decide** |
| Saída da IA | texto livre | JSON + esquema + guardrail |
| Falha da IA | fluxo parava | segue com regras + mensagem-modelo |
| Dados pessoais | tudo na planilha | sem nome/e-mail nas abas do agente; retenção de 90 dias |
| Decisões | sem registro | log com motivo e justificativa |
| Testes | previstos | **29 automatizados, 29 aprovados** |

Mantivemos **Forms, Sheets, Make e Gemini**; adicionamos o **Apps Script** (gratuito) para as regras.

---

## Arquitetura do agente — 4 camadas

```
Forms → Sheets → Make ──POST+token──► Apps Script (agente) ──► e-mail (Make)
                                   │
   1 PERCEPTIVA   valida · descarta campos extras · detecta injeção · mascara CPF/telefone
   2 COGNITIVA    Gemini interpreta observações → JSON validado (sem nome/e-mail)
   3 DECISÓRIA    regras puras: duplicidade → limite → expediente → ocupação → alternativas
   4 EXECUTIVA    grava Agenda · atualiza status · redige (Gemini+guardrail) · registra log
```

**A IA sugere, a regra decide.** Lista fechada de ações permitidas · bloqueio contra concorrência

---

## Funcionamento e tomada de decisão

- **Livre e dentro das regras** → `CONFIRMADO`
- **Ocupado/fora das regras** → `AGUARDANDO_ESCOLHA` com até 3 alternativas **reais**, **não reservadas**
  - a pessoa escolhe enviando novo formulário com o protocolo → o agente **reverifica**
- **Pedido especial** (ex.: acessibilidade) → `EM_REVISAO_HUMANA` (pré-reserva)
- **Planilha fora do ar** → `ERRO_TEMPORARIO`: nada é confirmado
- **Duplicado** → aponta o protocolo existente

Cada decisão gera: motivo (código) + justificativa + ação + uso de IA + flags → `Log_Decisoes`

---

## Privacidade, ética e prevenção de vieses

**Privacidade (LGPD)**
- Agente não recebe o nome; e-mail vira **hash SHA-256 com sal**; IA recebe dados **mascarados**
- Chaves em *Propriedades do Script*; token no webhook; abas protegidas; retenção automática

**Vieses**
- `decidir()` **não recebe** características pessoais → cegueira por construção
- Teste T10: 6 perfis × 5 pedidos → **resultados idênticos**

**Transparência e responsabilidade**
- Aviso de IA em toda mensagem · motivo explicado · revisão humana pelo menu, com motivo obrigatório

**Segurança:** dados ≠ instruções · injeção não chega à IA · guardrail barra "confirmado" falso

---

## Testes e demonstração

| Cenário | Resultado |
|---|---|
| Disponível / ocupado / duplicado | ✅ confirmado / alternativas / sem novo registro |
| Dados incompletos / e-mail inválido | ✅ rejeitados, IA não chamada |
| Falha do Gemini (5 tipos) / da planilha | ✅ decisão mantida / nada confirmado |
| Prompt injection (4 ataques) | ✅ decisão inalterada + guardrail |
| Dados de outra pessoa | ✅ resposta igual a "não existe" |
| Tratamento inconsistente | ✅ idêntico para todos os perfis |

**29/29 aprovados** · mutação: 4/4 defeitos detectados
<span class="pequeno">Não executados aqui: Gemini real, Make e Web App (dependem de credenciais; roteiro em docs/configuracao.md)</span>

**Demo ao vivo:** `npm run demo`

---

## Conclusão e melhorias futuras

**Conclusão**
- A IA ficou **mais útil e menos perigosa**: interpreta e comunica, mas a decisão é verificável
- O agente funciona mesmo sem a IA e falha de forma segura
- Privacidade e equidade foram **projetadas e testadas**, não só declaradas

**Próximos passos**
- Validar a integração real (Gemini, Make, Web App)
- Google Calendar · cancelamento/reagendamento pelo usuário
- Auditoria periódica do tom das mensagens · *evals* dos prompts

**Obrigado!** Perguntas?
