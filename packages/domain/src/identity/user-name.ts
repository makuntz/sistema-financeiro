import { DomainError } from '../shared/domain-error.js';

export class UserName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): UserName {
    const value = raw.trim();

    if (value.length < 2) {
      throw new DomainError(
        'USER_NAME_TOO_SHORT',
        'O nome deve ter pelo menos 2 caracteres.',
      );
    }

    if (value.length > 100) {
      throw new DomainError(
        'USER_NAME_TOO_LONG',
        'O nome deve ter no máximo 100 caracteres.',
      );
    }

    return new UserName(value);
  }

  firstName(): string {
    const [first] = this.value.split(/\s+/);
    return first && first.length > 0 ? first : this.value;
  }
}

export function assertPassword(password: string): void {
  if (password.length < 10) {
    throw new DomainError(
      'PASSWORD_TOO_SHORT',
      'A senha deve ter pelo menos 10 caracteres.',
    );
  }

  if (password.length > 128) {
    throw new DomainError(
      'PASSWORD_TOO_LONG',
      'A senha deve ter no máximo 128 caracteres.',
    );
  }
}
