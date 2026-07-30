# ADR-002: Monólito modular

## Status

Aceito

## Contexto

Precisamos de limites claros entre capacidades financeiras, sem o custo operacional de microserviços no início.

## Decisão

Uma única API Fastify organizada em módulos com fronteiras explícitas (domain/application/infrastructure/presentation).

## Alternativas consideradas

- Microserviços desde o dia 1
- Modularização apenas por pastas sem regras de dependência

## Consequências positivas

- Deploy simples
- Transações locais mais fáceis
- Extração futura de módulos possíveis

## Consequências negativas

- Risco de acoplamento se limites forem ignorados
- Escala independente por módulo só depois da extração
