import { Pressable, Text, StyleSheet, type PressableProps } from 'react-native';
import { useSemanticTokens } from './theme';

export type ButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ label, variant = 'primary', style, ...props }: ButtonProps) {
  const tokens = useSemanticTokens();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  const backgroundColor = isPrimary
    ? tokens.action.primary
    : isDanger
      ? tokens.status.danger
      : 'transparent';
  const borderColor = isPrimary
    ? tokens.action.primary
    : isDanger
      ? tokens.status.danger
      : tokens.border.default;
  const labelColor = isPrimary || isDanger ? tokens.text.inverse : tokens.text.primary;

  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={(state) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          opacity: state.pressed || props.disabled ? 0.7 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
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
