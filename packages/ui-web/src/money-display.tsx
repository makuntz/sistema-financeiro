export type MoneyDisplayProps = {
  cents: number | bigint;
  tone?: 'default' | 'income' | 'expense';
};

function formatBrl(cents: number | bigint): string {
  const value = Number(cents) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function MoneyDisplay({ cents, tone = 'default' }: MoneyDisplayProps) {
  const color =
    tone === 'income'
      ? 'var(--financial-income)'
      : tone === 'expense'
        ? 'var(--financial-expense)'
        : 'var(--financial-balance)';

  return (
    <span
      style={{
        color,
        fontFamily: 'var(--font-sans)',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 600,
      }}
    >
      {formatBrl(cents)}
    </span>
  );
}
