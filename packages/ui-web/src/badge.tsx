import type { CSSProperties, ReactNode } from 'react';

export type BadgeProps = {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  style?: CSSProperties;
};

const variantStyles: Record<NonNullable<BadgeProps['variant']>, CSSProperties> = {
  default: { background: 'var(--color-slate-100)', color: 'var(--text-primary)' },
  success: { background: '#ecfdf5', color: 'var(--status-success)' },
  warning: { background: '#fffbeb', color: '#92400e' },
  danger: { background: '#fff1f2', color: 'var(--status-danger)' },
};

export function Badge({ children, variant = 'default', style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        lineHeight: '1.5',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
