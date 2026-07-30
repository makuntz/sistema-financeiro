import { describe, expect, it, beforeEach } from 'vitest';
import type { DomainError } from '../shared/domain-error.js';
import { CreateCategory } from './create-category.js';
import { InMemoryCategoryRepository } from './in-memory-category-repository.js';
import { CategoryName } from './category.js';

describe('CreateCategory', () => {
  const workspaceA = '11111111-1111-1111-1111-111111111111';
  const workspaceB = '22222222-2222-2222-2222-222222222222';
  let repository: InMemoryCategoryRepository;
  let useCase: CreateCategory;

  beforeEach(() => {
    repository = new InMemoryCategoryRepository();
    useCase = new CreateCategory(repository);
  });

  it('cria uma categoria válida', async () => {
    const category = await useCase.execute({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      workspaceId: workspaceA,
      name: 'Moradia',
      type: 'expense',
      color: '#0F766E',
      icon: 'home',
    });

    expect(category.name).toBe('Moradia');
    expect(category.workspaceId).toBe(workspaceA);
    expect(category.isActive).toBe(true);

    const listed = await repository.findByWorkspace(workspaceA);
    expect(listed).toHaveLength(1);
  });

  it('rejeita nome inválido', async () => {
    await expect(
      useCase.execute({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        workspaceId: workspaceA,
        name: 'A',
        type: 'expense',
      }),
    ).rejects.toMatchObject({
      code: 'CATEGORY_NAME_TOO_SHORT',
    } satisfies Partial<DomainError>);
  });

  it('rejeita categoria duplicada no mesmo workspace', async () => {
    await useCase.execute({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      workspaceId: workspaceA,
      name: 'Alimentação',
      type: 'expense',
    });

    await expect(
      useCase.execute({
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        workspaceId: workspaceA,
        name: 'alimentação',
        type: 'expense',
      }),
    ).rejects.toMatchObject({
      code: 'CATEGORY_ALREADY_EXISTS',
    } satisfies Partial<DomainError>);
  });

  it('permite o mesmo nome em workspaces diferentes', async () => {
    await useCase.execute({
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      workspaceId: workspaceA,
      name: 'Transporte',
      type: 'expense',
    });

    const other = await useCase.execute({
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      workspaceId: workspaceB,
      name: 'Transporte',
      type: 'expense',
    });

    expect(other.workspaceId).toBe(workspaceB);
    expect(await repository.findByWorkspace(workspaceA)).toHaveLength(1);
    expect(await repository.findByWorkspace(workspaceB)).toHaveLength(1);
  });
});

describe('CategoryName', () => {
  it('normaliza espaços nas bordas', () => {
    expect(CategoryName.create('  Saúde  ').value).toBe('Saúde');
  });
});
