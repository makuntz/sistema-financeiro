'use client';

import { useId, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { formatCentsToBRL, parseBRLInputToCents } from '@pp-planning/contracts';

export type MoneyInputProps = {
  label: string;
  valueInCents: string;
  onChange: (cents: string) => void;
  disabled?: boolean;
  error?: string;
  id?: string;
  name?: string;
};

/**
 * Brazilian currency input. Stores cents as a digit string.
 * Formats on blur; keeps typing free while focused.
 */
export function MoneyInput({
  label,
  valueInCents,
  onChange,
  disabled = false,
  error,
  id,
  name,
}: MoneyInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();

  const display = focused
    ? draft
    : valueInCents === '' || valueInCents === '0'
      ? ''
      : formatCentsToBRL(valueInCents).replace(/^R\$\s*/, '');

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    setFocused(true);
    setLocalError(undefined);
    const raw =
      valueInCents === '' || valueInCents === '0'
        ? ''
        : formatCentsToBRL(valueInCents).replace(/^R\$\s*/, '');
    setDraft(raw);
    requestAnimationFrame(() => {
      e.target.select();
    });
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value);
    setLocalError(undefined);
  }

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange('0');
      setDraft('');
      setLocalError(undefined);
      return;
    }

    try {
      const cents = parseBRLInputToCents(trimmed);
      onChange(cents);
      setDraft(formatCentsToBRL(cents).replace(/^R\$\s*/, ''));
      setLocalError(undefined);
    } catch {
      setLocalError('Valor inválido');
    }
  }

  function handleBlur() {
    setFocused(false);
    commit(draft);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  }

  const shownError = error ?? localError;

  return (
    <label
      htmlFor={inputId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        fontFamily: 'var(--font-sans)',
        minWidth: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          border: `1px solid ${shownError ? 'var(--status-danger)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          padding: '0.45rem 0.65rem',
          color: 'var(--text-primary)',
        }}
      >
        <span aria-hidden="true" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
          R$
        </span>
        <input
          id={inputId}
          name={name}
          aria-label={label}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={display}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? errorId : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            fontVariantNumeric: 'tabular-nums',
            fontSize: '0.95rem',
          }}
        />
      </span>
      {shownError ? (
        <span
          id={errorId}
          role="alert"
          style={{ color: 'var(--status-danger)', fontSize: '0.8rem' }}
        >
          {shownError}
        </span>
      ) : null}
    </label>
  );
}
