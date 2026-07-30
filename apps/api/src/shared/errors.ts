import { DomainError } from '@pp-planning/domain';

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static fromDomain(error: DomainError, statusCode = 400): AppError {
    return new AppError(error.code, error.message, statusCode, error.details);
  }
}

const DOMAIN_CODE_STATUS: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  INVALID_ACCESS_TOKEN: 401,
  INVALID_REFRESH_TOKEN: 401,
  SESSION_REVOKED: 401,
  REFRESH_TOKEN_EXPIRED: 401,
  USER_INACTIVE: 403,
  WORKSPACE_ACCESS_DENIED: 403,
  WORKSPACE_INACTIVE: 403,
  INSUFFICIENT_PERMISSION: 403,
  INVITATION_EMAIL_MISMATCH: 403,
  EMAIL_ALREADY_IN_USE: 409,
  CATEGORY_ALREADY_EXISTS: 409,
  MEMBER_ALREADY_EXISTS: 409,
  LAST_OWNER_REQUIRED: 409,
  INVITATION_ALREADY_ACCEPTED: 409,
  INVITATION_EXPIRED: 410,
  INVITATION_REVOKED: 410,
  INVITATION_DECLINED: 410,
  INVITATION_NOT_FOUND: 404,
  MEMBER_NOT_FOUND: 404,
  WORKSPACE_NOT_FOUND: 404,
};

type FastifyLikeError = Error & {
  statusCode?: number;
  code?: string;
  validation?: unknown;
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof DomainError) {
    const statusCode = DOMAIN_CODE_STATUS[error.code] ?? 400;
    return AppError.fromDomain(error, statusCode);
  }

  if (typeof error === 'object' && error !== null) {
    const fastifyError = error as FastifyLikeError;

    if (fastifyError.validation || fastifyError.statusCode === 400) {
      return new AppError(
        'VALIDATION_ERROR',
        fastifyError.message || 'Dados inválidos.',
        400,
        {
          validation: fastifyError.validation ?? null,
        },
      );
    }

    if (typeof fastifyError.statusCode === 'number' && fastifyError.statusCode < 500) {
      return new AppError(
        fastifyError.code ?? 'REQUEST_ERROR',
        fastifyError.message || 'Erro na requisição.',
        fastifyError.statusCode,
      );
    }
  }

  return new AppError('INTERNAL_SERVER_ERROR', 'Erro interno inesperado.', 500);
}
