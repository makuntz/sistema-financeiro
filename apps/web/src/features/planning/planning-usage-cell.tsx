'use client';

import { usagePercent } from './planning-metrics';

export function PlanningUsageCell({
  plannedInCents,
  realizedInCents,
  hideValues = false,
}: {
  plannedInCents: string;
  realizedInCents: string;
  hideValues?: boolean;
}) {
  const percent = usagePercent(plannedInCents, realizedInCents);
  const overBudget = percent > 100;
  const barWidth = Math.min(percent, 100);
  const label = `${percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

  if (hideValues) {
    return <span className="planning-hidden-value">••••</span>;
  }

  return (
    <div className="planning-usage-cell">
      <div
        className="planning-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(percent, 100))}
        aria-label={`${label} utilizado`}
      >
        <div
          className={`planning-progress-fill${overBudget ? ' is-over' : ''}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={`planning-usage-pct${overBudget ? ' is-over' : ''}`}>{label}</span>
    </div>
  );
}
