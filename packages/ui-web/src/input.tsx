import type { InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, id, style, ...props }: InputProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <label
      htmlFor={inputId}
      style={{
        display: 'grid',
        gap: '0.35rem',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-primary)',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</span>
      <input
        id={inputId}
        {...props}
        style={{
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '0.625rem 0.75rem',
          background: 'var(--color-white)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          ...style,
        }}
      />
    </label>
  );
}
