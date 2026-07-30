import type { CSSProperties, ReactNode } from 'react';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  style?: CSSProperties;
};

export function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        textAlign: 'center',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      {icon && (
        <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '2.5rem' }}>
          {icon}
        </div>
      )}
      <h3
        style={{
          margin: '0 0 0.5rem',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h3>
      {description && (
        <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', maxWidth: '24rem' }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </div>
  );
}
