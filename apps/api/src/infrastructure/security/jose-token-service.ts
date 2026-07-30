import { randomBytes, createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { TokenService, IssuedTokens, AccessTokenClaims } from '@pp-planning/domain';
import type { Env } from '@pp-planning/config/env';

export class JoseTokenService implements TokenService {
  private readonly secret: Uint8Array;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlDays: number;

  constructor(env: Env) {
    this.secret = new TextEncoder().encode(env.JWT_SECRET);
    this.accessTokenTtlSeconds = env.ACCESS_TOKEN_TTL_SECONDS;
    this.refreshTokenTtlDays = env.REFRESH_TOKEN_TTL_DAYS;
  }

  async issueTokens(input: {
    userId: string;
    sessionId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<IssuedTokens> {
    const now = Math.floor(Date.now() / 1000);

    const accessToken = await new SignJWT({
      sub: input.userId,
      sid: input.sessionId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + this.accessTokenTtlSeconds)
      .sign(this.secret);

    const refreshToken = this.generateOpaqueToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const refreshTokenExpiresAt = new Date(
      Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.accessTokenTtlSeconds,
      refreshTokenHash,
      refreshTokenExpiresAt,
      sessionId: input.sessionId,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
    });

    const sub = payload.sub;
    const sid = payload['sid'];

    if (typeof sub !== 'string' || typeof sid !== 'string') {
      throw new Error('Invalid token claims');
    }

    return { sub, sid };
  }

  generateOpaqueToken(): string {
    return randomBytes(32).toString('hex');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
