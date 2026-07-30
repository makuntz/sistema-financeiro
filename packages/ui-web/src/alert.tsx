import type { CSSProperties, ReactNode } from 'react';

export type AlertProps = {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  style?: CSSProperties;
};

const variantStyles: Record<NonNullable<AlertProps['variant']>, CSSProperties> = {
  info: {
    borderColor: 'var(--action-primary)',
    background: 'var(--action-primary-soft)',
    color: 'var(--text-primary)',
  },
  success: {
    borderColor: 'var(--status-success)',
    background: 'color-mix(in srgb, var(--status-success) 12%, transparent)',
    color: 'var(--text-primary)',
  },
  warning: {
    borderColor: 'var(--status-warning)',
    background: 'color-mix(in srgb, var(--status-warning) 14%, transparent)',
    color: 'var(--text-primary)',
  },
  danger: {
    borderColor: 'var(--status-danger)',
    background: 'color-mix(in srgb, var(--status-danger) 12%, transparent)',
    color: 'var(--text-primary)',
  },
};

export function Alert({ children, variant = 'info', style }: AlertProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        borderLeft: '4px solid',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.875rem',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
