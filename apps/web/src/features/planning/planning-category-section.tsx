'use client';

import { Badge } from '@pp-planning/ui-web';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CategoryIconBadge } from '@/lib/category-icons';
import { PlanningMoneyCell } from './planning-money-cell';
import { PlanningSubcategoryRow } from './planning-subcategory-row';
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

  return (
    <section
      className="planning-table-panel planning-category-panel"
      style={{ opacity: category.isActive ? 1 : 0.65 }}
    >
      <button
        type="button"
        className="planning-category-summary"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="planning-category-identity">
          <CategoryIconBadge icon={category.icon} color={category.color} size={16} />
          <span className="planning-category-text">
            <span className="planning-category-name">{category.name}</span>
            <span className="planning-category-count">
              {category.subcategories.length}{' '}
              {category.subcategories.length === 1 ? 'subcategoria' : 'subcategorias'}
            </span>
          </span>
          {!category.isActive ? <Badge variant="warning">Arquivada</Badge> : null}
        </span>

        {hideValues ? (
          <>
            <span className="planning-category-summary-metric">
              <span className="planning-hidden-value">••••</span>
            </span>
            <span className="planning-category-summary-metric">
              <span className="planning-hidden-value">••••</span>
            </span>
            <span className="planning-category-summary-metric">
              <span className="planning-hidden-value">••••</span>
            </span>
          </>
        ) : (
          <>
            <span className="planning-category-summary-metric">
              <span className="planning-category-summary-label">{labels.planned}</span>
              <PlanningMoneyCell
                cents={category.plannedInCents}
                tone={toneForPlanned()}
                label={labels.planned}
                emphasize
              />
            </span>
            <span className="planning-category-summary-metric">
              <span className="planning-category-summary-label">{labels.realized}</span>
              <PlanningMoneyCell
                cents={category.realizedInCents}
                tone={category.type === 'expense' ? 'negative' : toneForRealized()}
                label={labels.realized}
                emphasize
              />
            </span>
            <span className="planning-category-summary-metric">
              <span className="planning-category-summary-label">{labels.remaining}</span>
              <span className="planning-remaining-stack">
                <PlanningMoneyCell
                  cents={remaining}
                  tone={toneForRemaining(remaining)}
                  label={labels.remaining}
                  emphasize
                />
                {hint ? <span className="planning-remaining-hint">{hint}</span> : null}
              </span>
            </span>
          </>
        )}

        <span className="planning-chevron-btn" aria-hidden="true">
          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
      </button>

      {isOpen ? (
        <div className="planning-table-scroll" id={panelId}>
          <div className="planning-sub-list" role="table" aria-label={category.name}>
            {category.subcategories.length === 0 ? (
              <p className="planning-empty-subs">Nenhuma subcategoria</p>
            ) : (
              category.subcategories.map((sub) => (
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
              ))
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
