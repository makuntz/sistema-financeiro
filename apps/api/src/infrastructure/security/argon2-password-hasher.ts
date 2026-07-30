import argon2 from 'argon2';
import type { PasswordHasher } from '@pp-planning/domain';
import type { Env } from '@pp-planning/config/env';

export class Argon2PasswordHasher implements PasswordHasher {
  private readonly memoryCost: number;
  private readonly timeCost: number;
  private readonly parallelism: number;

  constructor(env: Env) {
    if (env.NODE_ENV === 'test') {
      this.memoryCost = 4096;
      this.timeCost = 1;
      this.parallelism = 1;
    } else {
      this.memoryCost = env.PASSWORD_HASH_MEMORY_COST;
      this.timeCost = env.PASSWORD_HASH_TIME_COST;
      this.parallelism = env.PASSWORD_HASH_PARALLELISM;
    }
  }

  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.memoryCost,
      timeCost: this.timeCost,
      parallelism: this.parallelism,
    });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
