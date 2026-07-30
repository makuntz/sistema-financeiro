import type { MonthlyPlan } from './monthly-plan.js';
import type { MonthlyPlanItem } from './monthly-plan-item.js';

export interface MonthlyPlanRepository {
  findByWorkspaceAndPeriod(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<MonthlyPlan | null>;
  save(plan: MonthlyPlan): Promise<void>;
}

export interface MonthlyPlanItemRepository {
  findByPlanId(planId: string): Promise<MonthlyPlanItem[]>;
}

export interface MonthlyPlanStore {
  savePlanWithItems(
    plan: MonthlyPlan,
    items: MonthlyPlanItem[],
    expectedVersion: number | null,
  ): Promise<void>;
}
