# PP Planning Mobile

App Expo (Etapa 6) para escaneamento de notas, classificação de itens e lançamentos manuais.

## Pré-requisitos

- Node 20+
- pnpm 9+
- API rodando (padrão `:3333`)
- Android Studio / emulador ou dispositivo físico

## Configuração

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

`EXPO_PUBLIC_API_URL` é obrigatória. Para emulador Android use `http://10.0.2.2:3333`; em dispositivo físico use o IP da máquina na rede local.

## Rodar no Android

Na raiz do monorepo:

```bash
pnpm install
pnpm dev:api          # terminal 1 — API
pnpm --filter @pp-planning/mobile android
```

Ou dentro de `apps/mobile`:

```bash
pnpm android
```

## Testes

```bash
pnpm --filter @pp-planning/mobile test
pnpm --filter @pp-planning/mobile typecheck
```

## Fluxo principal

1. Login / cadastro com refresh token no SecureStore
2. **Lançar** → Escanear nota → upload presigned → processamento → conferência → itens → resumo → confirmar
3. Lançamento manual via **Despesa/Receita manual**
4. **Histórico** de capturas e **Mais** (workspace, tema, logout)
