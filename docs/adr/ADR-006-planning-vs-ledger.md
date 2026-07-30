# ADR-006: Planning vs Ledger

## Status

Aceito

## Contexto

Misturar orçamento e lançamentos reais gera ambiguidade e bugs de consolidação.

## Decisão

Separar **Planning** (intenção) de **Ledger** (fato). Comparativos são responsabilidade de Reports/consultas.

## Alternativas consideradas

- Uma única entidade “movimento” com flag planejado/realizado
- Ledger como fonte única gerando planejamento por projeção

## Consequências positivas

- Modelo mental claro
- Histórico de planejamento preservado
- Relatórios mais explícitos

## Consequências negativas

- Mais entidades e casos de uso
- Sincronização conceitual entre módulos exige disciplina
