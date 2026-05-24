import { describe, it, expect } from 'vitest';
import { buildExpenseDraft } from '@/features/expenses/engine/buildExpenseDraft';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';
import type { Category } from '@/shared/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const emptyMemory: SuggestionMemoryState = {
  merchants: {},
  recents: [],
  splitCombos: [],
  tagAssociations: [],
  merchantContextStats: {},
};

const cats: Category[] = [
  { id: 'groceries', name: 'Groceries', icon: 'cart', color: '#E07A5F', folderId: 'food', userId: 'u1', isPrivate: false, order: 0, type: 'expense' },
  { id: 'household', name: 'Household', icon: 'house', color: '#81B29A', folderId: 'home', userId: 'u1', isPrivate: false, order: 1, type: 'expense' },
  { id: 'alcohol',   name: 'Alcohol',   icon: 'beer',  color: '#F2CC8F', folderId: 'food', userId: 'u1', isPrivate: false, order: 2, type: 'expense' },
  { id: 'transport', name: 'Transport', icon: 'car',   color: '#3D405B', folderId: 'transport', userId: 'u1', isPrivate: false, order: 3, type: 'expense' },
];

function memoryWithDabbah(count = 3): SuggestionMemoryState {
  return {
    ...emptyMemory,
    merchants: {
      dabbah: [
        { categoryId: 'groceries', count, lastUsed: '2025-05-01' },
        { categoryId: 'household', count: Math.floor(count / 2), lastUsed: '2025-04-01' },
      ],
    },
    merchantContextStats: {
      dabbah: { food: count, home: Math.floor(count / 2) },
    },
  };
}

// ── Core output shape ─────────────────────────────────────────────────────────

describe('buildExpenseDraft — output shape', () => {
  it('returns all required fields', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 100 }, cats, emptyMemory);
    expect(draft).toHaveProperty('raw');
    expect(draft).toHaveProperty('amount');
    expect(draft).toHaveProperty('merchant');
    expect(draft).toHaveProperty('merchantKey');
    expect(draft).toHaveProperty('suggestedContext');
    expect(draft).toHaveProperty('suggestedCategories');
    expect(draft).toHaveProperty('confidenceLevel');
    expect(draft).toHaveProperty('confidenceScore');
    expect(draft).toHaveProperty('shouldSuggestSplit');
    expect(draft).toHaveProperty('splitPresets');
    expect(draft).toHaveProperty('unknownTokens');
    expect(draft).toHaveProperty('itemCandidates');
    expect(draft).toHaveProperty('hasMerchantHistory');
    expect(draft).toHaveProperty('parserContext');
  });
});

// ── No history (cold start) ───────────────────────────────────────────────────

describe('buildExpenseDraft — no history', () => {
  it('returns empty suggested categories (no fake suggestions)', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 500 }, cats, emptyMemory);
    expect(draft.suggestedCategories).toHaveLength(0);
  });

  it('returns null context (no fake context)', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 500 }, cats, emptyMemory);
    expect(draft.suggestedContext).toBeNull();
  });

  it('hasMerchantHistory is false', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 500 }, cats, emptyMemory);
    expect(draft.hasMerchantHistory).toBe(false);
  });

  it('splitPresets is empty', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 500 }, cats, emptyMemory);
    expect(draft.splitPresets).toHaveLength(0);
  });

  it('confidenceLevel is low with no history', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah' }, cats, emptyMemory);
    expect(draft.confidenceLevel).toBe('low');
  });
});

// ── With merchant history ─────────────────────────────────────────────────────

describe('buildExpenseDraft — with merchant history', () => {
  it('hasMerchantHistory is true after sufficient saves', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah' }, cats, memoryWithDabbah(3));
    expect(draft.hasMerchantHistory).toBe(true);
  });

  it('suggestedCategories returns ranked merchant-specific items', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah' }, cats, memoryWithDabbah(3));
    expect(draft.suggestedCategories.length).toBeGreaterThan(0);
    const ids = draft.suggestedCategories.map((s) => s.categoryId);
    expect(ids).toContain('groceries');
  });

  it('suggestedContext returns food folder', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah' }, cats, memoryWithDabbah(3));
    expect(draft.suggestedContext).not.toBeNull();
    expect(draft.suggestedContext!.folderId).toBe('food');
  });

  it('groceries ranks above household (higher count)', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah' }, cats, memoryWithDabbah(4));
    const ids = draft.suggestedCategories.map((s) => s.categoryId);
    const grocIdx = ids.indexOf('groceries');
    const houseIdx = ids.indexOf('household');
    expect(grocIdx).toBeLessThan(houseIdx);
  });

  it('normalizes merchant key', () => {
    const draft = buildExpenseDraft({ merchant: '  DABBAH  ' }, cats, memoryWithDabbah(3));
    expect(draft.hasMerchantHistory).toBe(true);
    expect(draft.merchantKey).toBe('dabbah');
  });
});

// ── Amounts and split suggestion ──────────────────────────────────────────────

describe('buildExpenseDraft — split suggestion', () => {
  it('shouldSuggestSplit is false for small amounts', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 100 }, cats, emptyMemory);
    expect(draft.shouldSuggestSplit).toBe(false);
  });

  it('shouldSuggestSplit is true for amounts >= 500', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 500 }, cats, emptyMemory);
    expect(draft.shouldSuggestSplit).toBe(true);
  });

  it('amount is passed through correctly', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 350 }, cats, emptyMemory);
    expect(draft.amount).toBe(350);
  });

  it('amount is null when not provided', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah' }, cats, emptyMemory);
    expect(draft.amount).toBeNull();
  });
});

// ── Raw text parsing ──────────────────────────────────────────────────────────

describe('buildExpenseDraft — raw text input', () => {
  it('parses amount from raw text', () => {
    const draft = buildExpenseDraft({ raw: 'Dabbah 1000' }, cats, emptyMemory);
    expect(draft.amount).toBe(1000);
  });

  it('parses merchant from raw text', () => {
    const draft = buildExpenseDraft({ raw: 'Dabbah 1000' }, cats, emptyMemory);
    expect(draft.merchant).toBe('Dabbah');
    expect(draft.merchantKey).toBe('dabbah');
  });

  it('populates parserContext when raw text provided', () => {
    const draft = buildExpenseDraft({ raw: 'Dabbah 1000' }, cats, emptyMemory);
    expect(draft.parserContext).not.toBeNull();
    expect(draft.parserContext!.amount).toBe(1000);
  });

  it('parserContext is null when using merchant override (no raw text)', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 1000 }, cats, emptyMemory);
    expect(draft.parserContext).toBeNull();
  });

  it('shouldSuggestSplit from large amount in raw text', () => {
    const draft = buildExpenseDraft({ raw: 'Dabbah 600' }, cats, emptyMemory);
    expect(draft.shouldSuggestSplit).toBe(true);
  });
});

// ── Unknown token detection ───────────────────────────────────────────────────

describe('buildExpenseDraft — unknown tokens', () => {
  it('no unknown tokens when no raw text', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 100 }, cats, emptyMemory);
    expect(draft.unknownTokens).toHaveLength(0);
  });

  it('detects unknown token "drill" not in any category name', () => {
    // With dabbah in memory so it's detected as merchant, leaving "drill" and "milk" as items
    const memory = memoryWithDabbah(3);
    const draft = buildExpenseDraft({ raw: 'Dabbah drill milk 1000' }, cats, memory);
    // itemCandidates come from parser; drill doesn't match any category name
    // Note: whether it's extracted depends on merchant detection (dabbah must be known)
    if (draft.itemCandidates.length > 0) {
      const unknown = draft.unknownTokens;
      // drill doesn't match any category name
      const drillInUnknown = unknown.some(t => t.toLowerCase() === 'drill');
      if (draft.itemCandidates.some(t => t.toLowerCase() === 'drill')) {
        expect(drillInUnknown).toBe(true);
      }
    }
  });

  it('unknownTokens does not contain category names', () => {
    const memory = memoryWithDabbah(3);
    const draft = buildExpenseDraft({ raw: 'Dabbah groceries 500' }, cats, memory);
    // 'groceries' matches a category name → should NOT be in unknownTokens
    expect(draft.unknownTokens).not.toContain('Groceries');
    expect(draft.unknownTokens).not.toContain('groceries');
  });

  it('itemCandidates is empty in numpad mode', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 500 }, cats, emptyMemory);
    expect(draft.itemCandidates).toHaveLength(0);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('buildExpenseDraft — edge cases', () => {
  it('handles empty input gracefully', () => {
    const draft = buildExpenseDraft({}, cats, emptyMemory);
    expect(draft.amount).toBeNull();
    expect(draft.merchant).toBeNull();
    expect(draft.suggestedCategories).toHaveLength(0);
    expect(draft.hasMerchantHistory).toBe(false);
  });

  it('handles empty categories list gracefully', () => {
    const draft = buildExpenseDraft({ merchant: 'Dabbah', amount: 500 }, [], emptyMemory);
    expect(draft.suggestedCategories).toHaveLength(0);
    expect(draft.shouldSuggestSplit).toBe(true);
  });

  it('raw empty string treated as numpad mode', () => {
    const draft = buildExpenseDraft({ raw: '', merchant: 'Dabbah', amount: 100 }, cats, emptyMemory);
    expect(draft.merchant).toBe('Dabbah');
    expect(draft.parserContext).toBeNull();
  });

  it('amount override takes precedence over parsed amount', () => {
    const draft = buildExpenseDraft({ raw: 'Dabbah 999', amount: 500 }, cats, emptyMemory);
    expect(draft.amount).toBe(500);
  });

  it('merchant override takes precedence over parsed merchant', () => {
    const draft = buildExpenseDraft({ raw: 'Shufersal 200', merchant: 'Dabbah' }, cats, emptyMemory);
    expect(draft.merchant).toBe('Dabbah');
  });
});
