'use client';

import { type ReactNode, useEffect, useRef } from 'react';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClose = () => onClose();
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        maxWidth: '28rem',
        width: '90vw',
        fontFamily: 'var(--font-sans)',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
      }}
    >
      {title && (
        <h2
          style={{
            margin: '0 0 1rem',
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </dialog>
  );
}
