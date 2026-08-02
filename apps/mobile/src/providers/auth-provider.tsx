import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserDto, WorkspaceSummaryDto } from '@pp-planning/contracts';
import { apiClient, configureApiSession, rawApiClient, setApiWorkspaceId } from '@/src/lib/api';
import {
  applyAuthResponse,
  clearSession,
  getStoredRefreshToken,
  storeSessionTokens,
} from '@/src/lib/session';

const WORKSPACE_KEY = 'pp_planning_workspace_id';
const THEME_KEY = 'pp_planning_theme';

export type ThemePreference = 'light' | 'dark' | 'system';

type AuthContextValue = {
  user: UserDto | null;
  workspaces: WorkspaceSummaryDto[];
  workspaceId: string | null;
  workspace: WorkspaceSummaryDto | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummaryDto[]>([]);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setWorkspaces([]);
    setWorkspaceIdState(null);
    setApiWorkspaceId(null);
  }, []);

  const selectWorkspace = useCallback(async (id: string) => {
    setWorkspaceIdState(id);
    setApiWorkspaceId(id);
    await AsyncStorage.setItem(WORKSPACE_KEY, id);
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const response = await apiClient.listWorkspaces();
    setWorkspaces(response.data);

    const storedId = await AsyncStorage.getItem(WORKSPACE_KEY);
    const validStored = storedId && response.data.some((w) => w.workspace.id === storedId);
    const nextId = validStored ? storedId : (response.data[0]?.workspace.id ?? null);

    if (nextId) {
      await selectWorkspace(nextId);
    } else {
      setWorkspaceIdState(null);
      setApiWorkspaceId(null);
    }
  }, [selectWorkspace]);

  const bootstrap = useCallback(async () => {
    try {
      const storedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        setThemePreferenceState(storedTheme);
      }

      const refreshToken = await getStoredRefreshToken();
      if (!refreshToken) {
        return;
      }

      const refreshed = await rawApiClient.refresh({ refreshToken });
      await storeSessionTokens(refreshed.tokens);
      setUser(refreshed.user);
      await refreshWorkspaces();
    } catch {
      await clearSession();
      handleSessionExpired();
    } finally {
      setIsBootstrapping(false);
    }
  }, [handleSessionExpired, refreshWorkspaces]);

  useEffect(() => {
    configureApiSession({ onSessionExpired: handleSessionExpired });
    void bootstrap();
  }, [bootstrap, handleSessionExpired]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.login({ email, password });
      await storeSessionTokens(response.tokens);
      setUser(response.user);
      await refreshWorkspaces();
    },
    [refreshWorkspaces],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await apiClient.register({ name, email, password });
      await storeSessionTokens(response.tokens);
      setUser(response.user);
      await selectWorkspace(response.workspace.id);
      await refreshWorkspaces();
    },
    [refreshWorkspaces, selectWorkspace],
  );

  const logout = useCallback(async () => {
    const refreshToken = await getStoredRefreshToken();
    if (refreshToken) {
      try {
        await rawApiClient.logout({ refreshToken });
      } catch {
        // Ignore logout API errors and clear local session anyway.
      }
    }
    await clearSession();
    handleSessionExpired();
  }, [handleSessionExpired]);

  const setThemePreference = useCallback(async (value: ThemePreference) => {
    setThemePreferenceState(value);
    await AsyncStorage.setItem(THEME_KEY, value);
  }, []);

  const workspace = useMemo(
    () => workspaces.find((item) => item.workspace.id === workspaceId) ?? null,
    [workspaces, workspaceId],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      workspaces,
      workspaceId,
      workspace,
      isBootstrapping,
      isAuthenticated: Boolean(user),
      themePreference,
      setThemePreference,
      login,
      register,
      logout,
      selectWorkspace,
      refreshWorkspaces,
    }),
    [
      user,
      workspaces,
      workspaceId,
      workspace,
      isBootstrapping,
      themePreference,
      setThemePreference,
      login,
      register,
      logout,
      selectWorkspace,
      refreshWorkspaces,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}

export { applyAuthResponse };
