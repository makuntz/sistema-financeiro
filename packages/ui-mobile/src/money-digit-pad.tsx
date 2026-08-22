import { Pressable, StyleSheet, View } from 'react-native';
import { formatCentsToBRL } from '@pp-planning/contracts';
import { Text } from './text';
import { useSemanticTokens } from './theme';

export type MoneyDigitPadProps = {
  label: string;
  cents: string;
  onChangeCents: (cents: string) => void;
};

const DIGIT_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

function normalizeCents(value: string): string {
  return value.replace(/^0+/, '') || '0';
}

export function MoneyDigitPad({ label, cents, onChangeCents }: MoneyDigitPadProps) {
  const tokens = useSemanticTokens();
  const displayValue = formatCentsToBRL(cents || '0');

  function appendDigit(digit: string) {
    const next = cents === '0' ? digit : `${cents}${digit}`;
    if (next.length > 15) {
      return;
    }
    onChangeCents(normalizeCents(next));
  }

  function handleBackspace() {
    if (cents === '0') {
      return;
    }
    onChangeCents(normalizeCents(cents.slice(0, -1)));
  }

  function handleClear() {
    onChangeCents('0');
  }

  return (
    <View style={styles.wrapper}>
      <Text style={{ color: tokens.text.secondary }}>{label}</Text>
      <View
        style={[
          styles.display,
          { borderColor: tokens.border.default, backgroundColor: tokens.surface.default },
        ]}
      >
        <Text variant="subtitle">{displayValue}</Text>
      </View>
      <View style={styles.grid}>
        {DIGIT_ROWS.map((row) => (
          <View key={row.join('-')} style={styles.row}>
            {row.map((digit) => (
              <Pressable
                key={digit}
                accessibilityRole="button"
                accessibilityLabel={`Digito ${digit}`}
                onPress={() => appendDigit(digit)}
                style={({ pressed }) => [
                  styles.key,
                  {
                    borderColor: tokens.border.default,
                    backgroundColor: pressed ? tokens.surface.default : tokens.background.default,
                  },
                ]}
              >
                <Text variant="subtitle">{digit}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpar"
            onPress={handleClear}
            style={({ pressed }) => [
              styles.key,
              {
                borderColor: tokens.border.default,
                backgroundColor: pressed ? tokens.surface.default : tokens.background.default,
              },
            ]}
          >
            <Text tone="secondary">C</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Digito 0"
            onPress={() => appendDigit('0')}
            style={({ pressed }) => [
              styles.key,
              {
                borderColor: tokens.border.default,
                backgroundColor: pressed ? tokens.surface.default : tokens.background.default,
              },
            ]}
          >
            <Text variant="subtitle">0</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apagar"
            onPress={handleBackspace}
            style={({ pressed }) => [
              styles.key,
              {
                borderColor: tokens.border.default,
                backgroundColor: pressed ? tokens.surface.default : tokens.background.default,
              },
            ]}
          >
            <Text variant="subtitle">⌫</Text>
          </Pressable>
        </View>
      </View>
      <Text tone="secondary" variant="caption">
        Toque nos números para montar o valor (ex.: 2 9 1 3 8 → R$ 291,38).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  display: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
