import { z } from 'zod';

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).default({}),
    requestId: z.string().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export function createApiError(input: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}): ApiErrorBody {
  return {
    error: {
      code: input.code,
      message: input.message,
      details: input.details ?? {},
      requestId: input.requestId,
    },
  };
}
