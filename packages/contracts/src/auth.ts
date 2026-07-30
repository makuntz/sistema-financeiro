import { z } from 'zod';

export const registerRequestSchema = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(10).max(128),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

export const refreshRequestSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const logoutRequestSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresIn: z.number().int().positive(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

export const registerResponseSchema = z.object({
  user: userSchema,
  tokens: authTokensSchema,
  workspace: z.object({
    id: z.string().uuid(),
    name: z.string(),
    role: z.enum(['owner', 'admin', 'member', 'viewer']),
  }),
});

export const loginResponseSchema = z.object({
  user: userSchema,
  tokens: authTokensSchema,
});

export const refreshResponseSchema = z.object({
  user: userSchema,
  tokens: authTokensSchema,
});

export const meResponseSchema = userSchema;

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type UserDto = z.infer<typeof userSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
