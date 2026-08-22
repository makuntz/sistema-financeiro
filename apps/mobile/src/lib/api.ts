import { createApiClient, type ApiClient, type ApiClientOptions } from '@pp-planning/api-client';
import { createUnauthorizedHandler, getAccessToken, requestWithAuthRetry } from './session';
import { resolveApiUrl } from './utils';

export const apiUrl = resolveApiUrl();

let workspaceId: string | null = null;
let onSessionExpired: (() => void) | null = null;

const baseClient = createApiClient({
  baseUrl: apiUrl,
  getAccessToken: () => getAccessToken(),
  getWorkspaceId: () => workspaceId,
});

export const rawApiClient = baseClient;

function shouldRetryMethod(prop: string | symbol): boolean {
  if (typeof prop !== 'string') {
    return false;
  }
  return !['refresh', 'login', 'register', 'logout', 'health'].includes(prop);
}

export const apiClient = bindClient(baseClient, shouldRetryMethod);

function bindClient(client: ApiClient, shouldRetry: (prop: string | symbol) => boolean): ApiClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || !shouldRetry(prop)) {
        return value;
      }

      return (...args: unknown[]) => {
        const refreshHandler = onSessionExpired
          ? createUnauthorizedHandler(rawApiClient, onSessionExpired)
          : async () => null;

        return requestWithAuthRetry(
          () => (value as (...inner: unknown[]) => Promise<unknown>).apply(target, args),
          refreshHandler,
        );
      };
    },
  }) as ApiClient;
}

export function setApiWorkspaceId(id: string | null): void {
  workspaceId = id;
}

export function configureApiSession(handlers: { onSessionExpired: () => void }): void {
  onSessionExpired = handlers.onSessionExpired;
}

export function createRawApiClient(options: Partial<ApiClientOptions> = {}): ApiClient {
  return createApiClient({
    baseUrl: apiUrl,
    getAccessToken: options.getAccessToken ?? (() => getAccessToken()),
    getWorkspaceId: options.getWorkspaceId ?? (() => workspaceId),
    fetchImpl: options.fetchImpl,
  });
}

/** @deprecated Legacy storage/worker flow. Prefer on-device OCR via submitReceiptOcrDocument. */
export async function uploadReceiptImage(
  captureId: string,
  image: { uri: string; mimeType: 'image/jpeg' | 'image/png'; sizeInBytes: number },
): Promise<void> {
  const uploadMeta = await apiClient.createReceiptImageUploadUrl(captureId, {
    mimeType: image.mimeType,
    sizeInBytes: image.sizeInBytes,
  });

  const fileResponse = await fetch(image.uri);
  const blob = await fileResponse.blob();

  try {
    // Upload via API → MinIO (avoids emulator talking to MinIO on :9000 directly).
    await apiClient.uploadReceiptImageContent(
      captureId,
      uploadMeta.imageId,
      blob,
      image.mimeType,
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Não foi possível enviar a imagem. Confirme a API (`pnpm dev:api`) e MinIO (`pnpm infra:up`).';
    throw new Error(message);
  }
}
