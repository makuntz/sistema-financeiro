export function createTestWorkspaceId(suffix = 'a'): string {
  const padded = suffix.padEnd(12, '0').slice(0, 12);
  return `11111111-1111-1111-1111-${padded}`;
}

export function createTestUuid(seed: string): string {
  const normalized = seed.replace(/[^a-f0-9]/gi, '0').toLowerCase().padEnd(32, '0').slice(0, 32);
  return [
    normalized.slice(0, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 16),
    normalized.slice(16, 20),
    normalized.slice(20, 32),
  ].join('-');
}

export async function waitFor(
  assertion: () => boolean | Promise<boolean>,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 2000;
  const intervalMs = options.intervalMs ?? 50;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await assertion()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('waitFor timed out');
}
