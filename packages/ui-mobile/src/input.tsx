import { TextInput, Text, View, StyleSheet, type TextInputProps } from 'react-native';
import { semanticTokens } from '@pp-planning/design-tokens';

export type InputProps = TextInputProps & {
  label: string;
};

export function Input({ label, style, ...props }: InputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={semanticTokens.text.secondary}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: semanticTokens.text.secondary,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: semanticTokens.border.default,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: semanticTokens.text.primary,
    backgroundColor: '#FFFFFF',
  },
});
