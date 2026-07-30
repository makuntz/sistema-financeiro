import { DomainError } from '../shared/domain-error.js';
import { MonthlyPlan } from './monthly-plan.js';
import { MonthlyPlanItem } from './monthly-plan-item.js';
import type {
  MonthlyPlanRepository,
  MonthlyPlanItemRepository,
  MonthlyPlanStore,
} from './monthly-plan-repository.js';
import type { MonthlyPlanProps } from './monthly-plan.js';
import type { MonthlyPlanItemProps } from './monthly-plan-item.js';

export class InMemoryMonthlyPlanRepository
  implements MonthlyPlanRepository, MonthlyPlanItemRepository, MonthlyPlanStore
{
  private readonly plans = new Map<string, MonthlyPlanProps>();
  private readonly items = new Map<string, MonthlyPlanItemProps>();

  async findByWorkspaceAndPeriod(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<MonthlyPlan | null> {
    for (const props of this.plans.values()) {
      if (props.workspaceId === workspaceId && props.year === year && props.month === month) {
        return MonthlyPlan.reconstitute({ ...props });
      }
    }
    return null;
  }

  async save(plan: MonthlyPlan): Promise<void> {
    this.plans.set(plan.id, plan.toProps());
  }

  async findByPlanId(planId: string): Promise<MonthlyPlanItem[]> {
    return [...this.items.values()]
      .filter((i) => i.monthlyPlanId === planId)
      .map((i) => MonthlyPlanItem.reconstitute({ ...i }));
  }

  async savePlanWithItems(
    plan: MonthlyPlan,
    newItems: MonthlyPlanItem[],
    expectedVersion: number | null,
  ): Promise<void> {
    let existingProps: MonthlyPlanProps | undefined;
    for (const props of this.plans.values()) {
      if (
        props.workspaceId === plan.workspaceId &&
        props.year === plan.year &&
        props.month === plan.month
      ) {
        existingProps = props;
        break;
      }
    }

    if (expectedVersion === null && existingProps) {
      throw new DomainError(
        'PLAN_VERSION_CONFLICT',
        'O plano já existe. Envie a versão esperada.',
        {
          currentVersion: existingProps.version,
        },
      );
    }

    if (expectedVersion !== null && existingProps && existingProps.version !== expectedVersion) {
      throw new DomainError('PLAN_VERSION_CONFLICT', 'O plano foi alterado por outro usuário.', {
        currentVersion: existingProps.version,
        expectedVersion,
      });
    }

    const planId = existingProps?.id ?? plan.id;

    if (existingProps) {
      this.plans.delete(existingProps.id);
    }

    const planProps = plan.toProps();
    planProps.id = planId;
    this.plans.set(planId, planProps);

    for (const [id, item] of this.items) {
      if (item.monthlyPlanId === planId) {
        this.items.delete(id);
      }
    }

    for (const item of newItems) {
      this.items.set(item.id, item.toProps());
    }
  }

  clear(): void {
    this.plans.clear();
    this.items.clear();
  }
}
