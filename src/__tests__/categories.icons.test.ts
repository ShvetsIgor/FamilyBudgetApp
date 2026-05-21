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

  it('all expense categories have colors', () => {
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      expect(cat.color, `${cat.name} missing color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
