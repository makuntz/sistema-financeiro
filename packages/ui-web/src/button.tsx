import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
};

export function Button({ children, variant = 'primary', style, ...props }: ButtonProps) {
  const background = variant === 'primary' ? 'var(--action-primary)' : 'transparent';
  const color = variant === 'primary' ? 'var(--text-inverse)' : 'var(--text-primary)';
  const border =
    variant === 'primary' ? '1px solid var(--action-primary)' : '1px solid var(--border-default)';

  return (
    <button
      type="button"
      {...props}
      style={{
        background,
        color,
        border,
        borderRadius: 'var(--radius-md)',
        padding: '0.625rem 1rem',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
