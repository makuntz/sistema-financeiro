import { describe, expect, it, beforeEach } from 'vitest';
import type { DomainError } from '../shared/domain-error.js';
import { Category } from './category.js';
import { CreateSubcategory } from './create-subcategory.js';
import { UpdateSubcategory } from './update-subcategory.js';
import { InactivateSubcategory } from './inactivate-subcategory.js';
import { ReactivateSubcategory } from './reactivate-subcategory.js';
import { InMemoryCategoryRepository } from './in-memory-category-repository.js';
import { InMemorySubcategoryRepository } from './in-memory-subcategory-repository.js';

const workspaceA = '11111111-1111-1111-1111-111111111111';
const workspaceB = '22222222-2222-2222-2222-222222222222';

describe('CreateSubcategory', () => {
  let categoryRepo: InMemoryCategoryRepository;
  let subcategoryRepo: InMemorySubcategoryRepository;
  let useCase: CreateSubcategory;
  let categoryId: string;

  beforeEach(async () => {
    categoryRepo = new InMemoryCategoryRepository();
    subcategoryRepo = new InMemorySubcategoryRepository();
    useCase = new CreateSubcategory(categoryRepo, subcategoryRepo);

    const category = Category.create({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      workspaceId: workspaceA,
      name: 'Mantimentos',
      type: 'expense',
      color: '#16A34A',
      icon: 'shopping-cart',
    });
    await categoryRepo.save(category);
    categoryId = category.id;
  });

  it('cria subcategoria válida', async () => {
    const sub = await useCase.execute({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      workspaceId: workspaceA,
      categoryId,
      name: 'Mercado semanal',
    });

    expect(sub.name).toBe('Mercado semanal');
    expect(sub.categoryId).toBe(categoryId);
    expect(sub.isActive).toBe(true);
  });

  it('rejeita subcategoria duplicada no mesmo workspace+category', async () => {
    await useCase.execute({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      workspaceId: workspaceA,
      categoryId,
      name: 'Mercado semanal',
    });

    await expect(
      useCase.execute({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        workspaceId: workspaceA,
        categoryId,
        name: 'mercado semanal',
      }),
    ).rejects.toMatchObject({
      code: 'SUBCATEGORY_ALREADY_EXISTS',
    } satisfies Partial<DomainError>);
  });

  it('rejeita quando categoria não existe', async () => {
    await expect(
      useCase.execute({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        workspaceId: workspaceA,
        categoryId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        name: 'Teste',
      }),
    ).rejects.toMatchObject({
      code: 'CATEGORY_NOT_FOUND',
    } satisfies Partial<DomainError>);
  });

  it('rejeita quando categoria está inativa', async () => {
    const category = (await categoryRepo.findById(categoryId))!;
    category.deactivate();
    await categoryRepo.save(category);

    await expect(
      useCase.execute({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        workspaceId: workspaceA,
        categoryId,
        name: 'Teste',
      }),
    ).rejects.toMatchObject({
      code: 'CATEGORY_INACTIVE',
    } satisfies Partial<DomainError>);
  });

  it('rejeita nome muito curto', async () => {
    await expect(
      useCase.execute({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        workspaceId: workspaceA,
        categoryId,
        name: 'A',
      }),
    ).rejects.toMatchObject({
      code: 'SUBCATEGORY_NAME_TOO_SHORT',
    } satisfies Partial<DomainError>);
  });

  it('isolamento entre workspaces', async () => {
    const categoryB = Category.create({
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      workspaceId: workspaceB,
      name: 'Mantimentos',
      type: 'expense',
      color: '#16A34A',
      icon: 'shopping-cart',
    });
    await categoryRepo.save(categoryB);

    await useCase.execute({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      workspaceId: workspaceA,
      categoryId,
      name: 'Mercado semanal',
    });

    const sub = await useCase.execute({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      workspaceId: workspaceB,
      categoryId: categoryB.id,
      name: 'Mercado semanal',
    });

    expect(sub.workspaceId).toBe(workspaceB);
  });
});

describe('UpdateSubcategory', () => {
  let categoryRepo: InMemoryCategoryRepository;
  let subcategoryRepo: InMemorySubcategoryRepository;
  let createUseCase: CreateSubcategory;
  let updateUseCase: UpdateSubcategory;
  let categoryId: string;

  beforeEach(async () => {
    categoryRepo = new InMemoryCategoryRepository();
    subcategoryRepo = new InMemorySubcategoryRepository();
    createUseCase = new CreateSubcategory(categoryRepo, subcategoryRepo);
    updateUseCase = new UpdateSubcategory(subcategoryRepo);

    const category = Category.create({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      workspaceId: workspaceA,
      name: 'Mantimentos',
      type: 'expense',
      color: '#16A34A',
      icon: 'shopping-cart',
    });
    await categoryRepo.save(category);
    categoryId = category.id;
  });

  it('atualiza nome da subcategoria', async () => {
    const sub = await createUseCase.execute({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      workspaceId: workspaceA,
      categoryId,
      name: 'Mercado semanal',
    });

    const updated = await updateUseCase.execute({
      subcategoryId: sub.id,
      workspaceId: workspaceA,
      name: 'Mercado mensal',
    });

    expect(updated.name).toBe('Mercado mensal');
  });

  it('rejeita duplicata ao renomear', async () => {
    await createUseCase.execute({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      workspaceId: workspaceA,
      categoryId,
      name: 'Mercado semanal',
    });

    const sub2 = await createUseCase.execute({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      workspaceId: workspaceA,
      categoryId,
      name: 'Feira',
    });

    await expect(
      updateUseCase.execute({
        subcategoryId: sub2.id,
        workspaceId: workspaceA,
        name: 'Mercado semanal',
      }),
    ).rejects.toMatchObject({
      code: 'SUBCATEGORY_ALREADY_EXISTS',
    } satisfies Partial<DomainError>);
  });

  it('retorna SUBCATEGORY_NOT_FOUND para ID inexistente', async () => {
    await expect(
      updateUseCase.execute({
        subcategoryId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        workspaceId: workspaceA,
        name: 'Teste',
      }),
    ).rejects.toMatchObject({
      code: 'SUBCATEGORY_NOT_FOUND',
    } satisfies Partial<DomainError>);
  });
});

describe('InactivateSubcategory / ReactivateSubcategory', () => {
  let categoryRepo: InMemoryCategoryRepository;
  let subcategoryRepo: InMemorySubcategoryRepository;
  let createUseCase: CreateSubcategory;
  let inactivateUseCase: InactivateSubcategory;
  let reactivateUseCase: ReactivateSubcategory;
  let categoryId: string;

  beforeEach(async () => {
    categoryRepo = new InMemoryCategoryRepository();
    subcategoryRepo = new InMemorySubcategoryRepository();
    createUseCase = new CreateSubcategory(categoryRepo, subcategoryRepo);
    inactivateUseCase = new InactivateSubcategory(subcategoryRepo);
    reactivateUseCase = new ReactivateSubcategory(subcategoryRepo);

    const category = Category.create({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      workspaceId: workspaceA,
      name: 'Mantimentos',
      type: 'expense',
      color: '#16A34A',
      icon: 'shopping-cart',
    });
    await categoryRepo.save(category);
    categoryId = category.id;
  });

  it('inativa e reativa subcategoria', async () => {
    const sub = await createUseCase.execute({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      workspaceId: workspaceA,
      categoryId,
      name: 'Mercado semanal',
    });

    const inactivated = await inactivateUseCase.execute({
      subcategoryId: sub.id,
      workspaceId: workspaceA,
    });
    expect(inactivated.isActive).toBe(false);

    const reactivated = await reactivateUseCase.execute({
      subcategoryId: sub.id,
      workspaceId: workspaceA,
    });
    expect(reactivated.isActive).toBe(true);
  });
});
