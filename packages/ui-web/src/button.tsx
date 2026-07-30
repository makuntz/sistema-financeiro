import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({ children, variant = 'primary', style, ...props }: ButtonProps) {
  const stylesByVariant: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
    primary: {
      background: 'var(--action-primary)',
      color: 'var(--text-inverse)',
      border: '1px solid var(--action-primary)',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--action-primary)',
      border: '1px solid var(--action-primary)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-default)',
    },
    danger: {
      background: 'transparent',
      color: 'var(--status-danger)',
      border: '1px solid var(--status-danger)',
    },
  };

  return (
    <button
      type="button"
      {...props}
      style={{
        ...stylesByVariant[variant],
        borderRadius: 'var(--radius-md)',
        padding: '0.65rem 1rem',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
