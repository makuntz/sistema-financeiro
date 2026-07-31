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
    {
      name: 'Presentes',
      type: 'expense' as const,
      color: '#DB2777',
      icon: 'gift',
      subcategories: ['Presentes diversos'],
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
    if (sub.category.name === 'Presentes') {
      planAmounts[sub.id] = 0n;
    } else if (sub.category.type === 'income') {
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

  // --- Demo ledger entries (idempotent by description + competence + workspace) ---
  const ownerMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: owner.id } },
  });
  const viewerMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: viewer.id } },
  });

  const findSub = (categoryName: string, subName: string) =>
    allSubs.find((s) => s.category.name === categoryName && s.name === subName);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const dateIn = (y: number, m: number, day: number) =>
    new Date(`${y}-${pad2(m)}-${pad2(day)}T00:00:00.000Z`);

  type SeedEntry = {
    key: string;
    description: string;
    categoryName: string;
    subcategoryName: string;
    amountInCents: bigint;
    year: number;
    month: number;
    day: number;
    attributedMemberId: string | null;
    notes?: string;
  };

  const mercado = findSub('Mantimentos', 'Mercado semanal');
  const feira = findSub('Mantimentos', 'Feira');
  const farmacia = findSub('Saúde', 'Farmácia');
  const combustivel = findSub('Transporte', 'Combustível');
  const energia = findSub('Moradia', 'Energia');
  const internet = findSub('Moradia', 'Internet');
  const salario = findSub('Salários', 'Salário principal');
  const segundaRenda = findSub('Salários', 'Segunda renda');
  const presentes = findSub('Presentes', 'Presentes diversos');

  const seedEntries: SeedEntry[] = [];

  for (const period of [
    { year: prevYear, month: prevMonth },
    { year: currentYear, month: currentMonth },
  ]) {
    if (salario) {
      seedEntries.push({
        key: `seed-salario-${period.year}-${period.month}`,
        description: 'Salário principal',
        categoryName: 'Salários',
        subcategoryName: 'Salário principal',
        // Below planned (800000) for comparison demo
        amountInCents: 750000n,
        year: period.year,
        month: period.month,
        day: 5,
        attributedMemberId: ownerMember?.id ?? null,
      });
    }
    if (segundaRenda) {
      seedEntries.push({
        key: `seed-segunda-${period.year}-${period.month}`,
        description: 'Segunda renda',
        categoryName: 'Salários',
        subcategoryName: 'Segunda renda',
        amountInCents: 150000n,
        year: period.year,
        month: period.month,
        day: 10,
        attributedMemberId: viewerMember?.id ?? null,
      });
    }
    if (mercado) {
      seedEntries.push({
        key: `seed-mercado-a-${period.year}-${period.month}`,
        description: 'Supermercado',
        categoryName: 'Mantimentos',
        subcategoryName: 'Mercado semanal',
        amountInCents: 43000n,
        year: period.year,
        month: period.month,
        day: 5,
        attributedMemberId: ownerMember?.id ?? null,
      });
      seedEntries.push({
        key: `seed-mercado-b-${period.year}-${period.month}`,
        description: 'Supermercado Vila Rica',
        categoryName: 'Mantimentos',
        subcategoryName: 'Mercado semanal',
        // Helps push category over planned in combination with other expenses
        amountInCents: 52000n,
        year: period.year,
        month: period.month,
        day: 20,
        attributedMemberId: viewerMember?.id ?? null,
      });
    }
    if (feira) {
      seedEntries.push({
        key: `seed-feira-${period.year}-${period.month}`,
        description: 'Feira',
        categoryName: 'Mantimentos',
        subcategoryName: 'Feira',
        amountInCents: 18000n,
        year: period.year,
        month: period.month,
        day: 12,
        attributedMemberId: ownerMember?.id ?? null,
      });
    }
    if (farmacia) {
      seedEntries.push({
        key: `seed-farmacia-${period.year}-${period.month}`,
        description: 'Farmácia',
        categoryName: 'Saúde',
        subcategoryName: 'Farmácia',
        amountInCents: 8900n,
        year: period.year,
        month: period.month,
        day: 8,
        attributedMemberId: ownerMember?.id ?? null,
      });
    }
    if (combustivel) {
      seedEntries.push({
        key: `seed-combustivel-${period.year}-${period.month}`,
        description: 'Combustível',
        categoryName: 'Transporte',
        subcategoryName: 'Combustível',
        amountInCents: 25000n,
        year: period.year,
        month: period.month,
        day: 15,
        attributedMemberId: viewerMember?.id ?? null,
      });
    }
    if (energia) {
      seedEntries.push({
        key: `seed-energia-${period.year}-${period.month}`,
        description: 'Conta de energia',
        categoryName: 'Moradia',
        subcategoryName: 'Energia',
        amountInCents: 18500n,
        year: period.year,
        month: period.month,
        day: 10,
        attributedMemberId: ownerMember?.id ?? null,
        notes: 'Competência alinhada ao mês da fatura',
      });
    }
    if (internet) {
      seedEntries.push({
        key: `seed-internet-${period.year}-${period.month}`,
        description: 'Internet',
        categoryName: 'Moradia',
        subcategoryName: 'Internet',
        amountInCents: 12990n,
        year: period.year,
        month: period.month,
        day: 7,
        attributedMemberId: ownerMember?.id ?? null,
      });
    }
    if (presentes) {
      seedEntries.push({
        key: `seed-presentes-${period.year}-${period.month}`,
        description: 'Presente aniversário',
        categoryName: 'Presentes',
        subcategoryName: 'Presentes diversos',
        // Planned 0 → disponível negativo
        amountInCents: 15000n,
        year: period.year,
        month: period.month,
        day: 18,
        attributedMemberId: ownerMember?.id ?? null,
      });
    }
  }

  // Extra over-budget line on current month mantimentos
  if (mercado) {
    seedEntries.push({
      key: `seed-mercado-over-${currentYear}-${currentMonth}`,
      description: 'Compra extra mercado',
      categoryName: 'Mantimentos',
      subcategoryName: 'Mercado semanal',
      amountInCents: 200000n,
      year: currentYear,
      month: currentMonth,
      day: 22,
      attributedMemberId: ownerMember?.id ?? null,
      notes: 'Exemplo de gasto acima do planejado',
    });
  }

  let createdLedger = 0;
  for (const entry of seedEntries) {
    const sub = findSub(entry.categoryName, entry.subcategoryName);
    if (!sub) continue;

    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        workspaceId: workspace.id,
        description: entry.description,
        competenceYear: entry.year,
        competenceMonth: entry.month,
        amountInCents: entry.amountInCents,
      },
    });
    if (existing) continue;

    await prisma.ledgerEntry.create({
      data: {
        id: randomUUID(),
        workspaceId: workspace.id,
        subcategoryId: sub.id,
        categoryId: sub.categoryId,
        kind: sub.category.type,
        description: entry.description,
        notes: entry.notes ?? null,
        amountInCents: entry.amountInCents,
        occurredOn: dateIn(entry.year, entry.month, entry.day),
        competenceYear: entry.year,
        competenceMonth: entry.month,
        attributedMemberId: entry.attributedMemberId,
        createdByUserId: owner.id,
        updatedByUserId: owner.id,
        version: 1,
      },
    });
    createdLedger += 1;
  }

  console.log(
    createdLedger > 0
      ? `Lançamentos demo criados: ${createdLedger}`
      : 'Lançamentos demo já existiam, pulando.',
  );

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
