import { describe, expect, it } from 'vitest';
import { makeT } from '@/shared/utils/makeT';

describe('makeT', () => {
  it('uses the requested catalog', () => {
    expect(makeT('ru')('nav.add')).toBe('Добавить');
  });

  it('falls back to English for an unbundled locale', () => {
    // Hebrew is paused: the catalog is no longer shipped, so it must resolve
    // to English rather than echoing the key back at the user.
    expect(makeT('he')('nav.mobileNavigation')).toBe('Primary navigation');
  });

  it('keeps interpolation when using the fallback catalog', () => {
    expect(makeT('he')('analytics.trendSummary', { n: 6 })).toBe('Spending trend across 6 months');
  });

  it('localizes the automatically created unsorted category', () => {
    expect(makeT('ru').cat('Unsorted')).toBe('Неразобранное');
  });
});
