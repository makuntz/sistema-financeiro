import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { loadEnv } from '@pp-planning/config/env';
import { buildApp } from './app.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
loadDotenv();

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const { app } = await buildApp({ env });

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
