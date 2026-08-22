# PP Planning Mobile

App Expo (Etapa 6+) para escaneamento de notas, classificação de itens e lançamentos manuais.

## Pré-requisitos

- Node 20+
- pnpm 9+
- API rodando (padrão `:3333`) — fluxo legado com upload fake
- Android Studio + SDK (Ubuntu) para OCR ML Kit
- **Development Build** — ML Kit **não funciona no Expo Go**

## Configuração

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

`EXPO_PUBLIC_API_URL` é obrigatória. Para emulador Android use `http://10.0.2.2:3333`; em dispositivo físico use o IP da máquina na rede local.

## Fluxo legado (FakeReceiptExtractor + upload)

Na raiz do monorepo:

```bash
pnpm infra:up
pnpm dev:api
pnpm --filter @pp-planning/api worker:receipts
pnpm --filter @pp-planning/mobile dev -- --clear
```

Use Expo Go **somente** para o fluxo legado (dados mockados).

## Fase A — ML Kit OCR (Development Build Android)

Biblioteca: `@infinitered/react-native-mlkit-text-recognition@1.1.0` (npm publicado; tabela Infinite Red cita ^3.0.0 para SDK 52, mas essa versão não está no npm — usamos 1.1.0 + `@infinitered/react-native-mlkit-core@3.1.0`).

### 1. Instalar dependências (raiz)

```bash
pnpm install
```

### 2. Gerar projeto nativo Android (primeira vez ou após mudar plugins)

```bash
cd apps/mobile
pnpm android:prebuild
```

### 3. Compilar e instalar no emulador/dispositivo

Com emulador Android aberto (`emulator -avd Pixel_7_API_35`) ou USB debugging:

```bash
cd apps/mobile
pnpm android:build
```

### 4. Iniciar Metro para Dev Client

Em outro terminal:

```bash
cd apps/mobile
pnpm dev:client
```

### 5. Abrir tela de diagnóstico

No app: **Mais → Teste de OCR** (somente `__DEV__`).

Tire foto ou escolha da galeria → **Executar OCR**. Nada é enviado à API.

### Comandos úteis

```bash
# Doctor
cd apps/mobile && npx expo doctor

# Listar dispositivos
adb devices

# Limpar build Android
cd apps/mobile/android && ./gradlew clean
```

## Testes

```bash
pnpm --filter @pp-planning/mobile test
pnpm --filter @pp-planning/mobile typecheck
pnpm --filter @pp-planning/mobile lint
```

Testes unitários mockam/adaptam estruturas OCR; **OCR real exige Development Build no Android**.

## Fluxo principal (legado)

1. Login / cadastro com refresh token no SecureStore
2. **Lançar** → Escanear nota → upload → worker fake → conferência → itens → resumo → confirmar
3. Lançamento manual via **Despesa/Receita manual**
4. **Histórico** de capturas e **Mais** (workspace, tema, dev OCR, logout)
