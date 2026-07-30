# ADR-005: UI web e mobile separadas

## Status

Aceito

## Contexto

React web e React Native não compartilham primitivas de renderização de forma confiável.

## Decisão

Compartilhar tokens, tipos e regras; manter `@pp-planning/ui-web` e `@pp-planning/ui-mobile` separados.

## Alternativas consideradas

- React Native Web para unificar UI
- Componentes compartilhados com muitas ramificações `Platform`

## Consequências positivas

- UX nativa melhor em cada plataforma
- Menos complexidade acidental
- Design system coerente via tokens

## Consequências negativas

- Duplicação controlada de componentes básicos
- Exige governança dos tokens para evitar divergência
