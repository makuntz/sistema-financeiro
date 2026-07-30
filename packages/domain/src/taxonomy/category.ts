import { DomainError } from '../shared/domain-error.js';

export type CategoryType = 'income' | 'expense';

export type CategoryProps = {
  id: string;
  workspaceId: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class CategoryName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): CategoryName {
    const value = raw.trim();

    if (value.length < 2) {
      throw new DomainError(
        'CATEGORY_NAME_TOO_SHORT',
        'O nome da categoria deve ter pelo menos 2 caracteres.',
      );
    }

    if (value.length > 80) {
      throw new DomainError(
        'CATEGORY_NAME_TOO_LONG',
        'O nome da categoria deve ter no máximo 80 caracteres.',
      );
    }

    return new CategoryName(value);
  }

  equals(other: CategoryName): boolean {
    return this.value.toLocaleLowerCase('pt-BR') === other.value.toLocaleLowerCase('pt-BR');
  }
}

export class Category {
  private constructor(private props: CategoryProps) {}

  static create(input: {
    id: string;
    workspaceId: string;
    name: string;
    type: CategoryType;
    color?: string;
    icon?: string;
    order?: number;
    now?: Date;
  }): Category {
    const name = CategoryName.create(input.name);
    const now = input.now ?? new Date();

    return new Category({
      id: input.id,
      workspaceId: input.workspaceId,
      name: name.value,
      type: input.type,
      color: input.color ?? '#64748B',
      icon: input.icon ?? 'tag',
      order: input.order ?? 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: CategoryProps): Category {
    return new Category(props);
  }

  get id(): string {
    return this.props.id;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): CategoryType {
    return this.props.type;
  }

  get color(): string {
    return this.props.color;
  }

  get icon(): string {
    return this.props.icon;
  }

  get order(): number {
    return this.props.order;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  deactivate(now: Date = new Date()): void {
    this.props = {
      ...this.props,
      isActive: false,
      updatedAt: now,
    };
  }

  toProps(): CategoryProps {
    return { ...this.props };
  }
}
