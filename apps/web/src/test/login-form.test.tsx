import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../components/theme-provider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

import LoginPage from '../app/(public)/login/page';

function renderLogin() {
  return render(
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with email and password fields', () => {
    renderLogin();
    expect(screen.getByText('Acesse seu planejamento')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('has link to registration page', () => {
    renderLogin();
    const link = screen.getByText('Criar conta');
    expect(link).toHaveAttribute('href', '/cadastro');
  });

  it('shows error on failed login', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Credenciais inválidas' }),
    });

    renderLogin();

    await userEvent.type(screen.getByLabelText('E-mail'), 'test@example.com');
    await userEvent.type(document.getElementById('password')!, 'wrongpass');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Credenciais inválidas');
    });
  });
});
