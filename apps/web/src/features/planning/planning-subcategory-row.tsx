'use client';

import { Badge, MoneyInput } from '@pp-planning/ui-web';
import { GripVertical } from 'lucide-react';
import { PlanningMoneyCell } from './planning-money-cell';
import { PlanningUsageCell } from './planning-usage-cell';
import {
  computeDisplayDifference,
  differenceHint,
  getPlanningColumnLabels,
  toneForPlanned,
  toneForRealized,
  toneForRemaining,
  type PlanningMetricKind,
} from './planning-metrics';

type PlanningSubcategoryRowProps = {
  name: string;
  isActive: boolean;
  kind: PlanningMetricKind;
  plannedInCents: string;
  realizedInCents: string;
  editMode: boolean;
  canWrite: boolean;
  hideValues?: boolean;
  onPlannedChange?: (value: string) => void;
};

export function PlanningSubcategoryRow({
  name,
  isActive,
  kind,
  plannedInCents,
  realizedInCents,
  editMode,
  canWrite,
  hideValues = false,
  onPlannedChange,
}: PlanningSubcategoryRowProps) {
  const labels = getPlanningColumnLabels(kind);
  const remaining = computeDisplayDifference(kind, plannedInCents, realizedInCents);
  const hint = differenceHint(kind, remaining);
  const showUsage = kind === 'expense';
  const gridClass = showUsage ? 'planning-grid is-expense' : 'planning-grid is-income';

  return (
    <li
      className={`${gridClass} planning-sub-row`}
      style={{ opacity: isActive ? 1 : 0.65 }}
      role="row"
    >
      <div className="planning-col-name" role="cell">
        {editMode ? (
          <span className="planning-drag-handle" aria-hidden>
            <GripVertical size={14} />
          </span>
        ) : (
          <span className="planning-sub-bullet" aria-hidden />
        )}
        <span className="planning-sub-name">{name}</span>
        {!isActive ? <Badge variant="warning">Inativa</Badge> : null}
      </div>

      <div className="planning-metrics-row">
        <div className="planning-col-metric planning-col-planned" role="cell">
          <span className="planning-mobile-label">{labels.planned}</span>
          {hideValues ? (
            <span className="planning-hidden-value">••••</span>
          ) : editMode && canWrite && onPlannedChange ? (
            <div className="planning-money-input-wrap">
              <MoneyInput label={name} valueInCents={plannedInCents} onChange={onPlannedChange} />
            </div>
          ) : (
            <PlanningMoneyCell
              cents={plannedInCents}
              tone={toneForPlanned()}
              label={labels.planned}
            />
          )}
        </div>

        <div className="planning-col-metric" role="cell">
          <span className="planning-mobile-label">{labels.realized}</span>
          {hideValues ? (
            <span className="planning-hidden-value">••••</span>
          ) : (
            <PlanningMoneyCell
              cents={realizedInCents}
              tone={kind === 'expense' ? 'negative' : toneForRealized()}
              label={labels.realized}
            />
          )}
        </div>

        <div className="planning-col-metric planning-col-remaining" role="cell">
          <span className="planning-mobile-label">{labels.remaining}</span>
          {hideValues ? (
            <span className="planning-hidden-value">••••</span>
          ) : (
            <div className="planning-remaining-stack">
              <PlanningMoneyCell
                cents={remaining}
                tone={toneForRemaining(remaining)}
                label={labels.remaining}
                emphasize
              />
              {hint ? <span className="planning-remaining-hint">{hint}</span> : null}
            </div>
          )}
        </div>

        {showUsage ? (
          <div className="planning-col-metric planning-col-usage" role="cell">
            <span className="planning-mobile-label">{labels.utilized}</span>
            <PlanningUsageCell
              plannedInCents={plannedInCents}
              realizedInCents={realizedInCents}
              hideValues={hideValues}
            />
          </div>
        ) : null}
      </div>

      <span className="planning-chevron-spacer" aria-hidden />
    </li>
  );
}
