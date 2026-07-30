import { headers } from 'next/headers';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

/**
 * Validates Origin header against WEB_URL for mutating methods (POST/PATCH/DELETE).
 * Returns true if the request is safe to proceed.
 */
export async function validateOrigin(): Promise<boolean> {
  const hdrs = await headers();
  const origin = hdrs.get('origin');

  if (!origin) return false;

  try {
    const allowedOrigin = new URL(WEB_URL).origin;
    const requestOrigin = new URL(origin).origin;
    return allowedOrigin === requestOrigin;
  } catch {
    return false;
  }
}
