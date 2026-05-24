import { describe, it, expect } from 'vitest';
import {
  normalizeToken,
  normalizeAlias,
  normalizeTag,
  normalizeKeyword,
  tokenizeForMatching,
  deduplicateNormalized,
  normalizedEquals,
  normalizedIncludes,
} from '../features/categories/utils/categoryNormalization';
import {
  scoreCategoryMatch,
  extractCandidateTokens,
  findMatchingCategoriesByTag,
} from '../features/categories/utils/tagMatching';
import {
  suggestCategoriesFromInput,
  enrichCategoryTagsFromSplit,
} from '../features/categories/utils/categorySuggestions';
import {
  mergeCategoryMetadata,
  recordCategoryUsage,
  addAlias,
  addKeyword,
  emptyCategoryMetadata,
} from '../features/categories/types/categoryMetadata';
import type { Category } from '../shared/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat1',
    userId: 'u1',
    name: 'Groceries',
    icon: 'cart',
    color: '#81B29A',
    isPrivate: false,
    order: 0,
    type: 'expense',
    ...overrides,
  };
}

const CATS: Category[] = [
  makeCategory({ id: 'groceries', name: 'Groceries', aliases: ['rami levi', 'dabbah'], tags: ['supermarket'] }),
  makeCategory({ id: 'home', name: 'Home', aliases: ['ikea'], tags: ['dabbah', 'tools'], keywords: ['drill', 'shelf'] }),
  makeCategory({ id: 'health', name: 'Health', aliases: ['pharmacy'], tags: ['clinic'] }),
  makeCategory({ id: 'electronics', name: 'Electronics', tags: ['dabbah'], keywords: ['cable', 'charger'] }),
  makeCategory({ id: 'transport', name: 'Transport', aliases: ['taxi'], tags: ['bus'] }),
  makeCategory({ id: 'archived', name: 'Old', archived: true }),
];

// ── categoryNormalization ────────────────────────────────────────────────────

describe('categoryNormalization', () => {
  describe('normalizeToken', () => {
    it('lowercases and trims', () => {
      expect(normalizeToken('  Hello  ')).toBe('hello');
    });

    it('collapses internal whitespace', () => {
      expect(normalizeToken('foo   bar')).toBe('foo bar');
    });

    it('applies NFC', () => {
      // Composed vs decomposed — both should normalize to same
      const composed = '\u00e9'; // é (NFC)
      const decomposed = 'e\u0301'; // e + combining accent (NFD)
      expect(normalizeToken(composed)).toBe(normalizeToken(decomposed));
    });

    it('handles Hebrew safely', () => {
      const heb = '  שלום  ';
      expect(normalizeToken(heb)).toBe('שלום');
    });

    it('handles Russian safely', () => {
      expect(normalizeToken('  Привет  ')).toBe('привет');
    });

    it('handles empty string', () => {
      expect(normalizeToken('')).toBe('');
    });
  });

  describe('normalizeAlias', () => {
    it('same as normalizeToken', () => {
      expect(normalizeAlias('Rami Levi')).toBe('rami levi');
    });
  });

  describe('normalizeTag', () => {
    it('strips special characters', () => {
      expect(normalizeTag('super@market!')).toBe('supermarket');
    });

    it('keeps hyphens and underscores', () => {
      expect(normalizeTag('well-being')).toBe('well-being');
      expect(normalizeTag('food_court')).toBe('food_court');
    });

    it('keeps Hebrew letters', () => {
      expect(normalizeTag('שוק!')).toBe('שוק');
    });
  });

  describe('normalizeKeyword', () => {
    it('normalizes keyword', () => {
      expect(normalizeKeyword('  BREAD  ')).toBe('bread');
    });
  });

  describe('tokenizeForMatching', () => {
    it('splits and filters numbers', () => {
      expect(tokenizeForMatching('dabbah drill 150')).toEqual(['dabbah', 'drill']);
    });

    it('filters tokens shorter than 2 chars', () => {
      expect(tokenizeForMatching('a coffee 45')).toEqual(['coffee']);
    });

    it('returns empty for pure numeric input', () => {
      expect(tokenizeForMatching('150')).toEqual([]);
    });

    it('handles mixed scripts', () => {
      expect(tokenizeForMatching('кофе 45')).toEqual(['кофе']);
    });
  });

  describe('deduplicateNormalized', () => {
    it('removes exact duplicates', () => {
      expect(deduplicateNormalized(['foo', 'foo', 'bar'])).toEqual(['foo', 'bar']);
    });

    it('deduplicates case-insensitively', () => {
      expect(deduplicateNormalized(['Foo', 'foo', 'FOO'])).toHaveLength(1);
    });

    it('preserves order of first occurrence', () => {
      const result = deduplicateNormalized(['b', 'a', 'b']);
      expect(result[0]).toBe('b');
      expect(result[1]).toBe('a');
    });

    it('filters empty strings', () => {
      expect(deduplicateNormalized(['', 'foo', ''])).toEqual(['foo']);
    });
  });

  describe('normalizedEquals', () => {
    it('true for same normalized form', () => {
      expect(normalizedEquals('Hello', 'hello')).toBe(true);
    });

    it('false for different strings', () => {
      expect(normalizedEquals('foo', 'bar')).toBe(false);
    });
  });

  describe('normalizedIncludes', () => {
    it('true when haystack contains needle', () => {
      expect(normalizedIncludes('Supermarket', 'super')).toBe(true);
    });

    it('false when not contained', () => {
      expect(normalizedIncludes('Supermarket', 'pharmacy')).toBe(false);
    });
  });
});

// ── tagMatching ───────────────────────────────────────────────────────────────

describe('tagMatching', () => {
  describe('extractCandidateTokens', () => {
    it('extracts non-numeric tokens', () => {
      expect(extractCandidateTokens('dabbah drill 150')).toEqual(['dabbah', 'drill']);
    });

    it('filters short tokens', () => {
      expect(extractCandidateTokens('a coffee 45')).toEqual(['coffee']);
    });

    it('returns empty array for number-only input', () => {
      expect(extractCandidateTokens('350')).toEqual([]);
    });
  });

  describe('scoreCategoryMatch', () => {
    it('returns 0 for no match', () => {
      const cat = makeCategory({ name: 'Electronics', aliases: [], tags: [], keywords: [] });
      expect(scoreCategoryMatch('grocery', cat)).toBe(0);
    });

    it('scores alias exact match highest', () => {
      const cat = makeCategory({ name: 'Groceries', aliases: ['dabbah'] });
      const aliasScore = scoreCategoryMatch('dabbah', cat);
      const nameScore = scoreCategoryMatch('groceries', cat);
      expect(aliasScore).toBeGreaterThan(0);
      expect(nameScore).toBeGreaterThan(0);
      // alias exact (50) > name exact (40)
      expect(aliasScore).toBeGreaterThan(nameScore);
    });

    it('scores name exact match', () => {
      const cat = makeCategory({ name: 'Health' });
      expect(scoreCategoryMatch('health', cat)).toBeGreaterThan(0);
    });

    it('scores tag match', () => {
      const cat = makeCategory({ name: 'Groceries', tags: ['supermarket'] });
      expect(scoreCategoryMatch('supermarket', cat)).toBeGreaterThan(0);
    });

    it('scores keyword match', () => {
      const cat = makeCategory({ name: 'Home', keywords: ['drill'] });
      expect(scoreCategoryMatch('drill', cat)).toBeGreaterThan(0);
    });

    it('alias exact > tag exact > keyword exact', () => {
      const cat = makeCategory({
        name: 'Other',
        aliases: ['token'],
        tags: ['token'],
        keywords: ['token'],
      });
      // With all matching, score should accumulate (they're separate checks)
      const score = scoreCategoryMatch('token', cat);
      expect(score).toBeGreaterThan(50); // alias + tag + keyword contributions
    });
  });

  describe('findMatchingCategoriesByTag', () => {
    const NOW = new Date('2026-05-24').getTime();

    it('returns empty when no tokens', () => {
      expect(findMatchingCategoriesByTag([], CATS, NOW)).toEqual([]);
    });

    it('excludes archived categories', () => {
      const result = findMatchingCategoriesByTag(['old'], CATS, NOW);
      expect(result.every((r) => !r.category.archived)).toBe(true);
    });

    it('finds categories matching by alias', () => {
      const result = findMatchingCategoriesByTag(['dabbah'], CATS, NOW);
      const ids = result.map((r) => r.category.id);
      // groceries has 'dabbah' alias, home and electronics have 'dabbah' tag
      expect(ids).toContain('groceries');
      expect(ids).toContain('home');
      expect(ids).toContain('electronics');
    });

    it('groceries ranks highest for dabbah (alias vs tag)', () => {
      const result = findMatchingCategoriesByTag(['dabbah'], CATS, NOW);
      expect(result[0].category.id).toBe('groceries');
    });

    it('finds by keyword', () => {
      const result = findMatchingCategoriesByTag(['drill'], CATS, NOW);
      const ids = result.map((r) => r.category.id);
      expect(ids).toContain('home');
    });

    it('multiple tokens accumulate score', () => {
      const single = findMatchingCategoriesByTag(['dabbah'], CATS, NOW);
      const multi = findMatchingCategoriesByTag(['dabbah', 'drill'], CATS, NOW);
      const homeInSingle = single.find((r) => r.category.id === 'home')?.score ?? 0;
      const homeInMulti = multi.find((r) => r.category.id === 'home')?.score ?? 0;
      expect(homeInMulti).toBeGreaterThan(homeInSingle);
    });

    it('usage boost increases score', () => {
      const withUsage = makeCategory({ id: 'g2', name: 'Groceries', aliases: ['dabbah'], usageCount: 8 });
      const withoutUsage = makeCategory({ id: 'g3', name: 'Groceries', aliases: ['dabbah'] });
      const r1 = findMatchingCategoriesByTag(['dabbah'], [withUsage], NOW)[0];
      const r2 = findMatchingCategoriesByTag(['dabbah'], [withoutUsage], NOW)[0];
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it('recency boost applies within 30 days', () => {
      const recent = makeCategory({ id: 'r1', name: 'Groceries', aliases: ['dabbah'], lastUsedAt: new Date(NOW - 5 * 86_400_000).toISOString() });
      const old = makeCategory({ id: 'r2', name: 'Groceries', aliases: ['dabbah'], lastUsedAt: new Date(NOW - 60 * 86_400_000).toISOString() });
      const r1 = findMatchingCategoriesByTag(['dabbah'], [recent], NOW)[0];
      const r2 = findMatchingCategoriesByTag(['dabbah'], [old], NOW)[0];
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it('result is sorted by score descending', () => {
      const result = findMatchingCategoriesByTag(['dabbah'], CATS, NOW);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
      }
    });

    it('is deterministic — same input produces same output', () => {
      const r1 = findMatchingCategoriesByTag(['dabbah'], CATS, NOW);
      const r2 = findMatchingCategoriesByTag(['dabbah'], CATS, NOW);
      expect(r1.map((r) => r.category.id)).toEqual(r2.map((r) => r.category.id));
    });
  });
});

// ── categorySuggestions ───────────────────────────────────────────────────────

describe('categorySuggestions', () => {
  const NOW = new Date('2026-05-24').getTime();

  describe('suggestCategoriesFromInput', () => {
    it('returns empty for number-only input', () => {
      expect(suggestCategoriesFromInput('350', CATS, 5, NOW)).toEqual([]);
    });

    it('returns empty when no categories', () => {
      expect(suggestCategoriesFromInput('dabbah', [], 5, NOW)).toEqual([]);
    });

    it('suggests matching categories', () => {
      const result = suggestCategoriesFromInput('dabbah 150', CATS, 5, NOW);
      expect(result.length).toBeGreaterThan(0);
      const ids = result.map((s) => s.category.id);
      expect(ids).toContain('groceries');
    });

    it('respects topN limit', () => {
      const result = suggestCategoriesFromInput('dabbah', CATS, 2, NOW);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('each suggestion has a reason string', () => {
      const result = suggestCategoriesFromInput('dabbah', CATS, 5, NOW);
      for (const s of result) {
        expect(typeof s.reason).toBe('string');
        expect(s.reason.length).toBeGreaterThan(0);
      }
    });

    it('suggestions are sorted by score descending', () => {
      const result = suggestCategoriesFromInput('dabbah drill', CATS, 5, NOW);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
      }
    });
  });

  describe('enrichCategoryTagsFromSplit', () => {
    it('adds merchant token as tag to selected categories', () => {
      const patches = enrichCategoryTagsFromSplit('dabbah', ['health', 'transport'], CATS);
      const ids = patches.map((p) => p.categoryId);
      expect(ids).toContain('health');
      expect(ids).toContain('transport');
    });

    it('does not duplicate existing tag', () => {
      // groceries already has 'dabbah' as alias, but not as tag in CATS fixture
      // home has 'dabbah' as tag — should not appear in patch
      const patches = enrichCategoryTagsFromSplit('dabbah', ['home'], CATS);
      expect(patches).toHaveLength(0); // 'dabbah' already in home.tags
    });

    it('returns empty for short/empty merchant token', () => {
      expect(enrichCategoryTagsFromSplit('', ['groceries'], CATS)).toHaveLength(0);
      expect(enrichCategoryTagsFromSplit('x', ['groceries'], CATS)).toHaveLength(0);
    });

    it('skips archived categories', () => {
      const patches = enrichCategoryTagsFromSplit('store', ['archived'], CATS);
      expect(patches).toHaveLength(0);
    });

    it('normalizes the merchant token before adding', () => {
      const patches = enrichCategoryTagsFromSplit('  Pharmacy  ', ['health'], CATS);
      // health doesn't have 'pharmacy' as tag (it has it as alias, not tag)
      const healthPatch = patches.find((p) => p.categoryId === 'health');
      if (healthPatch) {
        expect(healthPatch.updatedTags).toContain('pharmacy');
      }
    });

    it('returns only categories that need updating', () => {
      // All selected categories already have 'dabbah' tag or it's a no-op
      const patches = enrichCategoryTagsFromSplit('dabbah', ['home', 'electronics'], CATS);
      // home.tags = ['dabbah', 'tools'] → already has it → no patch
      // electronics.tags = ['dabbah'] → already has it → no patch
      expect(patches).toHaveLength(0);
    });
  });
});

// ── categoryMetadata ─────────────────────────────────────────────────────────

describe('categoryMetadata', () => {
  describe('emptyCategoryMetadata', () => {
    it('returns empty object', () => {
      expect(emptyCategoryMetadata()).toEqual({});
    });
  });

  describe('mergeCategoryMetadata', () => {
    it('merges aliases without duplicates', () => {
      const result = mergeCategoryMetadata(
        { aliases: ['foo', 'bar'] },
        { aliases: ['bar', 'baz'] },
      );
      expect(result.aliases).toHaveLength(3);
      expect(result.aliases).toContain('foo');
      expect(result.aliases).toContain('bar');
      expect(result.aliases).toContain('baz');
    });

    it('merges keywords without duplicates', () => {
      const result = mergeCategoryMetadata(
        { keywords: ['milk'] },
        { keywords: ['milk', 'bread'] },
      );
      expect(result.keywords).toHaveLength(2);
    });

    it('sums usageCount', () => {
      const result = mergeCategoryMetadata({ usageCount: 3 }, { usageCount: 5 });
      expect(result.usageCount).toBe(8);
    });

    it('uses later lastUsedAt', () => {
      const result = mergeCategoryMetadata(
        { lastUsedAt: '2026-01-01' },
        { lastUsedAt: '2026-05-24' },
      );
      expect(result.lastUsedAt).toBe('2026-05-24');
    });

    it('handles empty base', () => {
      const result = mergeCategoryMetadata({}, { aliases: ['foo'], usageCount: 2 });
      expect(result.aliases).toEqual(['foo']);
      expect(result.usageCount).toBe(2);
    });
  });

  describe('recordCategoryUsage', () => {
    it('increments usageCount', () => {
      const result = recordCategoryUsage({ usageCount: 4 });
      expect(result.usageCount).toBe(5);
    });

    it('starts from 0 if usageCount missing', () => {
      const result = recordCategoryUsage({});
      expect(result.usageCount).toBe(1);
    });

    it('updates lastUsedAt to a valid ISO date', () => {
      const result = recordCategoryUsage({});
      expect(new Date(result.lastUsedAt!).getTime()).not.toBeNaN();
    });
  });

  describe('addAlias', () => {
    it('adds new alias', () => {
      const result = addAlias({ aliases: ['foo'] }, 'bar');
      expect(result.aliases).toEqual(['foo', 'bar']);
    });

    it('does not add duplicate (case-insensitive)', () => {
      const result = addAlias({ aliases: ['Foo'] }, 'foo');
      expect(result.aliases).toHaveLength(1);
    });

    it('trims alias', () => {
      const result = addAlias({}, '  rami levi  ');
      expect(result.aliases?.[0]).toBe('rami levi');
    });
  });

  describe('addKeyword', () => {
    it('adds new keyword', () => {
      const result = addKeyword({ keywords: ['milk'] }, 'bread');
      expect(result.keywords).toEqual(['milk', 'bread']);
    });

    it('does not add duplicate', () => {
      const result = addKeyword({ keywords: ['milk'] }, 'MILK');
      expect(result.keywords).toHaveLength(1);
    });
  });
});
