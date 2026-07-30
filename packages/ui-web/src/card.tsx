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
        background: 'var(--color-white)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
        ...style,
      }}
    >
      {title ? (
        <h2
          style={{
            margin: '0 0 0.75rem',
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
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
