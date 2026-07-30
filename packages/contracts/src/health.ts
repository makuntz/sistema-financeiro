import { z } from 'zod';

export const healthStatusSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  version: z.string(),
  checks: z.object({
    database: z.enum(['up', 'down']),
  }),
  timestamp: z.string().datetime(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
