'use client';

import { formatCentsToBRL } from '@pp-planning/contracts';
import type { MoneySemanticTone } from './planning-metrics';

type PlanningMoneyCellProps = {
  cents: string;
  tone: MoneySemanticTone;
  label: string;
  emphasize?: boolean;
};

const TONE_COLOR: Record<MoneySemanticTone, string> = {
  neutral: 'var(--text-primary)',
  muted: 'var(--text-secondary)',
  positive: 'var(--status-success)',
  negative: 'var(--status-danger)',
  emphasis: 'var(--action-primary)',
};

export function PlanningMoneyCell({
  cents,
  tone,
  label,
  emphasize = false,
}: PlanningMoneyCellProps) {
  const value = cents || '0';
  const isZero = BigInt(value) === 0n;
  const color = isZero && tone !== 'negative' ? TONE_COLOR.muted : TONE_COLOR[tone];

  return (
    <span
      className="planning-money-cell"
      style={{
        color,
        fontWeight: emphasize ? 700 : 500,
      }}
      aria-label={`${label}: ${formatCentsToBRL(value)}`}
    >
      <span className="planning-sr-only">{label}: </span>
      {formatCentsToBRL(value)}
    </span>
  );
}
