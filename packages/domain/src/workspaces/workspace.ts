import { DomainError } from '../shared/domain-error.js';

export type WorkspaceProps = {
  id: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  isActive: boolean;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export class WorkspaceName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): WorkspaceName {
    const value = raw.trim();

    if (value.length < 2) {
      throw new DomainError(
        'WORKSPACE_NAME_TOO_SHORT',
        'O nome do workspace deve ter pelo menos 2 caracteres.',
      );
    }

    if (value.length > 100) {
      throw new DomainError(
        'WORKSPACE_NAME_TOO_LONG',
        'O nome do workspace deve ter no máximo 100 caracteres.',
      );
    }

    return new WorkspaceName(value);
  }
}

export class Workspace {
  private constructor(private props: WorkspaceProps) {}

  static create(input: {
    id: string;
    name: string;
    createdByUserId: string;
    currency?: string;
    locale?: string;
    timezone?: string;
    now?: Date;
  }): Workspace {
    const name = WorkspaceName.create(input.name);
    const now = input.now ?? new Date();

    return new Workspace({
      id: input.id,
      name: name.value,
      currency: input.currency ?? 'BRL',
      locale: input.locale ?? 'pt-BR',
      timezone: input.timezone ?? 'America/Sao_Paulo',
      isActive: true,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static personalName(userFullName: string): string {
    const first = userFullName.trim().split(/\s+/)[0] ?? 'Usuário';
    return `Planejamento de ${first}`;
  }

  static reconstitute(props: WorkspaceProps): Workspace {
    return new Workspace(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get currency(): string {
    return this.props.currency;
  }

  get locale(): string {
    return this.props.locale;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdByUserId(): string {
    return this.props.createdByUserId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(name: string, now: Date = new Date()): void {
    this.props = {
      ...this.props,
      name: WorkspaceName.create(name).value,
      updatedAt: now,
    };
  }

  updateSettings(
    input: { name?: string; locale?: string; timezone?: string },
    now: Date = new Date(),
  ): void {
    this.props = {
      ...this.props,
      name: input.name ? WorkspaceName.create(input.name).value : this.props.name,
      locale: input.locale ?? this.props.locale,
      timezone: input.timezone ?? this.props.timezone,
      updatedAt: now,
    };
  }

  assertActive(): void {
    if (!this.props.isActive) {
      throw new DomainError('WORKSPACE_INACTIVE', 'Este workspace está inativo.');
    }
  }

  toProps(): WorkspaceProps {
    return { ...this.props };
  }
}
