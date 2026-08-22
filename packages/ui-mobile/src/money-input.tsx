import { TextInput, Text, View, StyleSheet, type TextInputProps } from 'react-native';
import { formatCentsToBRL } from '@pp-planning/contracts';
import { useSemanticTokens } from './theme';

export type MoneyInputProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  cents: string;
  onChangeCents: (cents: string) => void;
};

function formatInputValue(cents: string): string {
  try {
    return formatCentsToBRL(cents || '0');
  } catch {
    return 'R$ 0,00';
  }
}

function parseDigitsToCents(text: string): string {
  const digits = text.replace(/\D/g, '');
  if (!digits) {
    return '0';
  }
  return digits.replace(/^0+/, '') || '0';
}

export function MoneyInput({ label, cents, onChangeCents, style, ...props }: MoneyInputProps) {
  const tokens = useSemanticTokens();
  const displayValue = formatInputValue(cents);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: tokens.text.secondary }]}>{label}</Text>
      <TextInput
        {...props}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="R$ 0,00"
        placeholderTextColor={tokens.text.secondary}
        value={displayValue}
        onChangeText={(text) => {
          onChangeCents(parseDigitsToCents(text));
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
