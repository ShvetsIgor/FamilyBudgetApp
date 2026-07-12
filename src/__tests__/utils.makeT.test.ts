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
});
