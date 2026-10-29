Unidade 2 — Programação Assistida por Inteligência Artificial

Aula 06 — Boas práticas na colaboração humano-IA

Tema: Vibe Coding e programação assistida por Inteligência Artificial
Objetivo: refletir sobre os limites, os riscos e o potencial da colaboração entre pessoas desenvolvedoras e sistemas de IA durante a programação.

Questões norteadoras

1. Até que ponto podemos confiar no código produzido pela IA?

O código produzido por uma IA pode ser utilizado como apoio ao desenvolvimento, mas não deve ser aceito automaticamente como correto. Um prompt bem definido, estruturado e detalhado tende a gerar respostas mais adequadas ao problema, porém isso não elimina a necessidade de validação humana.
Antes de utilizar um código gerado por IA, o programador deve revisar sua lógica, verificar se ele atende às regras de negócio, executar testes, realizar depuração e analisar possíveis impactos em outras partes do sistema. Também é importante observar dependências, segurança, desempenho e manutenibilidade.
Aceitar um código sem revisão ou sem compreender seu funcionamento pode introduzir erros, vulnerabilidades e comportamentos inesperados. Portanto, quanto maior for a experiência técnica do programador em leitura de código, testes e depuração, maior será sua capacidade de identificar problemas e reduzir os riscos associados às respostas produzidas pela IA.

2. A IA reduz a necessidade de conhecimento em programação ou transforma o tipo de conhecimento necessário?

A IA não elimina a necessidade de conhecimento em programação. Na prática, ela transforma parte do trabalho do desenvolvedor, que passa a atuar também como orientador, avaliador e revisor das soluções produzidas pela ferramenta.
Mesmo que uma pessoa consiga gerar códigos utilizando linguagem natural, o conhecimento técnico continua sendo necessário para compreender o problema, analisar a solução, identificar erros e decidir se o resultado realmente atende às necessidades do sistema.
Nesse cenário, tornam-se ainda mais importantes competências como lógica de programação, leitura e compreensão de código, depuração, testes, conhecimento das tecnologias utilizadas, entendimento das regras de negócio e pensamento crítico. Além disso, saber formular bons prompts ajuda no processo, mas não substitui a capacidade de avaliar tecnicamente aquilo que foi gerado.
Assim, o papel do programador vai além de apenas escrever código: ele precisa compreender o contexto, orientar a IA, revisar as respostas e tomar a decisão final sobre o que deve ou não ser utilizado no projeto.

3. Quando é melhor utilizar a IA e quando é melhor assumir o controle manualmente?

Antes de recorrer à IA, o programador deve compreender o problema, identificar seus requisitos e definir o resultado esperado. A ferramenta pode ser utilizada como apoio para sugerir soluções, explicar trechos de código, auxiliar na correção de erros, gerar estruturas iniciais e ajudar na elaboração ou no refinamento de prompts.
É mais adequado delegar tarefas à IA quando elas são bem delimitadas, repetitivas ou quando o resultado pode ser facilmente revisado e testado. O trabalho colaborativo entre programador e IA é mais indicado quando a tarefa exige geração de código, análise e ajustes sucessivos.
Já o controle manual deve ser priorizado quando a tarefa envolve decisões críticas, regras de negócio complexas, segurança, dados sensíveis, arquitetura do sistema ou situações em que o desenvolvedor não consegue compreender ou validar com segurança a solução produzida.
Dessa forma, delegar 100% de uma tarefa à IA sem acompanhamento não é uma boa prática. A decisão final deve continuar sob responsabilidade humana, considerando o contexto, os riscos e o impacto da alteração no sistema.

Estudo de caso

No estudo de caso apresentado, a equipe solicita à IA a implementação completa de uma funcionalidade. Embora o código aparentemente funcione e tenha passado por um teste inicial, ele ainda não deveria ser incorporado diretamente ao projeto.

Antes disso, a equipe deveria:

 - Revisar detalhadamente o código produzido;
 - Verificar se a implementação atende aos requisitos e às regras de negócio;
 - Executar testes adicionais, incluindo casos de erro e situações de borda;
 - Analisar as dependências utilizadas;
 - Verificar possíveis vulnerabilidades de segurança;
 - Avaliar a legibilidade e a manutenibilidade do código;
 - Identificar possíveis impactos em outras partes do sistema;
 - Realizar os ajustes necessários e registrar as decisões tomadas.

Mesmo utilizando IA, permanecem humanas as responsabilidades de compreender o problema, avaliar os riscos, validar a solução, decidir se o código está adequado e autorizar sua incorporação ao projeto.

Três boas práticas para a colaboração humano-IA

 - Fornecer contexto e instruções claras à IA: formular prompts objetivos, explicando o problema, os requisitos, as restrições e o resultado esperado.
 - Revisar, testar e compreender o código gerado: nunca utilizar uma solução somente porque ela aparenta funcionar. É necessário validar sua lógica, executar testes e compreender o comportamento da implementação.
 - Manter a responsabilidade e a decisão final com o programador: a IA deve atuar como ferramenta de apoio. Cabe ao desenvolvedor avaliar quando utilizar a sugestão, quando modificá-la e quando assumir o controle manualmente.

Síntese final

Programar com IA de maneira responsável não significa apenas saber pedir código; significa também compreender o problema e avaliar criticamente as respostas produzidas.
O desenvolvedor precisa conhecer as tecnologias utilizadas, as regras de negócio e os possíveis impactos de cada alteração.
Também é necessário revisar o código, executar testes, realizar depuração e identificar riscos antes de utilizar uma solução gerada pela IA.
A qualidade do prompt contribui para melhores respostas, mas não substitui o conhecimento técnico do programador.
A IA deve ser utilizada como uma ferramenta de apoio e colaboração, e não como substituta da responsabilidade humana.
Por isso, discernimento, pensamento crítico e conhecimento técnico continuam sendo essenciais durante todo o processo de desenvolvimento.
