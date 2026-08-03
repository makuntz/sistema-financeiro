import { useMemo } from 'react';
import { TextInput, Text, View, StyleSheet, type TextInputProps } from 'react-native';
import { formatCentsToBRL, parseBRLInputToCents } from '@pp-planning/contracts';
import { useSemanticTokens } from './theme';

export type MoneyInputProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  cents: string;
  onChangeCents: (cents: string) => void;
};

function formatDisplayValue(cents: string): string {
  if (!cents || cents === '0') {
    return '';
  }

  try {
    return formatCentsToBRL(cents);
  } catch {
    return '';
  }
}

export function MoneyInput({ label, cents, onChangeCents, style, ...props }: MoneyInputProps) {
  const tokens = useSemanticTokens();
  const displayValue = useMemo(() => formatDisplayValue(cents), [cents]);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: tokens.text.secondary }]}>{label}</Text>
      <TextInput
        {...props}
        keyboardType="numeric"
        placeholder="R$ 0,00"
        placeholderTextColor={tokens.text.secondary}
        value={displayValue}
        onChangeText={(text) => {
          try {
            onChangeCents(parseBRLInputToCents(text));
          } catch {
            if (!text.trim()) {
              onChangeCents('0');
            }
          }
        }}
        style={[
          styles.input,
          {
            color: tokens.text.primary,
            borderColor: tokens.border.default,
            backgroundColor: tokens.surface.default,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
  },
});
