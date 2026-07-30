import {
  createApiError,
  type ApiErrorBody,
  type CategoryDto,
  type CreateCategoryRequest,
  type HealthStatus,
} from '@pp-planning/contracts';

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly requestId?: string;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
    this.requestId = body.error.requestId;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: ApiClientOptions['getAccessToken'];
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async listCategories(workspaceId: string): Promise<CategoryDto[]> {
    const query = new URLSearchParams({ workspaceId });
    const response = await this.request<{ data: CategoryDto[] }>(
      `/v1/categories?${query.toString()}`,
    );
    return response.data;
  }

  async createCategory(input: CreateCategoryRequest): Promise<CategoryDto> {
    return this.request<CategoryDto>('/v1/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getAccessToken ? await this.getAccessToken() : null;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let body: ApiErrorBody;

      try {
        body = (await response.json()) as ApiErrorBody;
      } catch {
        body = createApiError({
          code: 'UNKNOWN_ERROR',
          message: 'Erro inesperado ao comunicar com a API.',
        });
      }

      throw new ApiClientError(response.status, body);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
