## Prompt 1 - Versão inicial

### Prompt

> Explique LEFT JOIN em LINQ.

### Resultado do Prompt 1

Em LINQ, o `LEFT JOIN` é feito com uma combinação de `join ... into` + `DefaultIfEmpty()`.

A ideia é trazer todos os registros da tabela da esquerda, mesmo quando não existir um registro correspondente na tabela da direita.

Por exemplo, queremos trazer todos os pacientes, inclusive aqueles que nunca fizeram uma consulta.

Em SQL, seria:

```sql
SELECT *
FROM Pacientes p
LEFT JOIN Consultas c ON c.PacienteId = p.Id;
```

Em LINQ:

```csharp
var resultado =
    from paciente in context.Pacientes

    join consulta in context.Consultas
        on paciente.Id equals consulta.PacienteId
        into consultasGroup

    from consulta in consultasGroup.DefaultIfEmpty()

    select new
    {
        Paciente = paciente.Nome,
        ConsultaId = consulta != null ? consulta.Id : 0,
        DataConsulta = consulta != null ? consulta.Data : (DateTime?)null
    };
```

A parte mais importante é:

```csharp
join consulta in context.Consultas
    on paciente.Id equals consulta.PacienteId
    into consultasGroup
```

O `into consultasGroup` cria um grupo com as consultas encontradas para aquele paciente.

Depois:

```csharp
from consulta in consultasGroup.DefaultIfEmpty()
```

O `DefaultIfEmpty()` é o que permite o comportamento de um `LEFT JOIN`. Sem ele, o registro da esquerda não seria preservado quando não existisse um correspondente.

### Exemplo visual

Imagine os seguintes dados:

**Pacientes**

| Id | Nome  |
| -: | ----- |
|  1 | Maria |
|  2 | João  |
|  3 | Ana   |

**Consultas**

| Id | PacienteId |
| -: | ---------: |
| 10 |          1 |
| 11 |          1 |
| 12 |          2 |

O resultado do `LEFT JOIN` seria:

| Paciente | Consulta |
| -------- | -------: |
| Maria    |       10 |
| Maria    |       11 |
| João     |       12 |
| Ana      |     null |

Mesmo que Ana não tenha nenhuma consulta, ela continua aparecendo no resultado.

### Estrutura básica

Sempre que for necessário fazer um `LEFT JOIN` utilizando LINQ Query Syntax, a estrutura será semelhante a:

```csharp
from x in tabelaA

join y in tabelaB
    on x.Id equals y.Id
    into yGroup

from y in yGroup.DefaultIfEmpty()

select new
{
    x,
    y
};
```

Ou seja:

```text
FROM
  ↓
JOIN
  ↓
INTO grupo
  ↓
DefaultIfEmpty()
  ↓
LEFT JOIN
```

Como o registro da tabela da direita pode não existir, o objeto retornado por ela pode ser `null`.

Por isso, é necessário ter cuidado ao acessar suas propriedades.

Uma forma simples de lembrar é:

> `join + into + DefaultIfEmpty() = LEFT JOIN em LINQ`

> ### Análise do Prompt 1

A resposta explicou corretamente o conceito de `LEFT JOIN` em LINQ e apresentou um exemplo prático utilizando pacientes e consultas, o que ajudou na compreensão.

Também foi positivo mostrar a equivalência com SQL e destacar o uso de `join`, `into` e `DefaultIfEmpty()`.

Porém, a resposta ficou extensa para um prompt tão simples e trouxe várias informações além do que foi solicitado. Alguns pontos poderiam ser explicados de forma mais organizada e objetiva.

Além disso, como o prompt inicial não informou o nível de conhecimento do usuário, o contexto ou o formato desejado, a IA precisou assumir essas informações. Por isso, apesar de a resposta ter sido útil, ela poderia ser mais direcionada ao objetivo da atividade.

