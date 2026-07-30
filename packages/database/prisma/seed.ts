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

  const seedCategories = [
    {
      name: 'Mantimentos',
      type: 'expense' as const,
      color: '#16A34A',
      icon: 'shopping-cart',
      subcategories: ['Mercado semanal', 'Feira', 'Padaria', 'Açougue'],
    },
    {
      name: 'Saúde',
      type: 'expense' as const,
      color: '#DC2626',
      icon: 'heart',
      subcategories: ['Plano de saúde', 'Farmácia', 'Consultas', 'Exames'],
    },
    {
      name: 'Transporte',
      type: 'expense' as const,
      color: '#2563EB',
      icon: 'car',
      subcategories: ['Combustível', 'Estacionamento', 'Transporte público', 'Manutenção veículo'],
    },
    {
      name: 'Moradia',
      type: 'expense' as const,
      color: '#9333EA',
      icon: 'home',
      subcategories: ['Aluguel', 'Condomínio', 'Energia', 'Água', 'Internet'],
    },
    {
      name: 'Salários',
      type: 'income' as const,
      color: '#059669',
      icon: 'wallet',
      subcategories: ['Salário principal', 'Segunda renda'],
    },
    {
      name: 'Benefícios',
      type: 'income' as const,
      color: '#0891B2',
      icon: 'briefcase',
      subcategories: ['Vale-alimentação', 'Reembolsos'],
    },
    {
      name: 'Outras receitas',
      type: 'income' as const,
      color: '#7C3AED',
      icon: 'tag',
      subcategories: ['Rendimentos', 'Receitas extras'],
    },
  ];

  for (const cat of seedCategories) {
    const normalizedName = cat.name.trim().toLocaleLowerCase('pt-BR');
    let category = await prisma.category.findUnique({
      where: {
        workspaceId_type_normalizedName: {
          workspaceId: workspace.id,
          type: cat.type,
          normalizedName,
        },
      },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          id: randomUUID(),
          workspaceId: workspace.id,
          name: cat.name,
          normalizedName,
          type: cat.type,
          color: cat.color,
          icon: cat.icon,
          order: 0,
          isActive: true,
        },
      });
    }

    for (const subName of cat.subcategories) {
      const subNormalized = subName.trim().toLocaleLowerCase('pt-BR');
      const existing = await prisma.subcategory.findUnique({
        where: {
          workspaceId_categoryId_normalizedName: {
            workspaceId: workspace.id,
            categoryId: category.id,
            normalizedName: subNormalized,
          },
        },
      });

      if (!existing) {
        await prisma.subcategory.create({
          data: {
            id: randomUUID(),
            workspaceId: workspace.id,
            categoryId: category.id,
            name: subName,
            normalizedName: subNormalized,
            order: 0,
            isActive: true,
          },
        });
      }
    }
  }

  // --- Demo monthly plans ---
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const allSubs = await prisma.subcategory.findMany({
    where: { workspaceId: workspace.id },
    include: { category: true },
  });

  const planAmounts: Record<string, bigint> = {};
  for (const sub of allSubs) {
    if (sub.category.type === 'income') {
      planAmounts[sub.id] = sub.name.includes('principal') ? 800000n : 150000n;
    } else {
      planAmounts[sub.id] = 50000n + BigInt(Math.floor(Math.random() * 100)) * 100n;
    }
  }

  for (const period of [
    { year: prevYear, month: prevMonth },
    { year: currentYear, month: currentMonth },
  ]) {
    const existingPlan = await prisma.monthlyPlan.findUnique({
      where: {
        workspaceId_year_month: {
          workspaceId: workspace.id,
          year: period.year,
          month: period.month,
        },
      },
    });

    if (existingPlan) {
      console.log(`Plano ${period.year}/${period.month} já existe, pulando.`);
      continue;
    }

    const planId = randomUUID();
    await prisma.monthlyPlan.create({
      data: {
        id: planId,
        workspaceId: workspace.id,
        year: period.year,
        month: period.month,
        version: 1,
        createdByUserId: owner.id,
        updatedByUserId: owner.id,
      },
    });

    const itemsData = allSubs.map((sub) => ({
      id: randomUUID(),
      workspaceId: workspace.id,
      monthlyPlanId: planId,
      subcategoryId: sub.id,
      plannedAmountInCents: planAmounts[sub.id] ?? 10000n,
    }));

    await prisma.monthlyPlanItem.createMany({ data: itemsData });

    console.log(`Plano demo criado: ${period.year}/${period.month} (${itemsData.length} itens)`);
  }

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
