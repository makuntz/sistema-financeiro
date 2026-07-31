import type { LedgerEntryRepository, LedgerMonthlySummary } from './ledger-entry-repository.js';

export type GetMonthlyLedgerSummaryInput = {
  workspaceId: string;
  year: number;
  month: number;
};

export type MonthlyLedgerSummaryResult = LedgerMonthlySummary & {
  year: number;
  month: number;
  balanceInCents: bigint;
};

export class GetMonthlyLedgerSummary {
  constructor(private readonly repository: LedgerEntryRepository) {}

  async execute(input: GetMonthlyLedgerSummaryInput): Promise<MonthlyLedgerSummaryResult> {
    const summary = await this.repository.getMonthlySummary(
      input.workspaceId,
      input.year,
      input.month,
    );

    return {
      ...summary,
      year: input.year,
      month: input.month,
      balanceInCents: summary.totalIncomeInCents - summary.totalExpenseInCents,
    };
  }
}
