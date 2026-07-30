# ADR-003: Dinheiro em centavos

## Status

Aceito

## Contexto

Valores monetários não podem usar ponto flutuante.

## Decisão

Armazenar e manipular dinheiro como inteiro em centavos (`bigint` no domínio e no PostgreSQL).

Exemplo: `R$ 191,27 = 19127`.

## Alternativas consideradas

- `decimal`/`numeric` como tipo principal de domínio
- Bibliotecas monetárias externas desde o início

## Consequências positivas

- Precisão e comparações exatas
- Simplicidade de soma/subtração
- Bom alinhamento com APIs financeiras

## Consequências negativas

- Conversão na camada de apresentação
- Serialização JSON de `bigint` exige cuidado
- Moedas com escala diferente de 2 precisariam extensão futura
