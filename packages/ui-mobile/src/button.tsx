import { Pressable, Text, StyleSheet, type PressableProps } from 'react-native';
import { semanticTokens } from '@pp-planning/design-tokens';

export type ButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary';
};

export function Button({ label, variant = 'primary', style, ...props }: ButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={(state) => [
        styles.base,
        {
          backgroundColor: isPrimary ? semanticTokens.action.primary : 'transparent',
          borderColor: isPrimary ? semanticTokens.action.primary : semanticTokens.border.default,
          opacity: state.pressed || props.disabled ? 0.7 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: isPrimary ? semanticTokens.text.inverse : semanticTokens.text.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  label: {
    fontWeight: '600',
    fontSize: 16,
  },
});
