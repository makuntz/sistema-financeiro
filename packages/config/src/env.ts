import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3333),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    WEB_URL: z.string().url().default('http://localhost:3000'),
    API_URL: z.string().url().default('http://localhost:3333'),
    MOBILE_API_URL: z.string().url().default('http://localhost:3333'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 caracteres'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    PASSWORD_HASH_MEMORY_COST: z.coerce.number().int().positive().default(19456),
    PASSWORD_HASH_TIME_COST: z.coerce.number().int().positive().default(2),
    PASSWORD_HASH_PARALLELISM: z.coerce.number().int().positive().default(1),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().default('pp-planning'),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    HOST: z.string().default('0.0.0.0'),
    RECEIPT_EXTRACTOR_PROVIDER: z.enum(['fake']).default('fake'),
    RECEIPT_PROCESSING_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
    RECEIPT_PROCESSING_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
    RECEIPT_IMAGE_MAX_SIZE_BYTES: z.coerce.number().int().positive().default(10_485_760),
    RECEIPT_IMAGE_MAX_COUNT: z.coerce.number().int().positive().max(10).default(3),
    RECEIPT_ALLOW_FAKE_IN_PRODUCTION: z.coerce.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'Em produção, JWT_SECRET deve ter pelo menos 32 caracteres',
      });
    }

    if (value.NODE_ENV === 'production' && value.JWT_SECRET.includes('change-me')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET de desenvolvimento não pode ser usado em produção',
      });
    }

    if (
      value.NODE_ENV === 'production' &&
      value.RECEIPT_EXTRACTOR_PROVIDER === 'fake' &&
      !value.RECEIPT_ALLOW_FAKE_IN_PRODUCTION
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RECEIPT_EXTRACTOR_PROVIDER'],
        message:
          'Em produção, RECEIPT_EXTRACTOR_PROVIDER=fake exige RECEIPT_ALLOW_FAKE_IN_PRODUCTION=true',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Variáveis de ambiente inválidas:\n${details}`);
  }

  return result.data;
}

export { envSchema };
