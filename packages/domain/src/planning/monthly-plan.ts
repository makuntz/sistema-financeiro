import { DomainError } from '../shared/domain-error.js';

export type MonthlyPlanProps = {
  id: string;
  workspaceId: string;
  year: number;
  month: number;
  version: number;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export function validatePlanPeriod(year: number, month: number): void {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    throw new DomainError(
      'INVALID_PLAN_PERIOD',
      'Período inválido. Ano deve ser entre 2000-2100 e mês entre 1-12.',
      { year, month },
    );
  }
}

export class MonthlyPlan {
  private constructor(private props: MonthlyPlanProps) {}

  static create(input: {
    id: string;
    workspaceId: string;
    year: number;
    month: number;
    createdByUserId: string;
    now?: Date;
  }): MonthlyPlan {
    validatePlanPeriod(input.year, input.month);
    const now = input.now ?? new Date();

    return new MonthlyPlan({
      id: input.id,
      workspaceId: input.workspaceId,
      year: input.year,
      month: input.month,
      version: 1,
      createdByUserId: input.createdByUserId,
      updatedByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: MonthlyPlanProps): MonthlyPlan {
    return new MonthlyPlan(props);
  }

  get id(): string {
    return this.props.id;
  }
  get workspaceId(): string {
    return this.props.workspaceId;
  }
  get year(): number {
    return this.props.year;
  }
  get month(): number {
    return this.props.month;
  }
  get version(): number {
    return this.props.version;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get updatedByUserId(): string {
    return this.props.updatedByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  bumpVersion(userId: string, now: Date = new Date()): void {
    this.props.version += 1;
    this.props.updatedByUserId = userId;
    this.props.updatedAt = now;
  }

  toProps(): MonthlyPlanProps {
    return { ...this.props };
  }
}
