import { DomainError } from '../shared/domain-error.js';

export type SubcategoryProps = {
  id: string;
  workspaceId: string;
  categoryId: string;
  name: string;
  normalizedName: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class SubcategoryName {
  readonly value: string;
  readonly normalized: string;

  private constructor(value: string, normalized: string) {
    this.value = value;
    this.normalized = normalized;
  }

  static normalize(raw: string): string {
    return raw.trim().toLocaleLowerCase('pt-BR');
  }

  static create(raw: string): SubcategoryName {
    const value = raw.trim();

    if (value.length < 2) {
      throw new DomainError(
        'SUBCATEGORY_NAME_TOO_SHORT',
        'O nome da subcategoria deve ter pelo menos 2 caracteres.',
      );
    }

    if (value.length > 100) {
      throw new DomainError(
        'SUBCATEGORY_NAME_TOO_LONG',
        'O nome da subcategoria deve ter no máximo 100 caracteres.',
      );
    }

    return new SubcategoryName(value, SubcategoryName.normalize(value));
  }

  equals(other: SubcategoryName): boolean {
    return this.normalized === other.normalized;
  }
}

export class Subcategory {
  private constructor(private props: SubcategoryProps) {}

  static create(input: {
    id: string;
    workspaceId: string;
    categoryId: string;
    name: string;
    order?: number;
    now?: Date;
  }): Subcategory {
    const name = SubcategoryName.create(input.name);
    const now = input.now ?? new Date();

    return new Subcategory({
      id: input.id,
      workspaceId: input.workspaceId,
      categoryId: input.categoryId,
      name: name.value,
      normalizedName: name.normalized,
      order: input.order ?? 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: SubcategoryProps): Subcategory {
    return new Subcategory(props);
  }

  get id(): string {
    return this.props.id;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get categoryId(): string {
    return this.props.categoryId;
  }

  get name(): string {
    return this.props.name;
  }

  get normalizedName(): string {
    return this.props.normalizedName;
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

  update(input: { name?: string; order?: number }, now: Date = new Date()): void {
    if (input.name !== undefined) {
      const subcategoryName = SubcategoryName.create(input.name);
      this.props.name = subcategoryName.value;
      this.props.normalizedName = subcategoryName.normalized;
    }

    if (input.order !== undefined) {
      this.props.order = input.order;
    }

    this.props.updatedAt = now;
  }

  deactivate(now: Date = new Date()): void {
    this.props = { ...this.props, isActive: false, updatedAt: now };
  }

  activate(now: Date = new Date()): void {
    this.props = { ...this.props, isActive: true, updatedAt: now };
  }

  toProps(): SubcategoryProps {
    return { ...this.props };
  }
}
