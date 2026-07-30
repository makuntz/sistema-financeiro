# ADR-007: Isolamento por workspace

## Status

Aceito

## Contexto

Famílias/grupos compartilham um planejamento, mas dados de workspaces distintos não podem vazar.

## Decisão

Todo dado financeiro pertence a um `workspaceId`. A API resolve o workspace autorizado a partir do contexto autenticado; o client não é fonte da verdade.

## Alternativas consideradas

- Multi-tenancy por schema/banco
- Confiar no `workspaceId` enviado pelo frontend

## Consequências positivas

- Isolamento claro
- Modelo simples de membership/roles
- Auditoria por workspace

## Consequências negativas

- Toda query precisa filtrar por workspace
- Autorização incompleta nesta etapa (extensão obrigatória na autenticação)
