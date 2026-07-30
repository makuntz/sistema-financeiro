import {
  createApiError,
  type ApiErrorBody,
  type CategoryWithSubcategoriesDto,
  type CategoryDto,
  type SubcategoryDto,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
  type CreateSubcategoryRequest,
  type UpdateSubcategoryRequest,
  type HealthStatus,
  type RegisterRequest,
  type RegisterResponse,
  type LoginRequest,
  type LoginResponse,
  type RefreshRequest,
  type RefreshResponse,
  type UserDto,
  type CreateWorkspaceRequest,
  type WorkspaceSummaryDto,
  type WorkspaceDto,
  type UpdateWorkspaceRequest,
  type MemberDto,
  type ChangeMemberRoleRequest,
  type CreateInvitationRequest,
  type CreateInvitationResponse,
  type InvitationDto,
  type InvitationPreviewDto,
  type MonthlyPlanDto,
  type SaveMonthlyPlanRequest,
  type CopyPreviousMonthlyPlanRequest,
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

export type TokenProvider = () => string | null | Promise<string | null>;
export type WorkspaceProvider = () => string | null | Promise<string | null>;

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: TokenProvider;
  getWorkspaceId?: WorkspaceProvider;
  fetchImpl?: typeof fetch;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: TokenProvider;
  private readonly getWorkspaceId?: WorkspaceProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
    this.getWorkspaceId = options.getWorkspaceId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  // --- System ---

  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  // --- Auth ---

  async register(input: RegisterRequest): Promise<RegisterResponse> {
    return this.request<RegisterResponse>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async login(input: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async refresh(input: RefreshRequest): Promise<RefreshResponse> {
    return this.request<RefreshResponse>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async logout(input: { refreshToken: string }): Promise<void> {
    await this.request<void>('/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async me(): Promise<UserDto> {
    return this.request<UserDto>('/v1/auth/me');
  }

  // --- Workspaces ---

  async listWorkspaces(): Promise<{ data: WorkspaceSummaryDto[] }> {
    return this.request<{ data: WorkspaceSummaryDto[] }>('/v1/workspaces');
  }

  async createWorkspace(input: CreateWorkspaceRequest): Promise<WorkspaceSummaryDto> {
    return this.request<WorkspaceSummaryDto>('/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getCurrentWorkspace(): Promise<WorkspaceDto> {
    return this.request<WorkspaceDto>('/v1/workspaces/current');
  }

  async updateCurrentWorkspace(input: UpdateWorkspaceRequest): Promise<WorkspaceDto> {
    return this.request<WorkspaceDto>('/v1/workspaces/current', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  // --- Members ---

  async listMembers(): Promise<{ data: MemberDto[] }> {
    return this.request<{ data: MemberDto[] }>('/v1/workspaces/current/members');
  }

  async changeMemberRole(memberId: string, input: ChangeMemberRoleRequest): Promise<void> {
    await this.request<void>(`/v1/workspaces/current/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async deactivateMember(memberId: string): Promise<void> {
    await this.request<void>(`/v1/workspaces/current/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async leaveWorkspace(): Promise<void> {
    await this.request<void>('/v1/workspaces/current/leave', { method: 'POST' });
  }

  // --- Invitations ---

  async createInvitation(input: CreateInvitationRequest): Promise<CreateInvitationResponse> {
    return this.request<CreateInvitationResponse>('/v1/workspaces/current/invitations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listInvitations(): Promise<{ data: InvitationDto[] }> {
    return this.request<{ data: InvitationDto[] }>('/v1/workspaces/current/invitations');
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    await this.request<void>(`/v1/workspaces/current/invitations/${invitationId}/revoke`, {
      method: 'POST',
    });
  }

  async getInvitationPreview(token: string): Promise<InvitationPreviewDto> {
    return this.request<InvitationPreviewDto>(`/v1/invitations/${token}`);
  }

  async acceptInvitation(token: string): Promise<void> {
    await this.request<void>(`/v1/invitations/${token}/accept`, { method: 'POST' });
  }

  async declineInvitation(token: string): Promise<void> {
    await this.request<void>(`/v1/invitations/${token}/decline`, { method: 'POST' });
  }

  // --- Taxonomy ---

  async listCategories(query?: {
    type?: string;
    includeInactive?: boolean;
    search?: string;
  }): Promise<{ data: CategoryWithSubcategoriesDto[] }> {
    const params = new URLSearchParams();
    if (query?.type) params.set('type', query.type);
    if (query?.includeInactive) params.set('includeInactive', 'true');
    if (query?.search) params.set('search', query.search);
    const qs = params.toString();
    return this.request<{ data: CategoryWithSubcategoriesDto[] }>(
      `/v1/categories${qs ? `?${qs}` : ''}`,
    );
  }

  async createCategory(input: CreateCategoryRequest): Promise<CategoryDto> {
    return this.request<CategoryDto>('/v1/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateCategory(categoryId: string, input: UpdateCategoryRequest): Promise<CategoryDto> {
    return this.request<CategoryDto>(`/v1/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async inactivateCategory(categoryId: string): Promise<CategoryDto> {
    return this.request<CategoryDto>(`/v1/categories/${categoryId}/inactivate`, {
      method: 'POST',
    });
  }

  async reactivateCategory(categoryId: string): Promise<CategoryDto> {
    return this.request<CategoryDto>(`/v1/categories/${categoryId}/reactivate`, {
      method: 'POST',
    });
  }

  async listSubcategories(categoryId: string): Promise<{ data: SubcategoryDto[] }> {
    return this.request<{ data: SubcategoryDto[] }>(`/v1/categories/${categoryId}/subcategories`);
  }

  async createSubcategory(
    categoryId: string,
    input: CreateSubcategoryRequest,
  ): Promise<SubcategoryDto> {
    return this.request<SubcategoryDto>(`/v1/categories/${categoryId}/subcategories`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateSubcategory(
    subcategoryId: string,
    input: UpdateSubcategoryRequest,
  ): Promise<SubcategoryDto> {
    return this.request<SubcategoryDto>(`/v1/subcategories/${subcategoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async inactivateSubcategory(subcategoryId: string): Promise<SubcategoryDto> {
    return this.request<SubcategoryDto>(`/v1/subcategories/${subcategoryId}/inactivate`, {
      method: 'POST',
    });
  }

  async reactivateSubcategory(subcategoryId: string): Promise<SubcategoryDto> {
    return this.request<SubcategoryDto>(`/v1/subcategories/${subcategoryId}/reactivate`, {
      method: 'POST',
    });
  }

  // --- Planning ---

  async getMonthlyPlan(year: number, month: number): Promise<MonthlyPlanDto> {
    return this.request<MonthlyPlanDto>(`/v1/planning/monthly/${year}/${month}`);
  }

  async saveMonthlyPlan(
    year: number,
    month: number,
    input: SaveMonthlyPlanRequest,
  ): Promise<MonthlyPlanDto> {
    return this.request<MonthlyPlanDto>(`/v1/planning/monthly/${year}/${month}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async copyPreviousMonthlyPlan(
    year: number,
    month: number,
    input: CopyPreviousMonthlyPlanRequest,
  ): Promise<MonthlyPlanDto> {
    return this.request<MonthlyPlanDto>(`/v1/planning/monthly/${year}/${month}/copy-previous`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // --- Internal ---

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

    const workspaceId = this.getWorkspaceId ? await this.getWorkspaceId() : null;
    if (workspaceId) {
      headers.set('X-Workspace-Id', workspaceId);
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
