import { DomainError } from '../shared/domain-error.js';

export type CategoryType = 'income' | 'expense';

export const CATEGORY_ICON_ALLOWLIST = [
  'tag',
  'shopping-cart',
  'heart',
  'car',
  'home',
  'utensils',
  'pill',
  'dumbbell',
  'briefcase',
  'wallet',
] as const;

export type CategoryIcon = (typeof CATEGORY_ICON_ALLOWLIST)[number];

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function validateCategoryColor(color: string): void {
  if (!HEX_COLOR_REGEX.test(color)) {
    throw new DomainError('INVALID_CATEGORY_COLOR', 'A cor deve estar no formato #RRGGBB.', {
      color,
    });
  }
}

export function validateCategoryIcon(icon: string): void {
  if (!(CATEGORY_ICON_ALLOWLIST as readonly string[]).includes(icon)) {
    throw new DomainError(
      'INVALID_CATEGORY_ICON',
      `Ícone inválido. Permitidos: ${CATEGORY_ICON_ALLOWLIST.join(', ')}.`,
      { icon },
    );
  }
}

export type CategoryProps = {
  id: string;
  workspaceId: string;
  name: string;
  normalizedName: string;
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
  readonly normalized: string;

  private constructor(value: string, normalized: string) {
    this.value = value;
    this.normalized = normalized;
  }

  static normalize(raw: string): string {
    return raw.trim().toLocaleLowerCase('pt-BR');
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

    return new CategoryName(value, CategoryName.normalize(value));
  }

  equals(other: CategoryName): boolean {
    return this.normalized === other.normalized;
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

    const color = input.color ?? '#64748B';
    const icon = input.icon ?? 'tag';
    validateCategoryColor(color);
    validateCategoryIcon(icon);

    return new Category({
      id: input.id,
      workspaceId: input.workspaceId,
      name: name.value,
      normalizedName: name.normalized,
      type: input.type,
      color,
      icon,
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

  get normalizedName(): string {
    return this.props.normalizedName;
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

  update(
    input: { name?: string; color?: string; icon?: string; order?: number },
    now: Date = new Date(),
  ): void {
    if (input.name !== undefined) {
      const categoryName = CategoryName.create(input.name);
      this.props.name = categoryName.value;
      this.props.normalizedName = categoryName.normalized;
    }

    if (input.color !== undefined) {
      validateCategoryColor(input.color);
      this.props.color = input.color;
    }

    if (input.icon !== undefined) {
      validateCategoryIcon(input.icon);
      this.props.icon = input.icon;
    }

    if (input.order !== undefined) {
      this.props.order = input.order;
    }

    this.props.updatedAt = now;
  }

  deactivate(now: Date = new Date()): void {
    this.props = {
      ...this.props,
      isActive: false,
      updatedAt: now,
    };
  }

  activate(now: Date = new Date()): void {
    this.props = {
      ...this.props,
      isActive: true,
      updatedAt: now,
    };
  }

  toProps(): CategoryProps {
    return { ...this.props };
  }
}
