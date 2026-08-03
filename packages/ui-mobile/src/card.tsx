import type { ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewProps } from 'react-native';
import { useSemanticTokens } from './theme';

export type CardProps = ViewProps & {
  title?: string;
  children: ReactNode;
};

export function Card({ title, children, style, ...props }: CardProps) {
  const tokens = useSemanticTokens();

  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: tokens.surface.default,
          borderColor: tokens.border.default,
        },
        style,
      ]}
    >
      {title ? <Text style={[styles.title, { color: tokens.text.primary }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
});
