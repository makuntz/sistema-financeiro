# @pp-planning/mobile

Aplicativo mobile (Expo + Expo Router).

Fundação para Android/iOS, com tela de **diagnóstico** e preparação para autenticação e câmera futuras.

## Preparação (api-client)

Em `src/lib/api.ts`, o `createApiClient` aceita `getAccessToken` e `getWorkspaceId`. Na etapa de auth:

- persistir tokens após login/register (SecureStore);
- guardar workspace ativo e repassar via `getWorkspaceId` para enviar `X-Workspace-Id`.

A tela de diagnóstico atual só chama `/health`; não expõe workspace — isso será adicionado com a UI de sessão.
