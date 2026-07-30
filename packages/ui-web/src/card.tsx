import type { CSSProperties, ReactNode } from 'react';

export type CardProps = {
  children: ReactNode;
  title?: string;
  style?: CSSProperties;
};

export function Card({ children, title, style }: CardProps) {
  return (
    <section
      style={{
        background: 'var(--surface-default)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
    >
      {title ? (
        <h2
          style={{
            margin: '0 0 0.75rem',
            fontFamily: 'var(--font-display)',
            fontSize: '1.1rem',
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
