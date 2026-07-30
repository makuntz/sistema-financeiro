import type { CSSProperties } from 'react';

export type SkeletonProps = {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: CSSProperties;
};

export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-md)',
  style,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--color-slate-100) 25%, var(--color-slate-200) 50%, var(--color-slate-100) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}
