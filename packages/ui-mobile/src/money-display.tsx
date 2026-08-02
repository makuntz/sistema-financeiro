import { Text, StyleSheet } from 'react-native';
import { useSemanticTokens } from './theme';

export type MoneyDisplayProps = {
  cents: number | bigint | string;
  tone?: 'default' | 'income' | 'expense';
};

function formatBrl(cents: number | bigint | string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(cents) / 100);
}

export function MoneyDisplay({ cents, tone = 'default' }: MoneyDisplayProps) {
  const tokens = useSemanticTokens();
  const color =
    tone === 'income'
      ? tokens.financial.income
      : tone === 'expense'
        ? tokens.financial.expense
        : tokens.financial.balance;

  return <Text style={[styles.text, { color }]}>{formatBrl(cents)}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
