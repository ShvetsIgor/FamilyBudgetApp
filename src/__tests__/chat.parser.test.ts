import { describe, it, expect } from 'vitest';
import { parseMessage } from '@/features/chat/parser/parse';

const noLearned = { learned: {} };

describe('parseMessage', () => {
  it('хлеб 50 → categoryId=bakery, medium', () => {
    const r = parseMessage('хлеб 50', noLearned);
    expect(r.amount).toBe(50);
    expect(r.categoryId).toBe('bakery');
    expect(r.confidence).toBe('medium');
  });

  it('кофе 65 → categoryId=coffee, medium', () => {
    const r = parseMessage('кофе 65', noLearned);
    expect(r.amount).toBe(65);
    expect(r.categoryId).toBe('coffee');
    expect(r.confidence).toBe('medium');
  });

  it('только число 150 → failed (нет категории)', () => {
    const r = parseMessage('150', noLearned);
    expect(r.amount).toBe(150);
    expect(r.categoryId).toBeNull();
    expect(r.confidence).toBe('failed');
  });

  it('такси 120 → categoryId=taxi, medium', () => {
    const r = parseMessage('такси 120', noLearned);
    expect(r.amount).toBe(120);
    expect(r.categoryId).toBe('taxi');
    expect(r.confidence).toBe('medium');
  });

  it('☕ 30 → categoryId=coffee, high (emoji)', () => {
    const r = parseMessage('☕ 30', noLearned);
    expect(r.amount).toBe(30);
    expect(r.categoryId).toBe('coffee');
    expect(r.confidence).toBe('high');
  });

  it('/баланс → slash-command → failed', () => {
    const r = parseMessage('/баланс', noLearned);
    expect(r.amount).toBe(0);
    expect(r.confidence).toBe('failed');
  });

  it('netflix 299 → categoryId=streaming, high (self-describing store)', () => {
    const r = parseMessage('netflix 299', noLearned);
    expect(r.amount).toBe(299);
    expect(r.categoryId).toBe('streaming');
    expect(r.confidence).toBe('high');
  });

  it('аренда 5000 → categoryId=rent, medium', () => {
    const r = parseMessage('аренда 5000', noLearned);
    expect(r.amount).toBe(5000);
    expect(r.categoryId).toBe('rent');
    expect(r.confidence).toBe('medium');
  });

  it('65 врач → categoryId=doctors, medium', () => {
    const r = parseMessage('65 врач', noLearned);
    expect(r.amount).toBe(65);
    expect(r.categoryId).toBe('doctors');
    expect(r.confidence).toBe('medium');
  });

  it('50,5 хлеб → amount 50.5 (запятая как разделитель)', () => {
    const r = parseMessage('50,5 хлеб', noLearned);
    expect(r.amount).toBe(50.5);
    expect(r.categoryId).toBe('bakery');
  });

  it('learned keyword совпадает → confidence low, learnedCategoryId передаётся', () => {
    const ctx = { learned: { 'хлеп': { categoryId: 'supermarket' } } };
    const r = parseMessage('хлеп 30', ctx);
    expect(r.amount).toBe(30);
    expect(r.confidence).toBe('low');
    expect(r.learnedCategoryId).toBe('supermarket');
    expect(r.matchedKeyword).toBe('хлеп');
  });

  it('неизвестное слово → failed', () => {
    const r = parseMessage('бла-бла 99', noLearned);
    expect(r.amount).toBe(99);
    expect(r.categoryId).toBeNull();
    expect(r.confidence).toBe('failed');
  });

  it('ParseResult не содержит parentId', () => {
    const r = parseMessage('кофе 65', noLearned);
    expect(r).not.toHaveProperty('parentId');
  });

  it('+15000 зарплата → isIncome=true, amount=15000', () => {
    const r = parseMessage('+15000 зарплата', noLearned);
    expect(r.isIncome).toBe(true);
    expect(r.amount).toBe(15000);
    expect(r.categoryId).toBeNull();
    expect(r.confidence).toBe('failed');
  });

  it('стор + айтем → high confidence, categoryId от item (более специфичен)', () => {
    // шуферсал (известный магазин, needsContext=true) + хлеб (items dict)
    const r = parseMessage('шуферсал хлеб 45', noLearned);
    expect(r.amount).toBe(45);
    expect(r.confidence).toBe('high');
    expect(r.storeId).toBeDefined();
    expect(r.categoryId).toBe('bakery');
  });

  it('шуферсал без айтема → low (needsContext=true)', () => {
    const r = parseMessage('шуферсал 120', noLearned);
    expect(r.confidence).toBe('low');
    expect(r.categoryId).toBeNull();
    expect(r.storeId).toBe('shufersal');
  });

  it('дата в прошлом парсится корректно', () => {
    const r = parseMessage('кофе 65 вчера', noLearned);
    expect(r.amount).toBe(65);
    expect(r.date).toBeDefined();
    expect(r.categoryId).toBe('coffee');
  });

  it('note содержит нераспознанное слово', () => {
    const r = parseMessage('бла-бла 99', noLearned);
    expect(r.note).toBeTruthy();
  });
});
