/**
 * Tests for intentDetector — deterministic keyword-based input intent classification.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent } from '@/features/expenses/engine/intentDetector';

describe('detectIntent — income (certain)', () => {
  it('detects "зарплата 15000"', () => {
    const r = detectIntent('зарплата 15000');
    expect(r?.intent).toBe('income');
    expect(r?.confidence).toBe('certain');
  });

  it('detects "salary 5000"', () => {
    const r = detectIntent('salary 5000');
    expect(r?.intent).toBe('income');
    expect(r?.confidence).toBe('certain');
  });

  it('detects "аванс 7000"', () => {
    const r = detectIntent('аванс 7000');
    expect(r?.intent).toBe('income');
    expect(r?.confidence).toBe('certain');
  });

  it('detects "cashback 120"', () => {
    const r = detectIntent('cashback 120');
    expect(r?.intent).toBe('income');
    expect(r?.confidence).toBe('certain');
  });

  it('detects "кэшбэк 50"', () => {
    const r = detectIntent('кэшбэк 50');
    expect(r?.intent).toBe('income');
    expect(r?.confidence).toBe('certain');
  });

  it('handles Russian inflection — "зарплату получил"', () => {
    const r = detectIntent('зарплату 15000');
    expect(r?.intent).toBe('income');
    expect(r?.confidence).toBe('certain');
  });
});

describe('detectIntent — income (likely)', () => {
  it('detects "получил 3000"', () => {
    const r = detectIntent('получил 3000');
    expect(r?.intent).toBe('income');
    expect(r?.confidence).toBe('likely');
  });

  it('detects "пришло 8000"', () => {
    const r = detectIntent('пришло 8000');
    expect(r?.intent).toBe('income');
    expect(r?.confidence).toBe('likely');
  });

  it('detects "доход 2500"', () => {
    const r = detectIntent('доход 2500');
    expect(r?.intent).toBe('income');
    expect(r?.confidence).toBe('likely');
  });
});

describe('detectIntent — transfer', () => {
  it('detects "перевод 500"', () => {
    const r = detectIntent('перевод 500');
    expect(r?.intent).toBe('transfer');
    expect(r?.confidence).toBe('certain');
  });

  it('detects "transfer 1000"', () => {
    const r = detectIntent('transfer 1000');
    expect(r?.intent).toBe('transfer');
    expect(r?.confidence).toBe('certain');
  });

  it('detects "перекинул 300 другу"', () => {
    const r = detectIntent('перекинул 300 другу');
    expect(r?.intent).toBe('transfer');
    expect(r?.confidence).toBe('certain');
  });
});

describe('detectIntent — recurring', () => {
  it('detects "аренда 12000"', () => {
    const r = detectIntent('аренда 12000');
    expect(r?.intent).toBe('recurring');
    expect(r?.confidence).toBe('likely');
  });

  it('detects "rent 600"', () => {
    const r = detectIntent('rent 600');
    expect(r?.intent).toBe('recurring');
    expect(r?.confidence).toBe('likely');
  });

  it('detects "ипотека 35000"', () => {
    const r = detectIntent('ипотека 35000');
    expect(r?.intent).toBe('recurring');
    expect(r?.confidence).toBe('likely');
  });

  it('detects "подписка netflix 199"', () => {
    const r = detectIntent('подписка netflix 199');
    expect(r?.intent).toBe('recurring');
    expect(r?.confidence).toBe('likely');
  });

  it('detects "коммунальные 4500"', () => {
    const r = detectIntent('коммунальные 4500');
    expect(r?.intent).toBe('recurring');
    expect(r?.confidence).toBe('likely');
  });
});

describe('detectIntent — expense (returns null)', () => {
  it('returns null for "кофе 50"', () => {
    expect(detectIntent('кофе 50')).toBeNull();
  });

  it('returns null for "Dabbah 350"', () => {
    expect(detectIntent('Dabbah 350')).toBeNull();
  });

  it('returns null for "бензин 250"', () => {
    expect(detectIntent('бензин 250')).toBeNull();
  });

  it('returns null for "продукты 1200"', () => {
    expect(detectIntent('продукты 1200')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectIntent('')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(detectIntent('   ')).toBeNull();
  });
});

describe('detectIntent — priority ordering', () => {
  it('income certain takes priority over income likely', () => {
    // "зарплата получил" — both certain and likely present; certain wins
    const r = detectIntent('зарплата получил 15000');
    expect(r?.confidence).toBe('certain');
  });

  it('transfer certain takes priority over recurring likely', () => {
    // contrived but tests ordering
    const r = detectIntent('перевод аренда 500');
    expect(r?.intent).toBe('transfer');
  });
});
