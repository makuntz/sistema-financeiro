import type { User } from './user.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByNormalizedEmail(normalizedEmail: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
