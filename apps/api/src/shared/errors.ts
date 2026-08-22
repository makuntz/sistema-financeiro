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
  SUBCATEGORY_ALREADY_EXISTS: 409,
  MEMBER_ALREADY_EXISTS: 409,
  LAST_OWNER_REQUIRED: 409,
  INVITATION_ALREADY_ACCEPTED: 409,
  INVITATION_EXPIRED: 410,
  INVITATION_REVOKED: 410,
  INVITATION_DECLINED: 410,
  INVITATION_NOT_FOUND: 404,
  CATEGORY_NOT_FOUND: 404,
  SUBCATEGORY_NOT_FOUND: 404,
  MEMBER_NOT_FOUND: 404,
  WORKSPACE_NOT_FOUND: 404,
  CATEGORY_INACTIVE: 400,
  PLAN_VERSION_CONFLICT: 409,
  PLAN_ALREADY_HAS_VALUES: 409,
  PREVIOUS_PLAN_NOT_FOUND: 404,
  PLAN_SUBCATEGORY_NOT_FOUND: 404,
  PLAN_CATEGORY_INACTIVE: 400,
  PLAN_SUBCATEGORY_INACTIVE: 400,
  PLAN_WORKSPACE_MISMATCH: 400,
  PLAN_ITEM_DUPLICATED: 400,
  PLAN_AMOUNT_INVALID: 400,
  INVALID_PLAN_PERIOD: 400,
  LEDGER_ENTRY_NOT_FOUND: 404,
  LEDGER_SUBCATEGORY_NOT_FOUND: 404,
  LEDGER_MEMBER_NOT_FOUND: 404,
  LEDGER_MEMBER_INACTIVE: 400,
  LEDGER_AMOUNT_INVALID: 400,
  LEDGER_COMPETENCE_INVALID: 400,
  LEDGER_DESCRIPTION_REQUIRED: 400,
  LEDGER_DESCRIPTION_TOO_LONG: 400,
  LEDGER_ENTRY_VOIDED: 400,
  LEDGER_ENTRY_ALREADY_VOIDED: 409,
  LEDGER_ENTRY_NOT_VOIDED: 400,
  LEDGER_VOID_REASON_REQUIRED: 400,
  LEDGER_ENTRY_VERSION_CONFLICT: 409,
  LEDGER_KIND_MISMATCH: 400,
  RECEIPT_CAPTURE_NOT_FOUND: 404,
  RECEIPT_CAPTURE_ALREADY_CONFIRMED: 409,
  RECEIPT_CAPTURE_INVALID_STATUS: 400,
  RECEIPT_IMAGE_REQUIRED: 400,
  RECEIPT_IMAGE_NOT_FOUND: 404,
  RECEIPT_IMAGE_INVALID: 400,
  RECEIPT_IMAGE_TOO_LARGE: 400,
  RECEIPT_IMAGE_LIMIT_EXCEEDED: 400,
  RECEIPT_IMAGE_UPLOAD_INCOMPLETE: 400,
  RECEIPT_PROCESSING_FAILED: 400,
  RECEIPT_PROCESSING_IN_PROGRESS: 409,
  RECEIPT_PROCESSING_NOT_AVAILABLE: 503,
  RECEIPT_ITEM_NOT_FOUND: 404,
  RECEIPT_ITEM_UNASSIGNED: 400,
  RECEIPT_ITEM_VALUE_REQUIRED: 400,
  RECEIPT_ITEM_INVALID: 400,
  RECEIPT_TOTAL_MISMATCH: 400,
  RECEIPT_SUBCATEGORY_INACTIVE: 400,
  RECEIPT_SUBCATEGORY_NOT_FOUND: 404,
  RECEIPT_CATEGORY_INACTIVE: 400,
  RECEIPT_WORKSPACE_MISMATCH: 400,
  RECEIPT_CONFIRMATION_FAILED: 400,
  RECEIPT_EXTRACTOR_INVALID_RESPONSE: 502,
  RECEIPT_EXTRACTOR_NOT_CONFIGURED: 500,
  RECEIPT_JOB_MAX_ATTEMPTS_REACHED: 400,
  RECEIPT_OCR_DOCUMENT_INVALID: 400,
  RECEIPT_OCR_NO_TEXT: 422,
  RECEIPT_OCR_NO_ITEMS: 422,
  RECEIPT_OCR_ALREADY_APPLIED: 409,
  RECEIPT_PARSER_FAILED: 422,
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
      return new AppError('VALIDATION_ERROR', fastifyError.message || 'Dados inválidos.', 400, {
        validation: fastifyError.validation ?? null,
      });
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
