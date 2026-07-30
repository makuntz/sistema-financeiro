import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Seeds serão adicionados em etapas futuras.
  // Mantemos o script para validar o pipeline de execução.
  console.log('Seed: nenhum dado inicial nesta etapa.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
