import { DomainError } from '../shared/domain-error.js';

export class Email {
  readonly value: string;
  readonly normalized: string;

  private constructor(value: string, normalized: string) {
    this.value = value;
    this.normalized = normalized;
  }

  static normalize(raw: string): string {
    return raw.trim().toLowerCase();
  }

  static create(raw: string): Email {
    const value = raw.trim();
    const normalized = Email.normalize(value);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new DomainError('INVALID_EMAIL', 'Informe um e-mail válido.');
    }

    if (normalized.length > 254) {
      throw new DomainError('INVALID_EMAIL', 'O e-mail deve ter no máximo 254 caracteres.');
    }

    return new Email(value.toLowerCase(), normalized);
  }
}
