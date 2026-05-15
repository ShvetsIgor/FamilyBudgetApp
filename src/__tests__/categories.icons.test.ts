import { describe, it, expect } from 'vitest';
import { I } from '@/features/categories/icons/icons';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/features/categories/services/defaultCategories';

describe('Icon registry', () => {
  it('I object is not empty', () => {
    expect(Object.keys(I).length).toBeGreaterThan(10);
  });

  it('every default expense category icon exists in registry', () => {
    const missing: string[] = [];
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      if (!I[cat.icon]) missing.push(`${cat.name}: "${cat.icon}"`);
    }
    expect(missing, `Missing icons: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('every default income category icon exists in registry', () => {
    const missing: string[] = [];
    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      if (!I[cat.icon]) missing.push(`${cat.name}: "${cat.icon}"`);
    }
    expect(missing, `Missing icons: ${missing.join(', ')}`).toHaveLength(0);
  });
});

describe('Default categories structure', () => {
  it('all expense categories have required fields', () => {
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      expect(cat.name, 'name missing').toBeTruthy();
      expect(cat.icon, 'icon missing').toBeTruthy();
      expect(cat.type).toBe('expense');
    }
  });

  it('all income categories have required fields', () => {
    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.type).toBe('income');
    }
  });

  it('subcategories reference valid parent keys', () => {
    const parentKeys = DEFAULT_EXPENSE_CATEGORIES
      .filter((c) => !c.parentId)
      .map((c) => {
        const key = `__${c.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
        return key;
      });

    const orphans: string[] = [];
    for (const cat of DEFAULT_EXPENSE_CATEGORIES.filter((c) => c.parentId)) {
      if (!parentKeys.includes(cat.parentId!)) {
        orphans.push(`${cat.name} → ${cat.parentId}`);
      }
    }
    expect(orphans, `Orphan subcategories: ${orphans.join(', ')}`).toHaveLength(0);
  });

  it('expense parent categories have colors', () => {
    const parents = DEFAULT_EXPENSE_CATEGORIES.filter((c) => !c.parentId);
    for (const cat of parents) {
      expect(cat.color, `${cat.name} missing color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
