# AgendaFácil — Sistema de Agendamento Automatizado com Inteligência Artificial

## 1. Descrição do projeto

O **AgendaFácil** é um protótipo de sistema de agendamento desenvolvido utilizando ferramentas No Code, Low Code e Inteligência Artificial.

O projeto busca simplificar o processo de solicitação de atendimentos, automatizando o registro das informações e a geração de respostas por meio da integração entre Google Forms, Google Sheets, Make e a API do Google Gemini.

A solução demonstra como diferentes plataformas podem ser integradas para desenvolver aplicações funcionais com pouca ou nenhuma programação tradicional.

## 2. Problema identificado

O gerenciamento manual de agendamentos pode ocasionar dificuldades na organização das informações, retrabalho e demora na comunicação com os usuários.

Diante desse cenário, surgiu a proposta de desenvolver uma solução simples que centralize as solicitações e automatize parte do processo de atendimento.

## 3. Objetivo geral

Desenvolver um sistema de agendamento utilizando ferramentas No Code, Low Code e Inteligência Artificial, com o objetivo de automatizar o registro de solicitações e a geração de respostas, reduzindo atividades manuais e melhorando a organização dos atendimentos.

## 4. Tecnologias utilizadas

| Ferramenta | Finalidade |
|---|---|
| Google Forms | Coleta das solicitações de agendamento |
| Google Sheets | Armazenamento e organização dos dados |
| Make | Automação dos processos e integração das ferramentas |
| Google Gemini API | Geração de respostas utilizando Inteligência Artificial |
| GitHub | Documentação e organização das evidências do projeto |

### Justificativa da escolha

As ferramentas foram escolhidas pela facilidade de utilização, integração entre serviços e possibilidade de desenvolvimento rápido.

O Google Forms e o Google Sheets permitem coletar e organizar informações sem programação. O Make possibilita criar fluxos automatizados por meio de uma interface visual, enquanto a API do Gemini adiciona recursos de Inteligência Artificial ao sistema.

Essa combinação permite desenvolver um protótipo com menor complexidade técnica e demonstrar conceitos de No Code, Low Code e Vibecode.

## 5. Arquitetura da solução

O projeto utiliza um fluxo composto por quatro etapas principais:

**Google Forms → Google Sheets → Make → API Gemini → Resposta automatizada**

1. O usuário preenche o formulário de solicitação de agendamento.
2. As informações são registradas no Google Sheets.
3. O Make utiliza os dados registrados para executar o fluxo de automação.
4. A API do Gemini processa as informações recebidas e gera uma resposta.
5. O Make utiliza a resposta da IA na etapa final da automação.

## 6. Funcionalidades do sistema

O protótipo foi desenvolvido para oferecer as seguintes funcionalidades:

- Registro de solicitações por meio de formulário eletrônico.
- Coleta de informações como nome, e-mail, data e horário desejados.
- Armazenamento dos registros em planilha.
- Integração automatizada entre as ferramentas.
- Utilização da API do Gemini para geração de respostas.
- Redução da necessidade de processamento manual das solicitações.

O projeto é um protótipo acadêmico e não contempla, nesta versão, todas as funcionalidades de um sistema comercial de agendamento.

## 7. Desenvolvimento com Inteligência Artificial

A Inteligência Artificial foi utilizada como parte da solução por meio da integração da API do Google Gemini ao Make.

Essa integração permite enviar informações do fluxo de agendamento para o modelo de IA e utilizar a resposta
