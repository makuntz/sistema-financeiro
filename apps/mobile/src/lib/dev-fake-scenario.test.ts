import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEV_FAKE_SCENARIO_OPTIONS,
  getDevFakeScenario,
  getDevFakeScenarioSelection,
  setDevFakeScenario,
} from './dev-fake-scenario';

describe('dev-fake-scenario', () => {
  beforeEach(() => {
    setDevFakeScenario(null);
  });

  it('exposes all fake scenarios for the dev picker', () => {
    expect(DEV_FAKE_SCENARIO_OPTIONS.map((option) => option.value)).toEqual([
      null,
      'success',
      'missing-item-value',
      'total-mismatch',
      'processing-failure',
      'long-receipt',
    ]);
  });

  it('stores and returns the selected scenario', () => {
    expect(getDevFakeScenario()).toBeUndefined();
    expect(getDevFakeScenarioSelection()).toBeNull();

    setDevFakeScenario('long-receipt');
    expect(getDevFakeScenario()).toBe('long-receipt');
    expect(getDevFakeScenarioSelection()).toBe('long-receipt');
  });
});
