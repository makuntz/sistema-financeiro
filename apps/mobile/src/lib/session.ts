import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, RefreshResponse, UserDto } from '@pp-planning/contracts';
import type { ApiClient } from '@pp-planning/api-client';
import { ApiClientError } from '@pp-planning/api-client';

const REFRESH_TOKEN_KEY = 'pp_planning_refresh_token';

export type SessionState = {
  user: UserDto | null;
  accessToken: string | null;
  isAuthenticated: boolean;
};

type RefreshHandler = () => Promise<string | null>;

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function persistRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearStoredRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function storeSessionTokens(tokens: AuthTokens): Promise<void> {
  setAccessToken(tokens.accessToken);
  await persistRefreshToken(tokens.refreshToken);
}

export async function clearSession(): Promise<void> {
  setAccessToken(null);
  await clearStoredRefreshToken();
}

export function applyAuthResponse(response: RefreshResponse): UserDto {
  void storeSessionTokens(response.tokens);
  return response.user;
}

export async function refreshAccessToken(apiClient: ApiClient): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) {
      await clearSession();
      return null;
    }

    try {
      const response = await apiClient.refresh({ refreshToken });
      await storeSessionTokens(response.tokens);
      return response.tokens.accessToken;
    } catch {
      await clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function createUnauthorizedHandler(
  apiClient: ApiClient,
  onSessionExpired: () => void,
): RefreshHandler {
  return () =>
    refreshAccessToken(apiClient).then((token) => {
      if (!token) {
        onSessionExpired();
      }
      return token;
    });
}

export async function requestWithAuthRetry<T>(
  request: () => Promise<T>,
  refreshHandler: RefreshHandler,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 401) {
      throw error;
    }

    const newToken = await refreshHandler();
    if (!newToken) {
      throw error;
    }

    return request();
  }
}

export function isApiUnauthorized(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}
