import { DomainError } from '../shared/domain-error.js';

export type MonthlyPlanItemProps = {
  id: string;
  workspaceId: string;
  monthlyPlanId: string;
  subcategoryId: string;
  plannedAmountInCents: bigint;
};

export function validatePlanAmount(amount: bigint): void {
  if (amount < 0n) {
    throw new DomainError('PLAN_AMOUNT_INVALID', 'O valor planejado não pode ser negativo.', {
      amount: amount.toString(),
    });
  }
}

export class MonthlyPlanItem {
  private constructor(private props: MonthlyPlanItemProps) {}

  static create(input: {
    id: string;
    workspaceId: string;
    monthlyPlanId: string;
    subcategoryId: string;
    plannedAmountInCents: bigint;
  }): MonthlyPlanItem {
    validatePlanAmount(input.plannedAmountInCents);

    return new MonthlyPlanItem({
      id: input.id,
      workspaceId: input.workspaceId,
      monthlyPlanId: input.monthlyPlanId,
      subcategoryId: input.subcategoryId,
      plannedAmountInCents: input.plannedAmountInCents,
    });
  }

  static reconstitute(props: MonthlyPlanItemProps): MonthlyPlanItem {
    return new MonthlyPlanItem(props);
  }

  get id(): string {
    return this.props.id;
  }
  get workspaceId(): string {
    return this.props.workspaceId;
  }
  get monthlyPlanId(): string {
    return this.props.monthlyPlanId;
  }
  get subcategoryId(): string {
    return this.props.subcategoryId;
  }
  get plannedAmountInCents(): bigint {
    return this.props.plannedAmountInCents;
  }

  toProps(): MonthlyPlanItemProps {
    return { ...this.props };
  }
}
