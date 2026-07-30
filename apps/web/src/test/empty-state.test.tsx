import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@pp-planning/ui-web';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="Nenhuma categoria"
        description="Crie categorias para organizar."
      />,
    );
    expect(screen.getByText('Nenhuma categoria')).toBeInTheDocument();
    expect(screen.getByText('Crie categorias para organizar.')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(
      <EmptyState
        title="Vazio"
        action={<button>Criar</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
  });

  it('renders without icon gracefully', () => {
    const { container } = render(<EmptyState title="Sem ícone" />);
    expect(container.querySelector('h3')).toHaveTextContent('Sem ícone');
  });
});
