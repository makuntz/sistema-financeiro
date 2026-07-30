export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export type AccessTokenClaims = {
  sub: string;
  sid: string;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
  sessionId: string;
};

export interface TokenService {
  issueTokens(input: {
    userId: string;
    sessionId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<IssuedTokens>;
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
  hashRefreshToken(token: string): string;
  generateOpaqueToken(): string;
}
