'use client';

import type { PlanningColumnLabels } from './planning-metrics';

type PlanningColumnHeaderProps = {
  labels: PlanningColumnLabels;
  showUsage?: boolean;
};

export function PlanningColumnHeader({ labels, showUsage = false }: PlanningColumnHeaderProps) {
  const gridClass = showUsage ? 'planning-grid is-expense' : 'planning-grid is-income';

  return (
    <div className={`${gridClass} planning-column-header`} role="row">
      <div className="planning-col-name" role="columnheader">
        {labels.name}
      </div>
      <div className="planning-metrics-row">
        <div className="planning-col-metric" role="columnheader">
          {labels.planned}
        </div>
        <div className="planning-col-metric" role="columnheader">
          {labels.realized}
        </div>
        <div className="planning-col-metric" role="columnheader">
          {labels.remaining}
        </div>
        {showUsage && labels.utilized ? (
          <div className="planning-col-metric" role="columnheader">
            {labels.utilized}
          </div>
        ) : null}
      </div>
      <span className="planning-chevron-spacer" aria-hidden />
    </div>
  );
}
