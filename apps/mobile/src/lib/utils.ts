export function resolveApiUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_API_URL não está definida. Configure apps/mobile/.env (veja .env.example).',
    );
  }
  return url.replace(/\/$/, '');
}

/** Auto-login local only. Never enable outside development. */
export function isDevAutoLoginEnabled(): boolean {
  if (!__DEV__) {
    return false;
  }
  const flag = process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN?.trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

export function getDevAutoLoginCredentials(): { email: string; password: string } {
  return {
    email: process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL?.trim() || 'demo.owner@pp-planning.local',
    password: process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD?.trim() || 'demo-senha-segura',
  };
}

export function getPollingDelayMs(attempt: number): number {
  const base = 2000;
  const cap = 13000;
  const delay = base * Math.pow(1.5, attempt);
  return Math.min(Math.round(delay), cap);
}

export function todayDateOnly(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateOnly: string): string {
  const [y, m, d] = dateOnly.split('-');
  return `${d}/${m}/${y}`;
}

export function captureStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'uploaded':
      return 'Enviado';
    case 'processing':
      return 'Processando';
    case 'review':
      return 'Conferência';
    case 'confirmed':
      return 'Confirmado';
    case 'failed':
      return 'Falhou';
    case 'canceled':
      return 'Cancelado';
    default:
      return status;
  }
}
