import Constants from 'expo-constants';
import { createApiClient } from '@pp-planning/api-client';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl ?? 'http://localhost:3333';

export const apiClient = createApiClient({
  baseUrl: apiUrl,
  // Extensão futura: token de autenticação
  getAccessToken: async () => null,
});
