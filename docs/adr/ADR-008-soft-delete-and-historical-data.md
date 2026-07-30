# ADR-008: Soft delete e dados históricos

## Status

Aceito

## Contexto

Categorias e outros cadastros usados em lançamentos históricos não podem desaparecer fisicamente.

## Decisão

Preferir inativação (`isActive`) / soft delete para cadastros referenciados. Evitar exclusão física de registros financeiros. Preservar referências históricas de categoria/subcategoria.

## Alternativas consideradas

- Exclusão física com nullify
- Snapshot textual sem FK histórica

## Consequências positivas

- Integridade histórica
- Relatórios consistentes no tempo
- Recuperação possível

## Consequências negativas

- Tabelas crescem com registros inativos
- Listagens precisam filtrar ativos por padrão
