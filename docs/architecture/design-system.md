# Design System

## Tokens primitivos

Paleta bruta, espaçamentos, tipografia, raios, sombras e breakpoints (`packages/design-tokens`).

## Tokens semânticos

Intenção de uso, independentes da marca visual bruta:

- `financial.income|expense|balance|warning|positive|negative`
- `background.default|subtle`
- `text.primary|secondary`
- `border.default`
- `action.primary`

## Figma

1. Variáveis Figma espelham os nomes semânticos.
2. Primitivos alimentam os semânticos.
3. Componentes de plataforma referenciam apenas semânticos.
4. Exportação futura via tokens studio / JSON alinhado ao pacote.

## Tailwind (web)

CSS variables em `tokens.css` + extensão de tema no `tailwind.config.js` do app web.

## React Native

Objeto `semanticTokens` importado diretamente nos StyleSheets de `@pp-planning/ui-mobile`.

## Evitar divergência

- Uma única fonte: `@pp-planning/design-tokens`
- Mesmos nomes entre Figma, web e mobile
- Componentes visuais **não** são compartilhados entre web e RN
- Revisar tokens em PRs que alterem cor/espaçamento semântico
