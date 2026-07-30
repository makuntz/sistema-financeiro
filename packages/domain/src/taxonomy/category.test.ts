import { describe, expect, it } from 'vitest';
import { Category, validateCategoryColor, validateCategoryIcon } from './category.js';

describe('Category entity', () => {
  const validInput = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    workspaceId: '11111111-1111-1111-1111-111111111111',
    name: 'Alimentação',
    type: 'expense' as const,
    color: '#16A34A',
    icon: 'shopping-cart' as const,
  };

  describe('create', () => {
    it('valida cor inválida', () => {
      expect(() => Category.create({ ...validInput, color: 'red' })).toThrow();
    });

    it('valida ícone inválido', () => {
      expect(() => Category.create({ ...validInput, icon: 'invalid-icon' })).toThrow();
    });

    it('cria com cor e ícone válidos', () => {
      const category = Category.create(validInput);
      expect(category.color).toBe('#16A34A');
      expect(category.icon).toBe('shopping-cart');
    });
  });

  describe('update', () => {
    it('atualiza nome', () => {
      const category = Category.create(validInput);
      category.update({ name: 'Transporte' });
      expect(category.name).toBe('Transporte');
      expect(category.normalizedName).toBe('transporte');
    });

    it('atualiza cor', () => {
      const category = Category.create(validInput);
      category.update({ color: '#FF0000' });
      expect(category.color).toBe('#FF0000');
    });

    it('rejeita cor inválida no update', () => {
      const category = Category.create(validInput);
      expect(() => category.update({ color: 'invalid' })).toThrow();
    });

    it('atualiza ícone', () => {
      const category = Category.create(validInput);
      category.update({ icon: 'wallet' });
      expect(category.icon).toBe('wallet');
    });

    it('rejeita ícone inválido no update', () => {
      const category = Category.create(validInput);
      expect(() => category.update({ icon: 'invalid' })).toThrow();
    });

    it('atualiza order', () => {
      const category = Category.create(validInput);
      category.update({ order: 5 });
      expect(category.order).toBe(5);
    });

    it('atualiza updatedAt', () => {
      const now = new Date('2025-06-01');
      const category = Category.create({ ...validInput, now: new Date('2025-01-01') });
      category.update({ name: 'Novo' }, now);
      expect(category.updatedAt).toEqual(now);
    });
  });

  describe('activate', () => {
    it('reativa categoria inativa', () => {
      const category = Category.create(validInput);
      category.deactivate();
      expect(category.isActive).toBe(false);
      category.activate();
      expect(category.isActive).toBe(true);
    });
  });
});

describe('validateCategoryColor', () => {
  it('aceita #RRGGBB válido', () => {
    expect(() => validateCategoryColor('#FF00AA')).not.toThrow();
  });

  it('rejeita formatos inválidos', () => {
    expect(() => validateCategoryColor('red')).toThrow();
    expect(() => validateCategoryColor('#FFF')).toThrow();
    expect(() => validateCategoryColor('#GGGGGG')).toThrow();
  });
});

describe('validateCategoryIcon', () => {
  it('aceita ícones válidos', () => {
    expect(() => validateCategoryIcon('tag')).not.toThrow();
    expect(() => validateCategoryIcon('wallet')).not.toThrow();
  });

  it('rejeita ícones fora da allowlist', () => {
    expect(() => validateCategoryIcon('rocket')).toThrow();
  });
});
