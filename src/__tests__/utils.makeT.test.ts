import { describe, expect, it } from 'vitest';
import { makeT } from '@/shared/utils/makeT';

describe('makeT', () => {
  it('uses the Hebrew catalog when a translation exists', () => {
    expect(makeT('he')('nav.add')).toBe('הוסף');
  });

  it('falls back to English for incomplete locale entries', () => {
    expect(makeT('he')('nav.mobileNavigation')).toBe('Primary navigation');
  });

  it('keeps interpolation when using the fallback catalog', () => {
    expect(makeT('he')('analytics.trendSummary', { n: 6 })).toBe('Spending trend across 6 months');
  });

  it('localizes the new mobile income and planning flows in Hebrew', () => {
    const t = makeT('he');
    expect(t('nav.plan')).toBe('תכנון');
    expect(t('income.add')).toBe('הוסף הכנסה');
    expect(t('quickadd.tabExpense')).toBe('הוצאה');
    expect(t('quickadd.tabIncome')).toBe('הכנסה');
    expect(t('chat.emptyTitle')).toBe('רשום את ההוצאה הראשונה שלך');
    expect(t('chat.emptyHint')).toContain('קפה 30');
    expect(t('chat.emptyExample')).toBe('קפה 30');
  });

  it('localizes the automatically created unsorted category', () => {
    expect(makeT('ru').cat('Unsorted')).toBe('Неразобранное');
  });
});
