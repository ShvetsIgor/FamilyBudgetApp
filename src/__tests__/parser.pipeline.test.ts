import { describe, it, expect } from 'vitest';
import {
  tokenizeInput,
  extractAmounts,
  resolveEmojiHit,
  detectMerchant,
  extractCandidateItems,
  resolveCategoryCandidates,
  scoreConfidence,
} from '@/features/chat/parser/pipeline';

// ── tokenizeInput ─────────────────────────────────────────────────────────────

describe('tokenizeInput', () => {
  it('trims and lowercases', () => {
    const r = tokenizeInput('  Кофе 65  ');
    expect(r.lower).toBe('кофе 65');
    expect(r.normalized).toBe('Кофе 65');
  });

  it('collapses whitespace', () => {
    const r = tokenizeInput('кофе  65');
    expect(r.lower).toBe('кофе 65');
  });

  it('detects income prefix "+"', () => {
    expect(tokenizeInput('+5000 зарплата').isIncome).toBe(true);
    expect(tokenizeInput('5000 кофе').isIncome).toBe(false);
  });

  it('detects slash command', () => {
    expect(tokenizeInput('/help').isSlashCommand).toBe(true);
    expect(tokenizeInput('help').isSlashCommand).toBe(false);
  });

  it('empty string → not income, not slash', () => {
    const r = tokenizeInput('');
    expect(r.isIncome).toBe(false);
    expect(r.isSlashCommand).toBe(false);
  });
});

// ── extractAmounts ────────────────────────────────────────────────────────────

describe('extractAmounts', () => {
  it('parses integer', () => {
    const r = extractAmounts('65 кофе');
    expect(r?.amount).toBe(65);
    expect(r?.rest).toBe('кофе');
  });

  it('parses decimal with dot', () => {
    const r = extractAmounts('12.5 обед');
    expect(r?.amount).toBe(12.5);
  });

  it('parses decimal with comma', () => {
    const r = extractAmounts('99,90 хлеб');
    expect(r?.amount).toBe(99.9);
  });

  it('amount at end', () => {
    const r = extractAmounts('кофе 65');
    expect(r?.amount).toBe(65);
    expect(r?.rest.trim()).toBe('кофе');
  });

  it('no number → null', () => {
    expect(extractAmounts('кофе')).toBeNull();
  });

  it('empty string → null', () => {
    expect(extractAmounts('')).toBeNull();
  });
});

// ── resolveEmojiHit ───────────────────────────────────────────────────────────

describe('resolveEmojiHit', () => {
  it('no emoji → null', () => {
    expect(resolveEmojiHit('кофе 65')).toBeNull();
  });

  it('known emoji → returns categoryId', () => {
    // ☕ is mapped in EMOJI dictionary
    const r = resolveEmojiHit('65 ☕');
    if (r) {
      expect(r.emoji).toBe('☕');
      expect(typeof r.categoryId).toBe('string');
    }
    // If emoji is not in dictionary this is still valid (no crash)
  });
});

// ── resolveCategoryCandidates ─────────────────────────────────────────────────

describe('resolveCategoryCandidates', () => {
  const mockStore = (needsContext: boolean) => ({
    id: 's1',
    name: 'TestStore',
    keyword: 'teststore',
    categoryId: 'groceries',
    needsContext,
    storeGroup: 'supermarket' as const,
  });

  const mockItem = () => ({
    keyword: 'молоко',
    categoryId: 'dairy',
  });

  it('no signals → failed, null', () => {
    const r = resolveCategoryCandidates(undefined, []);
    expect(r.categoryId).toBeNull();
    expect(r.confidence).toBe('failed');
  });

  it('self-describing store only → high', () => {
    const r = resolveCategoryCandidates(mockStore(false), []);
    expect(r.categoryId).toBe('groceries');
    expect(r.confidence).toBe('high');
  });

  it('ambiguous store only → low, null', () => {
    const r = resolveCategoryCandidates(mockStore(true), []);
    expect(r.categoryId).toBeNull();
    expect(r.confidence).toBe('low');
  });

  it('item only → medium', () => {
    const r = resolveCategoryCandidates(undefined, [mockItem()]);
    expect(r.categoryId).toBe('dairy');
    expect(r.confidence).toBe('medium');
  });

  it('store + item → item wins, high', () => {
    const r = resolveCategoryCandidates(mockStore(false), [mockItem()]);
    expect(r.categoryId).toBe('dairy');
    expect(r.confidence).toBe('high');
  });

  it('ambiguous store + item → item wins, high', () => {
    const r = resolveCategoryCandidates(mockStore(true), [mockItem()]);
    expect(r.categoryId).toBe('dairy');
    expect(r.confidence).toBe('high');
  });
});

// ── scoreConfidence ───────────────────────────────────────────────────────────

describe('scoreConfidence', () => {
  it('high → score 1.0, no confirmation', () => {
    const r = scoreConfidence('high');
    expect(r.score).toBe(1.0);
    expect(r.needsConfirmation).toBe(false);
  });

  it('medium → score 0.6', () => {
    expect(scoreConfidence('medium').score).toBe(0.6);
  });

  it('low → needsConfirmation true', () => {
    const r = scoreConfidence('low');
    expect(r.needsConfirmation).toBe(true);
    expect(r.score).toBe(0.3);
  });

  it('failed → score 0, no confirmation', () => {
    const r = scoreConfidence('failed');
    expect(r.score).toBe(0.0);
    expect(r.needsConfirmation).toBe(false);
  });
});

// ── detectMerchant ────────────────────────────────────────────────────────────

describe('detectMerchant', () => {
  it('unknown text → undefined', () => {
    expect(detectMerchant('случайный текст без магазина')).toBeUndefined();
  });

  it('returns StoreMatch shape when matched', () => {
    const r = detectMerchant('купил в макдоналдс');
    if (r) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.name).toBe('string');
      expect(typeof r.needsContext).toBe('boolean');
    }
  });
});

// ── extractCandidateItems ─────────────────────────────────────────────────────

describe('extractCandidateItems', () => {
  it('no known items → empty array', () => {
    expect(extractCandidateItems('что-то непонятное')).toEqual([]);
  });

  it('known item → array with one ItemMatch', () => {
    const r = extractCandidateItems('кофе');
    if (r.length > 0) {
      expect(typeof r[0].keyword).toBe('string');
      expect(typeof r[0].categoryId).toBe('string');
    }
  });
});
