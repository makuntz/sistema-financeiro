import { canonicalIncludesAny, extractMoneyAtPositions, type MoneyAtPosition } from './money-parser.js';
import type { SpatialElement, VisualRow } from './visual-rows.js';
import { median } from './visual-rows.js';

export type MoneyColumnCluster = {
  normalizedCenterX: number;
  centerX: number;
  count: number;
  values: MoneyAtPosition[];
};

export function clusterMoneyColumns(
  elements: SpatialElement[],
  options?: { toleranceNormalizedX?: number },
): MoneyColumnCluster[] {
  const tolerance = options?.toleranceNormalizedX ?? 0.04;
  const moneyValues = extractMoneyAtPositions(
    elements.map((element) => ({ text: element.text, centerX: element.centerX })),
  );

  const clusters: MoneyColumnCluster[] = [];

  for (const value of moneyValues) {
    const normalizedX = elements.find((element) => element.centerX === value.centerX)?.normalizedCenterX;
    const targetX = normalizedX ?? value.centerX;

    let cluster = clusters.find(
      (entry) => Math.abs(entry.normalizedCenterX - targetX) <= tolerance,
    );

    if (!cluster) {
      cluster = {
        normalizedCenterX: targetX,
        centerX: value.centerX,
        count: 0,
        values: [],
      };
      clusters.push(cluster);
    }

    cluster.count += 1;
    cluster.values.push(value);
    cluster.centerX =
      cluster.values.reduce((sum, item) => sum + item.centerX, 0) / Math.max(cluster.values.length, 1);
    cluster.normalizedCenterX =
      cluster.values.reduce(
        (sum, item) =>
          sum +
          (elements.find((element) => element.centerX === item.centerX)?.normalizedCenterX ??
            item.centerX),
        0,
      ) / Math.max(cluster.values.length, 1);
  }

  return clusters.sort((a, b) => a.normalizedCenterX - b.normalizedCenterX);
}

export function inferTotalCluster(clusters: MoneyColumnCluster[]): MoneyColumnCluster | null {
  if (clusters.length === 0) {
    return null;
  }
  const sorted = [...clusters].sort(
    (a, b) => b.normalizedCenterX - a.normalizedCenterX || b.count - a.count,
  );
  return sorted[0] ?? null;
}

export function inferUnitPriceCluster(clusters: MoneyColumnCluster[]): MoneyColumnCluster | null {
  const total = inferTotalCluster(clusters);
  if (!total) {
    return clusters.length >= 2 ? clusters[clusters.length - 2]! : null;
  }
  const candidates = clusters.filter(
    (cluster) => cluster.normalizedCenterX < total.normalizedCenterX - 0.05,
  );
  if (candidates.length === 0) {
    return null;
  }
  return candidates.sort((a, b) => b.normalizedCenterX - a.normalizedCenterX)[0] ?? null;
}

export function collectItemRegionMoneyElements(rows: VisualRow[]): SpatialElement[] {
  return rows.flatMap((row) => row.elements);
}

export function estimateTotalBandFromClusters(
  clusters: MoneyColumnCluster[],
  pageWidth: number,
): { minX: number; maxX: number; normalizedMinX: number; normalizedMaxX: number; centerX: number } | null {
  const totalCluster = inferTotalCluster(clusters);
  if (!totalCluster) {
    return null;
  }

  const xs = totalCluster.values.map((value) => value.centerX);
  const minX = Math.min(...xs) - pageWidth * 0.03;
  const maxX = Math.max(...xs) + pageWidth * 0.03;

  return {
    centerX: median(xs),
    minX: Math.max(0, minX),
    maxX,
    normalizedMinX: Math.max(0, minX / pageWidth),
    normalizedMaxX: Math.min(1, maxX / pageWidth),
  };
}

export function rowHasPaymentAnchor(row: VisualRow): boolean {
  return canonicalIncludesAny(row.text, ['CARTAO', 'CARTÃO', 'CREDITO', 'CRÉDITO', 'DEBITO', 'DÉBITO', 'PIX']);
}
