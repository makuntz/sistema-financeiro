# ADR-001: Monorepo

## Status

Aceito

## Contexto

O PP Planning terá API, web, mobile e artefatos compartilhados (contratos, tokens, domínio).

## Decisão

Usar monorepo com pnpm workspaces e Turborepo.

## Alternativas consideradas

- Repositórios separados por app
- Monorepo com Nx

## Consequências positivas

- Contratos e tokens versionados juntos
- Refactors cross-app mais seguros
- CI unificado

## Consequências negativas

- Clone e CI maiores
- Necessita disciplina de ownership por pacote
