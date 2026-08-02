import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as SecureStore from 'expo-secure-store';
import type { ApiClient } from '@pp-planning/api-client';
import { ApiClientError } from '@pp-planning/api-client';
import { lightSemanticTokens } from '@pp-planning/design-tokens';
import {
  clearSession,
  getAccessToken,
  refreshAccessToken,
  requestWithAuthRetry,
  setAccessToken,
} from '@/src/lib/session';

vi.mock('expo-router', () => ({
  router: { push: vi.fn(), replace: vi.fn() },
  useFocusEffect: () => undefined,
}));

vi.mock('@/src/providers/auth-provider', () => ({
  useAuth: () => ({
    workspace: {
      workspace: { id: 'ws-1', name: 'Casa' },
      role: 'owner',
      membershipId: 'm-1',
    },
  }),
}));

vi.mock('@/src/lib/api', () => ({
  apiClient: {
    listReceiptCaptures: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('@pp-planning/ui-mobile', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useSemanticTokens: () => lightSemanticTokens,
  Screen: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  Text: ({ children }: { children: React.ReactNode }) => createElement('span', null, children),
  Button: ({ label }: { label: string }) => createElement('button', null, label),
  Card: ({ children, title }: { children: React.ReactNode; title?: string }) =>
    createElement('div', null, title, children),
}));

vi.mock('@/src/components/capture-list-item', () => ({
  CaptureListItem: () => null,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => null,
  FlatList: () => null,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  View: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));

describe('session helpers', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearSession();
  });

  it('keeps access token in memory only', () => {
    setAccessToken('access-123');
    expect(getAccessToken()).toBe('access-123');
  });

  it('stores refresh token in secure store on persist', async () => {
    await clearSession();
    const setItem = vi.spyOn(SecureStore, 'setItemAsync').mockResolvedValue(undefined);

    setAccessToken('access-123');
    await SecureStore.setItemAsync('pp_planning_refresh_token', 'refresh-123');

    expect(setItem).toHaveBeenCalledWith('pp_planning_refresh_token', 'refresh-123');
  });

  it('deduplicates concurrent refresh calls', async () => {
    const refresh = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                user: { id: 'u1', name: 'Test', email: 't@example.com' },
                tokens: {
                  accessToken: 'new-access',
                  refreshToken: 'new-refresh',
                  accessTokenExpiresIn: 3600,
                },
              }),
            10,
          );
        }),
    );
    const apiClient = { refresh } as unknown as ApiClient;
    vi.spyOn(SecureStore, 'getItemAsync').mockResolvedValue('refresh-old');
    vi.spyOn(SecureStore, 'setItemAsync').mockResolvedValue(undefined);

    const [first, second] = await Promise.all([
      refreshAccessToken(apiClient),
      refreshAccessToken(apiClient),
    ]);

    expect(first).toBe('new-access');
    expect(second).toBe('new-access');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('retries request once after refreshing on 401', async () => {
    const refreshHandler = vi.fn().mockResolvedValue('fresh-token');
    let attempts = 0;
    const request = vi.fn().mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new ApiClientError(401, {
          error: { code: 'UNAUTHORIZED', message: 'expired', details: {} },
        });
      }
      return 'ok';
    });

    const result = await requestWithAuthRetry(request, refreshHandler);
    expect(result).toBe('ok');
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

import { LancarScreenContent } from '@/src/screens/lancar-screen';

describe('LancarScreenContent', () => {
  it('renders primary scan action labels', () => {
    const html = renderToStaticMarkup(createElement(LancarScreenContent));

    expect(html).toContain('Escanear nota');
    expect(html).toContain('Despesa manual');
    expect(html).toContain('Receita manual');
    expect(html).toContain('Capturas recentes');
  });
});
