import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryMonthlyPlanRepository } from './in-memory-monthly-plan-repository.js';
import { InMemoryTaxonomyProvider } from './in-memory-taxonomy-provider.js';
import { GetMonthlyPlan } from './get-monthly-plan.js';
import { SaveMonthlyPlan } from './save-monthly-plan.js';
import { CopyPreviousMonthlyPlan } from './copy-previous-monthly-plan.js';
import { MonthlyPlan } from './monthly-plan.js';
import { MonthlyPlanItem } from './monthly-plan-item.js';
import { InMemoryAuditLogger } from '../shared/audit.js';
import type { DomainError } from '../shared/domain-error.js';

const W1 = '11111111-1111-1111-1111-111111111111';
const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const CAT_INCOME = 'cc000001-0000-0000-0000-000000000001';
const CAT_EXPENSE = 'cc000002-0000-0000-0000-000000000002';
const CAT_INACTIVE = 'cc000003-0000-0000-0000-000000000003';

const SUB1 = 'ss000001-0000-0000-0000-000000000001';
const SUB2 = 'ss000002-0000-0000-0000-000000000002';
const SUB3 = 'ss000003-0000-0000-0000-000000000003';
const SUB_INACTIVE = 'ss000004-0000-0000-0000-000000000004';
const SUB_IN_INACTIVE_CAT = 'ss000005-0000-0000-0000-000000000005';

function setupTaxonomy(provider: InMemoryTaxonomyProvider): void {
  provider.categories.push(
    {
      id: CAT_INCOME,
      workspaceId: W1,
      name: 'Salários',
      type: 'income',
      color: '#16A34A',
      icon: 'wallet',
      order: 0,
      isActive: true,
    },
    {
      id: CAT_EXPENSE,
      workspaceId: W1,
      name: 'Moradia',
      type: 'expense',
      color: '#9333EA',
      icon: 'home',
      order: 1,
      isActive: true,
    },
    {
      id: CAT_INACTIVE,
      workspaceId: W1,
      name: 'Inativa',
      type: 'expense',
      color: '#000000',
      icon: 'tag',
      order: 2,
      isActive: false,
    },
  );
  provider.subcategories.push(
    {
      id: SUB1,
      workspaceId: W1,
      categoryId: CAT_INCOME,
      name: 'Salário principal',
      order: 0,
      isActive: true,
    },
    {
      id: SUB2,
      workspaceId: W1,
      categoryId: CAT_EXPENSE,
      name: 'Aluguel',
      order: 0,
      isActive: true,
    },
    {
      id: SUB3,
      workspaceId: W1,
      categoryId: CAT_EXPENSE,
      name: 'Condomínio',
      order: 1,
      isActive: true,
    },
    {
      id: SUB_INACTIVE,
      workspaceId: W1,
      categoryId: CAT_EXPENSE,
      name: 'Inativa Sub',
      order: 2,
      isActive: false,
    },
    {
      id: SUB_IN_INACTIVE_CAT,
      workspaceId: W1,
      categoryId: CAT_INACTIVE,
      name: 'Sub em cat inativa',
      order: 0,
      isActive: true,
    },
  );
}

describe('GetMonthlyPlan', () => {
  let repo: InMemoryMonthlyPlanRepository;
  let taxonomy: InMemoryTaxonomyProvider;
  let getMonthlyPlan: GetMonthlyPlan;

  beforeEach(() => {
    repo = new InMemoryMonthlyPlanRepository();
    taxonomy = new InMemoryTaxonomyProvider();
    getMonthlyPlan = new GetMonthlyPlan(repo, repo, taxonomy);
    setupTaxonomy(taxonomy);
  });

  it('returns empty plan when none exists', async () => {
    const result = await getMonthlyPlan.execute({ workspaceId: W1, year: 2026, month: 7 });

    expect(result.exists).toBe(false);
    expect(result.id).toBeNull();
    expect(result.version).toBeNull();
    expect(result.totals.incomePlannedInCents).toBe('0');
    expect(result.totals.expensePlannedInCents).toBe('0');
    expect(result.totals.projectedBalanceInCents).toBe('0');
    expect(result.categories.length).toBeGreaterThan(0);
  });

  it('excludes inactive categories with no persisted amounts', async () => {
    const result = await getMonthlyPlan.execute({ workspaceId: W1, year: 2026, month: 7 });

    const catIds = result.categories.map((c) => c.id);
    expect(catIds).toContain(CAT_INCOME);
    expect(catIds).toContain(CAT_EXPENSE);
    expect(catIds).not.toContain(CAT_INACTIVE);
  });

  it('includes inactive categories that have persisted amounts', async () => {
    const plan = MonthlyPlan.create({
      id: 'plan-1',
      workspaceId: W1,
      year: 2026,
      month: 7,
      createdByUserId: USER,
    });

    const item = MonthlyPlanItem.create({
      id: 'item-1',
      workspaceId: W1,
      monthlyPlanId: 'plan-1',
      subcategoryId: SUB_IN_INACTIVE_CAT,
      plannedAmountInCents: 10000n,
    });
    await repo.savePlanWithItems(plan, [item], null);

    const result = await getMonthlyPlan.execute({ workspaceId: W1, year: 2026, month: 7 });
    const catIds = result.categories.map((c) => c.id);
    expect(catIds).toContain(CAT_INACTIVE);
  });

  it('returns existing plan with correct totals', async () => {
    const plan = MonthlyPlan.create({
      id: 'plan-2',
      workspaceId: W1,
      year: 2026,
      month: 7,
      createdByUserId: USER,
    });
    const planItems = [
      MonthlyPlanItem.create({
        id: 'i1',
        workspaceId: W1,
        monthlyPlanId: 'plan-2',
        subcategoryId: SUB1,
        plannedAmountInCents: 500000n,
      }),
      MonthlyPlanItem.create({
        id: 'i2',
        workspaceId: W1,
        monthlyPlanId: 'plan-2',
        subcategoryId: SUB2,
        plannedAmountInCents: 200000n,
      }),
    ];
    await repo.savePlanWithItems(plan, planItems, null);

    const result = await getMonthlyPlan.execute({ workspaceId: W1, year: 2026, month: 7 });

    expect(result.exists).toBe(true);
    expect(result.version).toBe(1);
    expect(result.totals.incomePlannedInCents).toBe('500000');
    expect(result.totals.expensePlannedInCents).toBe('200000');
    expect(result.totals.projectedBalanceInCents).toBe('300000');
  });

  it('sparse items show as 0 for missing subcategories', async () => {
    const plan = MonthlyPlan.create({
      id: 'plan-3',
      workspaceId: W1,
      year: 2026,
      month: 7,
      createdByUserId: USER,
    });
    const planItems = [
      MonthlyPlanItem.create({
        id: 'i3',
        workspaceId: W1,
        monthlyPlanId: 'plan-3',
        subcategoryId: SUB2,
        plannedAmountInCents: 150000n,
      }),
    ];
    await repo.savePlanWithItems(plan, planItems, null);

    const result = await getMonthlyPlan.execute({ workspaceId: W1, year: 2026, month: 7 });
    const expenseCat = result.categories.find((c) => c.id === CAT_EXPENSE);
    const aluguel = expenseCat?.subcategories.find((s) => s.id === SUB2);
    const condo = expenseCat?.subcategories.find((s) => s.id === SUB3);

    expect(aluguel?.plannedAmountInCents).toBe('150000');
    expect(condo?.plannedAmountInCents).toBe('0');
  });

  it('rejects invalid period', async () => {
    await expect(
      getMonthlyPlan.execute({ workspaceId: W1, year: 1999, month: 7 }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN_PERIOD' } satisfies Partial<DomainError>);

    await expect(
      getMonthlyPlan.execute({ workspaceId: W1, year: 2026, month: 13 }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN_PERIOD' } satisfies Partial<DomainError>);
  });

  it('sorts categories by order then name', async () => {
    const result = await getMonthlyPlan.execute({ workspaceId: W1, year: 2026, month: 7 });

    expect(result.categories[0]!.order).toBeLessThanOrEqual(result.categories[1]!.order);
  });
});

describe('SaveMonthlyPlan', () => {
  let repo: InMemoryMonthlyPlanRepository;
  let taxonomy: InMemoryTaxonomyProvider;
  let auditLogger: InMemoryAuditLogger;
  let saveMonthlyPlan: SaveMonthlyPlan;

  beforeEach(() => {
    repo = new InMemoryMonthlyPlanRepository();
    taxonomy = new InMemoryTaxonomyProvider();
    auditLogger = new InMemoryAuditLogger();
    saveMonthlyPlan = new SaveMonthlyPlan(repo, repo, taxonomy, auditLogger);
    setupTaxonomy(taxonomy);
  });

  it('creates a new plan with expectedVersion=null', async () => {
    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      expectedVersion: null,
      items: [
        { subcategoryId: SUB1, plannedAmountInCents: 500000n },
        { subcategoryId: SUB2, plannedAmountInCents: 200000n },
      ],
    });

    const plan = await repo.findByWorkspaceAndPeriod(W1, 2026, 7);
    expect(plan).not.toBeNull();
    expect(plan!.version).toBe(1);

    const items = await repo.findByPlanId(plan!.id);
    expect(items).toHaveLength(2);

    expect(auditLogger.events).toHaveLength(1);
    expect(auditLogger.events[0]!.name).toBe('MonthlyPlanCreated');
  });

  it('updates existing plan and bumps version', async () => {
    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      expectedVersion: null,
      items: [{ subcategoryId: SUB1, plannedAmountInCents: 500000n }],
    });

    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      expectedVersion: 1,
      items: [
        { subcategoryId: SUB1, plannedAmountInCents: 600000n },
        { subcategoryId: SUB2, plannedAmountInCents: 100000n },
      ],
    });

    const plan = await repo.findByWorkspaceAndPeriod(W1, 2026, 7);
    expect(plan!.version).toBe(2);

    const items = await repo.findByPlanId(plan!.id);
    expect(items).toHaveLength(2);

    expect(auditLogger.events[1]!.name).toBe('MonthlyPlanUpdated');
  });

  it('rejects version conflict', async () => {
    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      expectedVersion: null,
      items: [{ subcategoryId: SUB1, plannedAmountInCents: 500000n }],
    });

    await expect(
      saveMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2026,
        month: 7,
        expectedVersion: 99,
        items: [{ subcategoryId: SUB1, plannedAmountInCents: 600000n }],
      }),
    ).rejects.toMatchObject({ code: 'PLAN_VERSION_CONFLICT' } satisfies Partial<DomainError>);
  });

  it('rejects duplicate subcategory in items', async () => {
    await expect(
      saveMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2026,
        month: 7,
        expectedVersion: null,
        items: [
          { subcategoryId: SUB1, plannedAmountInCents: 100n },
          { subcategoryId: SUB1, plannedAmountInCents: 200n },
        ],
      }),
    ).rejects.toMatchObject({ code: 'PLAN_ITEM_DUPLICATED' } satisfies Partial<DomainError>);
  });

  it('rejects unknown subcategory', async () => {
    await expect(
      saveMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2026,
        month: 7,
        expectedVersion: null,
        items: [
          { subcategoryId: 'unknown-id-1234-5678-1234-567890abcdef', plannedAmountInCents: 100n },
        ],
      }),
    ).rejects.toMatchObject({ code: 'PLAN_SUBCATEGORY_NOT_FOUND' } satisfies Partial<DomainError>);
  });

  it('rejects inactive subcategory', async () => {
    await expect(
      saveMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2026,
        month: 7,
        expectedVersion: null,
        items: [{ subcategoryId: SUB_INACTIVE, plannedAmountInCents: 100n }],
      }),
    ).rejects.toMatchObject({ code: 'PLAN_SUBCATEGORY_INACTIVE' } satisfies Partial<DomainError>);
  });

  it('rejects subcategory in inactive category', async () => {
    await expect(
      saveMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2026,
        month: 7,
        expectedVersion: null,
        items: [{ subcategoryId: SUB_IN_INACTIVE_CAT, plannedAmountInCents: 100n }],
      }),
    ).rejects.toMatchObject({ code: 'PLAN_CATEGORY_INACTIVE' } satisfies Partial<DomainError>);
  });

  it('rejects negative amount', async () => {
    await expect(
      saveMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2026,
        month: 7,
        expectedVersion: null,
        items: [{ subcategoryId: SUB1, plannedAmountInCents: -100n }],
      }),
    ).rejects.toMatchObject({ code: 'PLAN_AMOUNT_INVALID' } satisfies Partial<DomainError>);
  });

  it('sparse storage: zero-amount items are not persisted', async () => {
    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      expectedVersion: null,
      items: [
        { subcategoryId: SUB1, plannedAmountInCents: 500000n },
        { subcategoryId: SUB2, plannedAmountInCents: 0n },
      ],
    });

    const plan = await repo.findByWorkspaceAndPeriod(W1, 2026, 7);
    const items = await repo.findByPlanId(plan!.id);
    expect(items).toHaveLength(1);
    expect(items[0]!.subcategoryId).toBe(SUB1);
  });

  it('rejects invalid period', async () => {
    await expect(
      saveMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2101,
        month: 7,
        expectedVersion: null,
        items: [],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN_PERIOD' } satisfies Partial<DomainError>);
  });
});

describe('CopyPreviousMonthlyPlan', () => {
  let repo: InMemoryMonthlyPlanRepository;
  let taxonomy: InMemoryTaxonomyProvider;
  let auditLogger: InMemoryAuditLogger;
  let saveMonthlyPlan: SaveMonthlyPlan;
  let copyPreviousMonthlyPlan: CopyPreviousMonthlyPlan;

  beforeEach(() => {
    repo = new InMemoryMonthlyPlanRepository();
    taxonomy = new InMemoryTaxonomyProvider();
    auditLogger = new InMemoryAuditLogger();
    saveMonthlyPlan = new SaveMonthlyPlan(repo, repo, taxonomy, auditLogger);
    copyPreviousMonthlyPlan = new CopyPreviousMonthlyPlan(repo, repo, repo, taxonomy, auditLogger);
    setupTaxonomy(taxonomy);
  });

  it('copies previous month items into current month', async () => {
    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 6,
      expectedVersion: null,
      items: [
        { subcategoryId: SUB1, plannedAmountInCents: 500000n },
        { subcategoryId: SUB2, plannedAmountInCents: 200000n },
      ],
    });

    await copyPreviousMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      overwrite: false,
      expectedVersion: null,
    });

    const plan = await repo.findByWorkspaceAndPeriod(W1, 2026, 7);
    expect(plan).not.toBeNull();
    const items = await repo.findByPlanId(plan!.id);
    expect(items).toHaveLength(2);

    const auditCopy = auditLogger.events.find(
      (e) => e.name === 'MonthlyPlanCopiedFromPreviousMonth',
    );
    expect(auditCopy).toBeDefined();
  });

  it('handles January → December previous year', async () => {
    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2025,
      month: 12,
      expectedVersion: null,
      items: [{ subcategoryId: SUB1, plannedAmountInCents: 300000n }],
    });

    await copyPreviousMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 1,
      overwrite: false,
      expectedVersion: null,
    });

    const plan = await repo.findByWorkspaceAndPeriod(W1, 2026, 1);
    expect(plan).not.toBeNull();
  });

  it('throws PREVIOUS_PLAN_NOT_FOUND when no previous plan', async () => {
    await expect(
      copyPreviousMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2026,
        month: 7,
        overwrite: false,
        expectedVersion: null,
      }),
    ).rejects.toMatchObject({ code: 'PREVIOUS_PLAN_NOT_FOUND' } satisfies Partial<DomainError>);
  });

  it('throws PLAN_ALREADY_HAS_VALUES when current plan has values and overwrite=false', async () => {
    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 6,
      expectedVersion: null,
      items: [{ subcategoryId: SUB1, plannedAmountInCents: 500000n }],
    });

    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      expectedVersion: null,
      items: [{ subcategoryId: SUB2, plannedAmountInCents: 100000n }],
    });

    await expect(
      copyPreviousMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2026,
        month: 7,
        overwrite: false,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_ALREADY_HAS_VALUES' } satisfies Partial<DomainError>);
  });

  it('overwrites when overwrite=true', async () => {
    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 6,
      expectedVersion: null,
      items: [{ subcategoryId: SUB1, plannedAmountInCents: 500000n }],
    });

    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      expectedVersion: null,
      items: [{ subcategoryId: SUB2, plannedAmountInCents: 100000n }],
    });

    await copyPreviousMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      overwrite: true,
      expectedVersion: 1,
    });

    const plan = await repo.findByWorkspaceAndPeriod(W1, 2026, 7);
    expect(plan!.version).toBe(2);
    const items = await repo.findByPlanId(plan!.id);
    expect(items).toHaveLength(1);
    expect(items[0]!.subcategoryId).toBe(SUB1);
  });

  it('only copies active taxonomy subcategories', async () => {
    taxonomy.subcategories.push({
      id: 'ss-extra-inactive',
      workspaceId: W1,
      categoryId: CAT_EXPENSE,
      name: 'Deactivated',
      order: 99,
      isActive: true,
    });

    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 6,
      expectedVersion: null,
      items: [
        { subcategoryId: SUB1, plannedAmountInCents: 500000n },
        { subcategoryId: 'ss-extra-inactive', plannedAmountInCents: 100000n },
      ],
    });

    const subToDeactivate = taxonomy.subcategories.find((s) => s.id === 'ss-extra-inactive');
    if (subToDeactivate) subToDeactivate.isActive = false;

    await copyPreviousMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      overwrite: false,
      expectedVersion: null,
    });

    const plan = await repo.findByWorkspaceAndPeriod(W1, 2026, 7);
    const items = await repo.findByPlanId(plan!.id);
    expect(items).toHaveLength(1);
    expect(items[0]!.subcategoryId).toBe(SUB1);
  });

  it('version conflict on copy', async () => {
    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 6,
      expectedVersion: null,
      items: [{ subcategoryId: SUB1, plannedAmountInCents: 500000n }],
    });

    await saveMonthlyPlan.execute({
      workspaceId: W1,
      userId: USER,
      year: 2026,
      month: 7,
      expectedVersion: null,
      items: [{ subcategoryId: SUB2, plannedAmountInCents: 100000n }],
    });

    await expect(
      copyPreviousMonthlyPlan.execute({
        workspaceId: W1,
        userId: USER,
        year: 2026,
        month: 7,
        overwrite: true,
        expectedVersion: 99,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_VERSION_CONFLICT' } satisfies Partial<DomainError>);
  });
});
