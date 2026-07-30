export type AuthSessionProps = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class AuthSession {
  private constructor(private props: AuthSessionProps) {}

  static create(input: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
    now?: Date;
  }): AuthSession {
    const now = input.now ?? new Date();

    return new AuthSession({
      id: input.id,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: AuthSessionProps): AuthSession {
    return new AuthSession(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get refreshTokenHash(): string {
    return this.props.refreshTokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }

  get userAgent(): string | null {
    return this.props.userAgent;
  }

  get ipAddress(): string | null {
    return this.props.ipAddress;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.props.expiresAt.getTime() <= now.getTime();
  }

  isUsable(now: Date = new Date()): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  revoke(now: Date = new Date()): void {
    this.props = {
      ...this.props,
      revokedAt: now,
      updatedAt: now,
    };
  }

  markUsed(now: Date = new Date()): void {
    this.props = {
      ...this.props,
      lastUsedAt: now,
      updatedAt: now,
    };
  }

  toProps(): AuthSessionProps {
    return { ...this.props };
  }
}
