import { createApiClient } from '@pp-planning/api-client';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:3333';

export const apiClient = createApiClient({
  baseUrl: apiUrl,
  // Extensão futura: injetar token de autenticação
  getAccessToken: async () => null,
});

export function getPublicApiUrl(): string {
  return apiUrl;
}
