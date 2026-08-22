import { forwardRef } from 'react';
import { TextInput, Text, View, StyleSheet, type TextInputProps } from 'react-native';
import { useSemanticTokens } from './theme';

export type InputProps = TextInputProps & {
  label: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, style, editable = true, ...props },
  ref,
) {
  const tokens = useSemanticTokens();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: tokens.text.secondary }]}>{label}</Text>
      <TextInput
        ref={ref}
        {...props}
        editable={editable}
        autoComplete="off"
        autoCorrect={false}
        importantForAutofill="no"
        showSoftInputOnFocus={props.showSoftInputOnFocus ?? true}
        placeholderTextColor={tokens.text.secondary}
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
});

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
  },
});
