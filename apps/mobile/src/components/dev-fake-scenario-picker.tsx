import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Text } from '@pp-planning/ui-mobile';
import {
  DEV_FAKE_SCENARIO_OPTIONS,
  findDevFakeScenarioOption,
  getDevFakeScenarioSelection,
  isDevFakeScenarioPickerEnabled,
  setDevFakeScenario,
  type DevFakeScenarioOption,
} from '@/src/lib/dev-fake-scenario';
import { useState } from 'react';

export function DevFakeScenarioPicker() {
  const [selected, setSelected] = useState<DevFakeScenarioOption>(() =>
    findDevFakeScenarioOption(getDevFakeScenarioSelection()),
  );

  if (!isDevFakeScenarioPickerEnabled()) {
    return null;
  }

  function selectOption(option: DevFakeScenarioOption) {
    setSelected(option);
    setDevFakeScenario(option.value);
  }

  return (
    <Card style={styles.card}>
      <Text variant="eyebrow">Dev — extrator fake</Text>
      <Text tone="secondary">
        Escolha o cenário simulado antes de enviar a foto. Não aparece em builds de produção.
      </Text>
      <View style={styles.chips}>
        {DEV_FAKE_SCENARIO_OPTIONS.map((option) => {
          const isActive = selected.value === option.value;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => selectOption(option)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              <Text variant="caption" style={isActive ? styles.chipLabelActive : undefined}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text tone="secondary">{selected.description}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  chipLabelActive: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
});
