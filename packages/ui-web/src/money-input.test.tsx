import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MoneyInput } from './money-input.js';

describe('MoneyInput', () => {
  it('formats Brazilian currency on blur and returns cents string', () => {
    let value = '0';
    const { rerender } = render(
      <MoneyInput
        label="Mercado semanal"
        valueInCents={value}
        onChange={(cents) => {
          value = cents;
        }}
      />,
    );

    const input = screen.getByLabelText('Mercado semanal');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1.786,09' } });
    fireEvent.blur(input);

    expect(value).toBe('178609');
    rerender(
      <MoneyInput
        label="Mercado semanal"
        valueInCents={value}
        onChange={(cents) => {
          value = cents;
        }}
      />,
    );
    expect((screen.getByLabelText('Mercado semanal') as HTMLInputElement).value).toBe('1.786,09');
  });

  it('allows clearing the field to zero', () => {
    let value = '1000';
    render(
      <MoneyInput
        label="Utensílios"
        valueInCents={value}
        onChange={(cents) => {
          value = cents;
        }}
      />,
    );

    const input = screen.getByLabelText('Utensílios');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(value).toBe('0');
  });

  it('shows invalid value error', () => {
    render(<MoneyInput label="Café" valueInCents="0" onChange={() => undefined} />);
    const input = screen.getByLabelText('Café');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert').textContent).toBe('Valor inválido');
  });
});
