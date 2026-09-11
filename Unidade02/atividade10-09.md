# 🤖 Atividade Prática — Programação Assistida por Inteligência Artificial

## 📌 Informações do Projeto

**Tema:** Collaborative AI Programming  
**Mini-projeto escolhido:** Jogo da Forca  
**Nível:** Intermediário  
**Linguagem:** Python  
**Ambiente sugerido:** Google Colab, Replit ou VS Code  

---

## 🎯 1. Objetivo

O objetivo desta atividade foi desenvolver um pequeno **Jogo da Forca em Python**, utilizando Inteligência Artificial como ferramenta de apoio durante o desenvolvimento.

A proposta segue o conceito de colaboração entre **Humano + IA**, no qual a Inteligência Artificial atua como parceira do programador, oferecendo sugestões, melhorias e possibilidades de refatoração.

O desenvolvedor, entretanto, continua sendo responsável por analisar as sugestões, validar o código e decidir quais alterações realmente devem ser incorporadas.

O ciclo utilizado durante a atividade foi:

```text
Contextualizar e sugerir
        ↓
Avaliar criticamente
        ↓
Refatorar e ajustar
        ↓
Decidir e integrar
```

A Inteligência Artificial fornece velocidade e sugestões, enquanto o desenvolvedor permanece responsável pela direção, arquitetura e validação final da solução.

---

# 💻 2. Primeira versão do programa

Inicialmente foi criada uma versão simples e funcional do **Jogo da Forca**.

```python
import random

palavras = ["python", "computador", "algoritmo", "programacao", "inteligencia"]

palavra = random.choice(palavras)

letras_corretas = []
letras_erradas = []

tentativas = 6

while tentativas > 0:

    palavra_exibida = ""

    for letra in palavra:
        if letra in letras_corretas:
            palavra_exibida += letra + " "
        else:
            palavra_exibida += "_ "

    print("\nPalavra:", palavra_exibida)
    print("Erros:", letras_erradas)
    print("Tentativas restantes:", tentativas)

    if "_" not in palavra_exibida:
        print("\nParabéns! Você venceu!")
        break

    letra = input("\nDigite uma letra: ").lower()

    if letra in palavra:

        if letra not in letras_corretas:
            letras_corretas.append(letra)

        print("Você acertou!")

    else:

        if letra not in letras_erradas:
            letras_erradas.append(letra)
            tentativas -= 1

        print("Você errou!")

else:
    print("\nVocê perdeu!")
    print("A palavra era:", palavra)
```

---

## 🔎 3. Problemas identificados na primeira versão

Apesar de funcionar, a primeira implementação apresenta alguns pontos que poderiam ser melhorados.

Entre eles:

- Toda a lógica estava concentrada em um único bloco;
- Não havia validação adequada da entrada;
- O jogador poderia digitar números;
- O jogador poderia digitar caracteres especiais;
- O jogador poderia informar mais de uma letra;
- Algumas responsabilidades poderiam ser separadas em funções;
- Listas estavam sendo utilizadas para armazenar letras já utilizadas;
- O código poderia ter maior legibilidade;
- O programa poderia ser mais fácil de manter e modificar.

Exemplo de uma entrada inadequada que não era tratada corretamente:

```text
abc
```

Outro exemplo:

```text
5
```

---

# 🤖 4. Utilização da Inteligência Artificial

Após desenvolver a primeira versão, a Inteligência Artificial foi utilizada como ferramenta de apoio para analisar e refatorar o código.

Ao invés de utilizar um prompt genérico como:

```text
Melhore esse código.
```

foi utilizado um prompt mais estruturado, contendo contexto e instruções específicas.

---

## 📝 Prompt utilizado

```text
Atue como um desenvolvedor Python Sênior.

Analise este código de um jogo da forca.

Refatore o programa separando as responsabilidades em funções.

Evite mutações e estruturas desnecessárias, melhore a legibilidade e adicione
validação para impedir que o usuário informe números, caracteres especiais
ou mais de uma letra.

Também impeça que uma tentativa repetida seja contabilizada novamente.

Comente as principais alterações realizadas.
```

---

# 💡 5. Sugestões produzidas pela IA

Após analisar o programa, algumas melhorias foram sugeridas.

As principais foram:

1. Criar funções para separar as responsabilidades;
2. Utilizar `set` no lugar de listas para armazenar letras utilizadas;
3. Criar uma função específica para montar a palavra exibida;
4. Validar a entrada informada pelo jogador;
5. Separar a verificação de vitória da execução principal;
6. Impedir que letras repetidas sejam contabilizadas novamente;
7. Melhorar os nomes das variáveis;
8. Criar uma função `main()` para organizar o fluxo da aplicação.

---

# 🧠 6. Avaliação crítica das sugestões

As sugestões geradas pela Inteligência Artificial não foram simplesmente aceitas de maneira automática.

Cada alteração foi analisada antes de ser incorporada ao programa.

Uma das sugestões consideradas adequadas foi substituir listas por `set`.

### Antes

```python
letras_corretas = []
letras_erradas = []
```

### Depois

```python
letras_corretas = set()
letras_erradas = set()
```

O `set` é apropriado nesse caso porque não permite elementos duplicados.

Assim, uma mesma letra não precisa aparecer diversas vezes entre as tentativas realizadas pelo jogador.

---

Outra melhoria aceita foi a separação das responsabilidades do programa em funções.

Na primeira versão, praticamente toda a lógica estava dentro do mesmo bloco.

Após a refatoração, responsabilidades diferentes passaram a possuir funções específicas.

Por exemplo:

```python
def escolher_palavra():
    ...
```

```python
def montar_palavra_oculta():
    ...
```

```python
def validar_letra():
    ...
```

```python
def venceu():
    ...
```

Essa organização melhora a legibilidade e facilita futuras modificações.

---

## Validação de entrada

A Inteligência Artificial também sugeriu a criação de uma validação específica para impedir entradas inválidas.

Por exemplo:

```text
5
```

```text
abc
```

```text
@
```

Essas entradas não devem ser consideradas tentativas válidas.

Foi criada, então, uma função específica para realizar essa validação:

```python
def validar_letra(entrada):
    if len(entrada) != 1:
        return False

    if not entrada.isalpha():
        return False

    return True
```

Assim, somente uma única letra é aceita pelo programa.

---

# ✅ 7. Código final refatorado

Após analisar as sugestões da Inteligência Artificial e decidir quais alterações deveriam ser incorporadas, foi produzida a seguinte versão:

```python
import random


PALAVRAS = [
    "python",
    "computador",
    "algoritmo",
    "programacao",
    "inteligencia"
]

MAX_TENTATIVAS = 6


def escolher_palavra():
    """
    Escolhe aleatoriamente uma palavra da lista.
    """
    return random.choice(PALAVRAS)


def montar_palavra_oculta(palavra, letras_corretas):
    """
    Retorna a palavra mostrando apenas as letras
    que o jogador já acertou.
    """
    return " ".join(
        letra if letra in letras_corretas else "_"
        for letra in palavra
    )


def validar_letra(entrada):
    """
    Valida se o jogador digitou apenas uma letra.
    """
    if len(entrada) != 1:
        return False

    if not entrada.isalpha():
        return False

    return True


def venceu(palavra, letras_corretas):
    """
    Verifica se todas as letras da palavra
    foram descobertas.
    """
    return all(
        letra in letras_corretas
        for letra in palavra
    )


def jogo_da_forca():

    palavra = escolher_palavra()

    letras_corretas = set()
    letras_erradas = set()

    tentativas_restantes = MAX_TENTATIVAS

    print("=" * 35)
    print("          JOGO DA FORCA")
    print("=" * 35)

    while tentativas_restantes > 0:

        palavra_exibida = montar_palavra_oculta(
            palavra,
            letras_corretas
        )

        print("\nPalavra:", palavra_exibida)

        if letras_erradas:
            print(
                "Letras erradas:",
                ", ".join(sorted(letras_erradas))
            )

        print(
            "Tentativas restantes:",
            tentativas_restantes
        )

        if venceu(palavra, letras_corretas):
            print("\n🎉 Parabéns! Você venceu!")
            print("A palavra era:", palavra)
            return

        entrada = input(
            "\nDigite uma letra: "
        ).lower().strip()

        if not validar_letra(entrada):
            print(
                "Digite apenas uma letra válida."
            )
            continue

        if (
            entrada in letras_corretas
            or entrada in letras_erradas
        ):
            print(
                "Você já tentou essa letra."
            )
            continue

        if entrada in palavra:

            letras_corretas.add(entrada)

            print("✅ Você acertou!")

        else:

            letras_erradas.add(entrada)

            tentativas_restantes -= 1

            print("❌ Você errou!")

    print("\n💀 Você perdeu!")
    print("A palavra correta era:", palavra)


def main():
    jogo_da_forca()


if __name__ == "__main__":
    main()
```

---

# 🧪 8. Testes realizados

Após a refatoração, alguns testes foram realizados manualmente para verificar se o programa funcionava corretamente.

| Cenário | Entrada | Resultado esperado |
|---|---|---|
| Letra existente | `a` | A letra é revelada |
| Letra inexistente | `x` | Diminui uma tentativa |
| Letra repetida | `a` novamente | Não perde nova tentativa |
| Número | `5` | Entrada recusada |
| Várias letras | `abc` | Entrada recusada |
| Caractere especial | `#` | Entrada recusada |
| Todas as letras corretas | Letras da palavra | Jogador vence |
| Seis erros | Letras incorretas | Jogador perde |

---

# 🎮 9. Exemplo de execução

Exemplo de uma possível execução do programa:

```text
===================================
          JOGO DA FORCA
===================================

Palavra: _ _ _ _ _ _
Tentativas restantes: 6

Digite uma letra: p

✅ Você acertou!

Palavra: p _ _ _ _ _
Tentativas restantes: 6

Digite uma letra: x

❌ Você errou!

Palavra: p _ _ _ _ _
Letras erradas: x
Tentativas restantes: 5
```

Caso o jogador informe mais de uma letra:

```text
Digite uma letra: abc

Digite apenas uma letra válida.
```

Caso informe um número:

```text
Digite uma letra: 5

Digite apenas uma letra válida.
```

Caso tente novamente uma letra já utilizada:

```text
Digite uma letra: p

Você já tentou essa letra.
```

---

# 🔄 10. Comparação entre as versões

## Exibição da palavra

### Antes

```python
palavra_exibida = ""

for letra in palavra:
    if letra in letras_corretas:
        palavra_exibida += letra + " "
    else:
        palavra_exibida += "_ "
```

### Depois

```python
def montar_palavra_oculta(palavra, letras_corretas):
    return " ".join(
        letra if letra in letras_corretas else "_"
        for letra in palavra
    )
```

Na versão refatorada, a responsabilidade de construir a palavra exibida foi isolada em uma função.

Isso torna o código principal mais simples e fácil de compreender.

---

## Armazenamento das letras

### Antes

```python
letras_corretas = []
letras_erradas = []
```

### Depois

```python
letras_corretas = set()
letras_erradas = set()
```

A utilização de `set` evita valores duplicados e representa melhor o conjunto de letras que já foram utilizadas.

---

## Validação

### Antes

```python
letra = input("\nDigite uma letra: ").lower()
```

Não existia uma verificação específica para garantir que o usuário informasse uma única letra.

### Depois

```python
def validar_letra(entrada):

    if len(entrada) != 1:
        return False

    if not entrada.isalpha():
        return False

    return True
```

A aplicação passou a impedir entradas inválidas.

---

## Organização

### Antes

Grande parte da aplicação estava dentro de um único:

```python
while
```

### Depois

O código passou a possuir funções responsáveis por tarefas específicas:

```text
escolher_palavra()
        ↓
montar_palavra_oculta()
        ↓
validar_letra()
        ↓
venceu()
        ↓
jogo_da_forca()
        ↓
main()
```

Essa abordagem torna o código mais modular.

---

# 📊 11. Antes x Depois

| Característica | Antes | Depois |
|---|---|---|
| Organização | Lógica concentrada | Separação em funções |
| Validação | Básica | Entrada validada |
| Letras repetidas | Tratamento limitado | Tratamento específico |
| Estrutura de dados | `list` | `set` |
| Legibilidade | Menor | Maior |
| Manutenção | Mais difícil | Mais simples |
| Modularização | Baixa | Maior |
| Uso de funções | Pouco | Diversas funções |
| Responsabilidades | Misturadas | Separadas |

---

# 🤝 12. Ciclo de colaboração Humano + IA

Durante a atividade foi utilizado o seguinte fluxo:

```text
┌────────────────────────────┐
│      Código inicial        │
└──────────────┬─────────────┘
               ↓
┌────────────────────────────┐
│ Prompt enviado para a IA   │
└──────────────┬─────────────┘
               ↓
┌────────────────────────────┐
│ Sugestões de refatoração   │
└──────────────┬─────────────┘
               ↓
┌────────────────────────────┐
│     Avaliação humana       │
└──────────────┬─────────────┘
               ↓
┌────────────────────────────┐
│ Refatoração e ajustes      │
└──────────────┬─────────────┘
               ↓
┌────────────────────────────┐
│          Testes            │
└──────────────┬─────────────┘
               ↓
┌────────────────────────────┐
│       Código final         │
└────────────────────────────┘
```

---

# 📚 13. O que foi aprendido

A atividade demonstrou que a Inteligência Artificial pode ajudar significativamente durante o desenvolvimento de software.

Ela pode auxiliar principalmente em tarefas como:

- Refatoração de código;
- Identificação de possíveis problemas;
- Sugestões de estruturas melhores;
- Redução de repetição;
- Criação de validações;
- Melhoria da legibilidade;
- Sugestões de algoritmos;
- Apoio durante debugging;
- Consulta de documentação;
- Explicação de trechos de código.

Entretanto, utilizar uma Inteligência Artificial não elimina a necessidade de compreender programação.

O desenvolvedor precisa ser capaz de avaliar se determinada sugestão realmente faz sentido.

---

# ⚠️ 14. Limites da Inteligência Artificial

Apesar das vantagens, a Inteligência Artificial possui limitações.

A IA pode:

```text
✅ Sugerir código
✅ Autocompletar padrões
✅ Lembrar estruturas e documentações
✅ Sugerir algoritmos
✅ Encontrar oportunidades de refatoração
```

Entretanto, também pode:

```text
❌ Interpretar incorretamente uma regra de negócio
❌ Criar código desnecessário
❌ Introduzir erros
❌ Criar vulnerabilidades
❌ Produzir informações incorretas
```

Por isso, todo código produzido ou sugerido por Inteligência Artificial precisa ser analisado e testado.

---

# 👨‍💻 15. Papel do desenvolvedor

A Inteligência Artificial pode escrever código, mas a responsabilidade final permanece com o desenvolvedor.

O papel humano envolve:

```text
Entender o problema
        ↓
Definir o contexto
        ↓
Orientar a IA
        ↓
Analisar as sugestões
        ↓
Modificar o código
        ↓
Realizar testes
        ↓
Validar o resultado
```

A IA deve ser considerada uma ferramenta de apoio ao desenvolvimento e não uma substituta do conhecimento técnico.

---

# 📝 16. Conclusão

O uso da Inteligência Artificial no desenvolvimento do **Jogo da Forca** possibilitou transformar uma implementação funcional, porém pouco organizada, em um programa mais modular, legível e robusto.

Durante a atividade, a IA foi utilizada principalmente para identificar possibilidades de refatoração e sugerir melhorias na estrutura do programa.

As sugestões não foram simplesmente utilizadas de forma automática. Elas passaram por avaliação antes de serem incorporadas ao código.

Entre as principais melhorias realizadas estão:

- Separação da lógica em funções;
- Validação das entradas;
- Utilização de `set`;
- Tratamento de letras repetidas;
- Melhor organização do fluxo da aplicação;
- Melhoria da legibilidade.

A principal conclusão obtida com a atividade é que a Inteligência Artificial deve funcionar como uma ferramenta de **colaboração com o desenvolvedor**.

Ela pode aumentar a produtividade, sugerir soluções e acelerar tarefas repetitivas, porém o papel humano continua fundamental.

O desenvolvedor permanece responsável por:

- **Decidir;**
- **Avaliar;**
- **Testar;**
- **Validar;**
- **Dar direção ao projeto.**

Portanto:

> **A Inteligência Artificial não substitui o desenvolvedor, mas amplia sua capacidade criativa e produtiva. O papel humano é decidir, validar e dar direção.**

---

# 🚀 Fluxo final da atividade

```text
Código inicial
      ↓
Prompt estruturado
      ↓
Sugestões da IA
      ↓
Avaliação crítica
      ↓
Refatoração
      ↓
Testes
      ↓
Código final
```

Esse processo representa a colaboração entre:

## 👨‍💻 Humano + 🤖 Inteligência Artificial

---

## 🛠️ Tecnologias utilizadas

- Python 3
- Inteligência Artificial Generativa
- Git
- GitHub
- Google Colab / Replit / VS Code

---

## 📂 Estrutura sugerida do repositório

```text
atividade-ia/
│
├── README.md
│
├── jogo_forca.py
│
└── versao_inicial.py
```

### `versao_inicial.py`

Contém a primeira versão do programa antes da utilização da Inteligência Artificial.

### `jogo_forca.py`

Contém a versão final após análise, refatoração e testes.

### `README.md`

Contém a documentação da atividade e a comparação entre as versões.

---

## ▶️ Como executar

Clone o repositório:

```bash
git clone URL_DO_REPOSITORIO
```

Entre na pasta:

```bash
cd atividade-ia
```

Execute o programa:

```bash
python jogo_forca.py
```

Ou:

```bash
python3 jogo_forca.py
```

---

## 📌 Resultado

O resultado final foi uma aplicação mais:

- Organizada;
- Modular;
- Legível;
- Fácil de manter;
- Robusta;
- Preparada para receber novas funcionalidades.

A atividade demonstrou, na prática, como a Inteligência Artificial pode ser utilizada como parceira durante o processo de desenvolvimento de software.
