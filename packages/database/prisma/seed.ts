import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const ownerEmail = 'demo.owner@pp-planning.local';
  const viewerEmail = 'demo.viewer@pp-planning.local';
  const password = 'demo-senha-segura';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const owner =
    (await prisma.user.findUnique({ where: { normalizedEmail: ownerEmail } })) ??
    (await prisma.user.create({
      data: {
        id: randomUUID(),
        name: 'Demo Owner',
        email: ownerEmail,
        normalizedEmail: ownerEmail,
        passwordHash,
        isActive: true,
      },
    }));

  const viewer =
    (await prisma.user.findUnique({ where: { normalizedEmail: viewerEmail } })) ??
    (await prisma.user.create({
      data: {
        id: randomUUID(),
        name: 'Demo Viewer',
        email: viewerEmail,
        normalizedEmail: viewerEmail,
        passwordHash,
        isActive: true,
      },
    }));

  let workspace = await prisma.workspace.findFirst({
    where: { createdByUserId: owner.id, name: 'Planejamento Familiar Demo' },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        id: randomUUID(),
        name: 'Planejamento Familiar Demo',
        createdByUserId: owner.id,
      },
    });
  }

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: owner.id },
    },
    create: {
      id: randomUUID(),
      workspaceId: workspace.id,
      userId: owner.id,
      role: 'owner',
      isActive: true,
    },
    update: { role: 'owner', isActive: true },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: viewer.id },
    },
    create: {
      id: randomUUID(),
      workspaceId: workspace.id,
      userId: viewer.id,
      role: 'viewer',
      isActive: true,
    },
    update: { role: 'viewer', isActive: true },
  });

  console.log('Seed de desenvolvimento aplicado.');
  console.log(`Owner: ${ownerEmail} / ${password}`);
  console.log(`Viewer: ${viewerEmail} / ${password}`);
  console.log(`Workspace compartilhado: ${workspace.name} (${workspace.id})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
