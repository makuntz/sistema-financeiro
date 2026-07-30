'use client';

import { type InputHTMLAttributes, useState } from 'react';

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};

export function PasswordInput({ label, id, style, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
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
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          {...props}
          style={{
            width: '100%',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '0.625rem 2.5rem 0.625rem 0.75rem',
            background: 'var(--surface-default)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            boxSizing: 'border-box',
            ...style,
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: '0.25rem',
            fontSize: '0.8rem',
          }}
        >
          {visible ? '🙈' : '👁'}
        </button>
      </div>
    </label>
  );
}
