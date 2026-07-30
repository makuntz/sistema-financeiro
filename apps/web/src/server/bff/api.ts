/**
 * Server-side fetch helper that calls the Fastify API backend.
 * Attaches Authorization header and X-Workspace-Id when provided.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3333';

export type ApiRequestInit = Omit<RequestInit, 'headers'> & {
  accessToken?: string;
  workspaceId?: string;
  headers?: Record<string, string>;
};

export async function apiFetch(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const { accessToken, workspaceId, headers: extra, ...rest } = init;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  if (workspaceId) {
    headers['X-Workspace-Id'] = workspaceId;
  }

  const url = `${API_URL}${path}`;
  return fetch(url, { ...rest, headers });
}
