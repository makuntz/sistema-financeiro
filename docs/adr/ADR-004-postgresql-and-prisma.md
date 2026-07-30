# ADR-004: PostgreSQL e Prisma

## Status

Aceito

## Contexto

Precisamos de um banco relacional robusto e de um acesso tipado em TypeScript.

## Decisão

PostgreSQL como banco principal e Prisma como ORM/migrations na camada `packages/database`.

## Alternativas consideradas

- SQL puro com migrations manuais
- Drizzle ORM
- MongoDB

## Consequências positivas

- Tipagem forte
- Migrações versionadas
- Bom suporte a UUID e BigInt

## Consequências negativas

- Abstração pode esconder SQL complexo em relatórios
- Relatórios pesados podem exigir SQL dedicado no futuro
