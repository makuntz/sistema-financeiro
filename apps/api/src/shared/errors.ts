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
    const statusCode = error.code === 'CATEGORY_ALREADY_EXISTS' ? 409 : 400;
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
