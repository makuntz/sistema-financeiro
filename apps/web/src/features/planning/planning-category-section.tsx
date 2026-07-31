'use client';

import { Badge } from '@pp-planning/ui-web';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CategoryIconBadge } from '@/lib/category-icons';
import { PlanningMoneyCell } from './planning-money-cell';
import { PlanningSubcategoryRow } from './planning-subcategory-row';
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

export type PlanningCategoryView = {
  id: string;
  name: string;
  type: PlanningMetricKind;
  color: string;
  icon?: string;
  isActive: boolean;
  plannedInCents: string;
  realizedInCents: string;
  subcategories: Array<{
    id: string;
    name: string;
    isActive: boolean;
    plannedInCents: string;
    realizedInCents: string;
  }>;
};

type PlanningCategorySectionProps = {
  category: PlanningCategoryView;
  isOpen: boolean;
  onToggle: () => void;
  editMode: boolean;
  canWrite: boolean;
  hideValues?: boolean;
  onPlannedChange: (subcategoryId: string, value: string) => void;
};

export function PlanningCategorySection({
  category,
  isOpen,
  onToggle,
  editMode,
  canWrite,
  hideValues = false,
  onPlannedChange,
}: PlanningCategorySectionProps) {
  const labels = getPlanningColumnLabels(category.type);
  const remaining = computeDisplayDifference(
    category.type,
    category.plannedInCents,
    category.realizedInCents,
  );
  const hint = differenceHint(category.type, remaining);
  const panelId = `planning-category-panel-${category.id}`;
  const showUsage = category.type === 'expense';
  const gridClass = showUsage ? 'planning-grid is-expense' : 'planning-grid is-income';

  return (
    <div className="planning-category-block" style={{ opacity: category.isActive ? 1 : 0.65 }}>
      <button
        type="button"
        className={`${gridClass} planning-category-header`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <div className="planning-col-name planning-category-identity">
          <CategoryIconBadge icon={category.icon} color={category.color} size={16} />
          <div className="planning-category-text">
            <span className="planning-category-name">{category.name}</span>
            <span className="planning-category-count">
              {category.subcategories.length}{' '}
              {category.subcategories.length === 1 ? 'subcategoria' : 'subcategorias'}
            </span>
          </div>
          {!category.isActive ? <Badge variant="warning">Arquivada</Badge> : null}
        </div>

        <div className="planning-metrics-row">
          <div className="planning-col-metric">
            <span className="planning-mobile-label">{labels.planned}</span>
            {hideValues ? (
              <span className="planning-hidden-value">••••</span>
            ) : (
              <PlanningMoneyCell
                cents={category.plannedInCents}
                tone={toneForPlanned()}
                label={labels.planned}
                emphasize
              />
            )}
          </div>
          <div className="planning-col-metric">
            <span className="planning-mobile-label">{labels.realized}</span>
            {hideValues ? (
              <span className="planning-hidden-value">••••</span>
            ) : (
              <PlanningMoneyCell
                cents={category.realizedInCents}
                tone={category.type === 'expense' ? 'negative' : toneForRealized()}
                label={labels.realized}
                emphasize
              />
            )}
          </div>
          <div className="planning-col-metric planning-col-remaining">
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
            <div className="planning-col-metric planning-col-usage">
              <span className="planning-mobile-label">{labels.utilized}</span>
              <PlanningUsageCell
                plannedInCents={category.plannedInCents}
                realizedInCents={category.realizedInCents}
                hideValues={hideValues}
              />
            </div>
          ) : null}
        </div>

        <span aria-hidden="true" className="planning-chevron">
          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
      </button>

      {isOpen ? (
        <div id={panelId} className="planning-category-body">
          {category.subcategories.length === 0 ? (
            <p className="planning-empty-subs">Nenhuma subcategoria</p>
          ) : (
            <ul className="planning-sub-list" role="table">
              {category.subcategories.map((sub) => (
                <PlanningSubcategoryRow
                  key={sub.id}
                  name={sub.name}
                  isActive={sub.isActive}
                  kind={category.type}
                  plannedInCents={sub.plannedInCents}
                  realizedInCents={sub.realizedInCents}
                  editMode={editMode}
                  canWrite={canWrite}
                  hideValues={hideValues}
                  onPlannedChange={(value) => onPlannedChange(sub.id, value)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
