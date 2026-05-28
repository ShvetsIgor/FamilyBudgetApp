import { describe, expect, it } from 'vitest';
import { parseMessage } from '@/features/chat/parser/parse';

const noLearned = { learned: {} };

describe('parseMessage', () => {
  it('parses bakery keyword with medium confidence', () => {
    const result = parseMessage('хлеб 50', noLearned);
    expect(result.amount).toBe(50);
    expect(result.categoryId).toBe('bakery');
    expect(result.confidence).toBe('medium');
  });

  it('parses coffee keyword with medium confidence', () => {
    const result = parseMessage('кофе 65', noLearned);
    expect(result.amount).toBe(65);
    expect(result.categoryId).toBe('coffee');
    expect(result.confidence).toBe('medium');
  });

  it('keeps number-only input in failed state', () => {
    const result = parseMessage('150', noLearned);
    expect(result.amount).toBe(150);
    expect(result.categoryId).toBeNull();
    expect(result.confidence).toBe('failed');
  });

  it('parses taxi keyword with medium confidence', () => {
    const result = parseMessage('такси 120', noLearned);
    expect(result.amount).toBe(120);
    expect(result.categoryId).toBe('taxi');
    expect(result.confidence).toBe('medium');
  });

  it('uses emoji hits as high-confidence category matches', () => {
    const result = parseMessage('☕ 30', noLearned);
    expect(result.amount).toBe(30);
    expect(result.categoryId).toBe('coffee');
    expect(result.confidence).toBe('high');
  });

  it('treats slash commands as failed expense parses', () => {
    const result = parseMessage('/баланс', noLearned);
    expect(result.amount).toBe(0);
    expect(result.confidence).toBe('failed');
  });

  it('recognizes self-describing stores with high confidence', () => {
    const result = parseMessage('netflix 299', noLearned);
    expect(result.amount).toBe(299);
    expect(result.categoryId).toBe('streaming');
    expect(result.confidence).toBe('high');
  });

  it('parses rent keyword with medium confidence', () => {
    const result = parseMessage('аренда 5000', noLearned);
    expect(result.amount).toBe(5000);
    expect(result.categoryId).toBe('rent');
    expect(result.confidence).toBe('medium');
  });

  it('supports amount-first doctor input', () => {
    const result = parseMessage('65 врач', noLearned);
    expect(result.amount).toBe(65);
    expect(result.categoryId).toBe('doctors');
    expect(result.confidence).toBe('medium');
  });

  it('accepts comma decimal separators', () => {
    const result = parseMessage('50,5 хлеб', noLearned);
    expect(result.amount).toBe(50.5);
    expect(result.categoryId).toBe('bakery');
  });

  it('surfaces learned keyword hits as low-confidence clarifications', () => {
    const ctx = { learned: { хлеб: { categoryId: 'supermarket' } } };
    const result = parseMessage('хлеб 30', ctx);
    expect(result.amount).toBe(30);
    expect(result.confidence).toBe('low');
    expect(result.learnedCategoryId).toBe('supermarket');
    expect(result.matchedKeyword).toBe('хлеб');
  });

  it('routes unknown text with amount into unknown-store clarify flow', () => {
    const result = parseMessage('бла-бла 99', noLearned);
    expect(result.amount).toBe(99);
    expect(result.categoryId).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.storeId).toContain('unknown_');
  });

  it('preserves unknown store display casing while keeping normalized id', () => {
    const result = parseMessage('Кешет 500', noLearned);
    expect(result.storeName).toBe('Кешет');
    expect(result.storeId).toBe('unknown_кешет');
  });

  it('does not expose legacy parentId in ParseResult', () => {
    const result = parseMessage('кофе 65', noLearned);
    expect(result).not.toHaveProperty('parentId');
  });

  it('marks income prefixed input and keeps category unresolved', () => {
    const result = parseMessage('+15000 зарплата', noLearned);
    expect(result.isIncome).toBe(true);
    expect(result.amount).toBe(15000);
    expect(result.categoryId).toBeNull();
    expect(result.confidence).toBe('failed');
  });

  it('prefers item category over ambiguous store category', () => {
    const result = parseMessage('шуферсал хлеб 45', noLearned);
    expect(result.amount).toBe(45);
    expect(result.confidence).toBe('high');
    expect(result.storeId).toBeDefined();
    expect(result.categoryId).toBe('bakery');
  });

  it('keeps ambiguous stores in low-confidence state without item context', () => {
    const result = parseMessage('шуферсал 120', noLearned);
    expect(result.confidence).toBe('low');
    expect(result.categoryId).toBeNull();
    expect(result.storeId).toBe('shufersal');
  });

  it('parses past-date suffixes and keeps the category', () => {
    const result = parseMessage('кофе 65 вчера', noLearned);
    expect(result.amount).toBe(65);
    expect(result.date).toBeDefined();
    expect(result.categoryId).toBe('coffee');
  });

  it('preserves the unknown note for later clarify/save steps', () => {
    const result = parseMessage('бла-бла 99', noLearned);
    expect(result.note).toBeTruthy();
  });
});
