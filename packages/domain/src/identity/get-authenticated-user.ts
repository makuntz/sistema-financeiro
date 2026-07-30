import { DomainError } from '../shared/domain-error.js';
import type { UserRepository } from './user-repository.js';
import type { User } from './user.js';

export class GetAuthenticatedUser {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);

    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE', 'Usuário inativo.');
    }

    return user;
  }
}
