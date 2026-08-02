import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { loadEnv } from '@pp-planning/config/env';
import { createPrismaClient } from '@pp-planning/database';
import { ReceiptProcessingWorker } from '../modules/receipts/infrastructure/receipt-processing-worker.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
loadDotenv();

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const prisma = createPrismaClient(env.DATABASE_URL);
  const worker = new ReceiptProcessingWorker(prisma, env);

  const shutdown = (): void => {
    worker.stop();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.info('[receipt-worker] Starting polling loop');
  await worker.startPolling();
}

void main().catch((error) => {
  console.error('[receipt-worker] Fatal error', error);
  process.exit(1);
});
