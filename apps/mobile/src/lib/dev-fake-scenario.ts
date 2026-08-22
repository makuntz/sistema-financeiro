import type { ReceiptFakeScenario } from '@pp-planning/contracts';

export type DevFakeScenarioOption = {
  value: ReceiptFakeScenario | null;
  label: string;
  description: string;
};

export const DEV_FAKE_SCENARIO_OPTIONS: DevFakeScenarioOption[] = [
  { value: null, label: 'Padrão', description: 'Extração ok — 4 itens, R$ 132,20' },
  { value: 'success', label: 'Success', description: 'Igual ao padrão (4 itens)' },
  {
    value: 'missing-item-value',
    label: 'Sem valor',
    description: 'Um item sem valor → revisão obrigatória',
  },
  {
    value: 'total-mismatch',
    label: 'Total divergente',
    description: 'Total da nota ≠ soma dos itens',
  },
  {
    value: 'processing-failure',
    label: 'Falha no job',
    description: 'Processamento falha após retries',
  },
  {
    value: 'long-receipt',
    label: 'Nota longa',
    description: '12 itens para testar listagem',
  },
];

let selectedScenario: ReceiptFakeScenario | null = null;

/** Dev-only picker for FakeReceiptExtractor scenarios. Never shown in production builds. */
export function isDevFakeScenarioPickerEnabled(): boolean {
  return __DEV__;
}

export function getDevFakeScenario(): ReceiptFakeScenario | undefined {
  return selectedScenario ?? undefined;
}

export function getDevFakeScenarioSelection(): ReceiptFakeScenario | null {
  return selectedScenario;
}

export function setDevFakeScenario(scenario: ReceiptFakeScenario | null): void {
  selectedScenario = scenario;
}

export function findDevFakeScenarioOption(
  value: ReceiptFakeScenario | null,
): DevFakeScenarioOption {
  return (
    DEV_FAKE_SCENARIO_OPTIONS.find((option) => option.value === value) ??
    DEV_FAKE_SCENARIO_OPTIONS[0]
  );
}
