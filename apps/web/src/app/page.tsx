import { Card } from '@pp-planning/ui-web';
import { apiClient, getPublicApiUrl } from '../lib/api';

export const dynamic = 'force-dynamic';

async function loadHealth() {
  try {
    const health = await apiClient.health();
    return { ok: true as const, health };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : 'Falha ao consultar a API',
    };
  }
}

export default async function HomePage() {
  const result = await loadHealth();
  const environment = process.env.NODE_ENV ?? 'development';
  const docsUrl = `${getPublicApiUrl()}/docs`;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-action-primary">
          Diagnóstico
        </p>
        <h1 className="font-display text-5xl font-bold text-foreground">PP Planning</h1>
        <p className="max-w-xl text-lg text-foreground-secondary">
          Fundação do sistema de planejamento financeiro. Esta tela valida a conexão com a API e a
          configuração do ambiente.
        </p>
      </header>

      <Card title="Status do sistema">
        <dl className="grid gap-4 text-sm">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border-default)] pb-3">
            <dt className="text-foreground-secondary">Sistema</dt>
            <dd className="font-semibold">PP Planning</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border-default)] pb-3">
            <dt className="text-foreground-secondary">Ambiente</dt>
            <dd className="font-semibold">{environment}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border-default)] pb-3">
            <dt className="text-foreground-secondary">API</dt>
            <dd className="font-semibold">
              {result.ok ? (
                <span className="text-financial-income">
                  {result.health.status} · v{result.health.version} · db{' '}
                  {result.health.checks.database}
                </span>
              ) : (
                <span className="text-financial-expense">{result.message}</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-foreground-secondary">Documentação</dt>
            <dd>
              <a
                className="font-semibold text-action-primary underline-offset-4 hover:underline"
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
              >
                OpenAPI / Swagger
              </a>
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
