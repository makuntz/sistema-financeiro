import { Text, StyleSheet } from 'react-native';
import { semanticTokens } from '@pp-planning/design-tokens';

export type MoneyDisplayProps = {
  cents: number | bigint;
  tone?: 'default' | 'income' | 'expense';
};

function formatBrl(cents: number | bigint): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(cents) / 100);
}

export function MoneyDisplay({ cents, tone = 'default' }: MoneyDisplayProps) {
  const color =
    tone === 'income'
      ? semanticTokens.financial.income
      : tone === 'expense'
        ? semanticTokens.financial.expense
        : semanticTokens.financial.balance;

  return <Text style={[styles.text, { color }]}>{formatBrl(cents)}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
