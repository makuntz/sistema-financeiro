import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { useSemanticTokens } from './theme';

export type AppTextProps = TextProps & {
  variant?: 'title' | 'subtitle' | 'body' | 'caption' | 'eyebrow';
  tone?: 'primary' | 'secondary' | 'inverse' | 'danger' | 'success';
};

export function Text({ variant = 'body', tone = 'primary', style, ...props }: AppTextProps) {
  const tokens = useSemanticTokens();

  const color =
    tone === 'secondary'
      ? tokens.text.secondary
      : tone === 'inverse'
        ? tokens.text.inverse
        : tone === 'danger'
          ? tokens.status.danger
          : tone === 'success'
            ? tokens.status.success
            : tokens.text.primary;

  return (
    <RNText
      {...props}
      style={[
        variant === 'title' && styles.title,
        variant === 'subtitle' && styles.subtitle,
        variant === 'caption' && styles.caption,
        variant === 'eyebrow' && [styles.eyebrow, { color: tokens.action.primary }],
        { color: variant === 'eyebrow' ? tokens.action.primary : color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
