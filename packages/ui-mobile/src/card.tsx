import type { ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewProps } from 'react-native';
import { semanticTokens } from '@pp-planning/design-tokens';

export type CardProps = ViewProps & {
  title?: string;
  children: ReactNode;
};

export function Card({ title, children, style, ...props }: CardProps) {
  return (
    <View {...props} style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: semanticTokens.border.default,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: semanticTokens.text.primary,
    marginBottom: 8,
  },
});
