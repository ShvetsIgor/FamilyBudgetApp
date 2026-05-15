import { describe, it, expect } from 'vitest';
import { expensesToCsv, incomeTocsv } from '@/shared/utils/exportCsv';
import type { SerializableExpense, SerializableIncome } from '@/shared/types';

const baseExpense: SerializableExpense = {
  id: 'e1',
  userId: 'u1',
  amount: 150,
  currency: 'ILS',
  categoryId: 'cat1',
  date: '2026-05-01T10:00:00.000Z',
  paymentMethod: 'card',
  tags: [],
  privacy: 'regular',
  splits: [],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

const baseIncome: SerializableIncome = {
  id: 'i1',
  userId: 'u1',
  amount: 5000,
  currency: 'ILS',
  categoryId: 'inc1',
  date: '2026-05-01T10:00:00.000Z',
  method: 'bank',
  tags: [],
  privacy: 'regular',
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

describe('expensesToCsv', () => {
  it('produces header + one data row', () => {
    const csv = expensesToCsv([baseExpense], { cat1: 'Groceries' });
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Date');
    expect(lines[0]).toContain('Category');
    expect(lines[0]).toContain('Amount');
  });

  it('resolves category name from map', () => {
    const csv = expensesToCsv([baseExpense], { cat1: 'Groceries' });
    expect(csv).toContain('Groceries');
  });

  it('falls back to categoryId when name not in map', () => {
    const csv = expensesToCsv([baseExpense], {});
    expect(csv).toContain('cat1');
  });

  it('formats date as yyyy-MM-dd', () => {
    const csv = expensesToCsv([baseExpense], {});
    expect(csv).toContain('2026-05-01');
  });

  it('escapes values containing commas', () => {
    const exp = { ...baseExpense, store: 'Store, Inc.' };
    const csv = expensesToCsv([exp], {});
    expect(csv).toContain('"Store, Inc."');
  });

  it('joins tags with semicolons', () => {
    const exp = { ...baseExpense, tags: ['food', 'market'] };
    const csv = expensesToCsv([exp], {});
    expect(csv).toContain('food; market');
  });

  it('returns only header for empty array', () => {
    const csv = expensesToCsv([], {});
    expect(csv.split('\n')).toHaveLength(1);
  });
});

describe('incomeTocsv', () => {
  it('produces header + one data row', () => {
    const csv = incomeTocsv([baseIncome], { inc1: 'Salary' });
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Category');
  });

  it('resolves category name', () => {
    const csv = incomeTocsv([baseIncome], { inc1: 'Salary' });
    expect(csv).toContain('Salary');
  });

  it('includes method and amount', () => {
    const csv = incomeTocsv([baseIncome], {});
    expect(csv).toContain('bank');
    expect(csv).toContain('5000');
  });
});
