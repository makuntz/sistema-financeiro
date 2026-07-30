import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'expired-token' }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import InvitePage from '../app/(public)/convites/[token]/page';

describe('InvitePage - expired state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows expired message when invite is expired', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workspaceName: 'Meu Planejamento',
        inviterName: 'João',
        email: 'test@test.com',
        role: 'MEMBER',
        expired: true,
      }),
    });

    render(<InvitePage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Este convite expirou/),
      ).toBeInTheDocument();
    });
  });

  it('shows error when invite not found', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: 'Convite não encontrado' }),
    });

    render(<InvitePage />);

    await waitFor(() => {
      expect(screen.getByText('Convite não encontrado')).toBeInTheDocument();
    });
  });
});
