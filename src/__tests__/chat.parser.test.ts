import { describe, it, expect } from 'vitest';
import { parseMessage } from '@/features/chat/parser/parse';

const noLearned = { learned: {} };

describe('parseMessage', () => {
  it('хлеб 50 → groceries/supermarket, medium', () => {
    const r = parseMessage('хлеб 50', noLearned);
    expect(r.amount).toBe(50);
    expect(r.parentId).toBe('groceries');
    expect(r.categoryId).toBe('supermarket');
    expect(r.confidence).toBe('medium');
  });

  it('кофе 65 → dining/coffee, medium', () => {
    const r = parseMessage('кофе 65', noLearned);
    expect(r.amount).toBe(65);
    expect(r.parentId).toBe('dining');
    expect(r.categoryId).toBe('coffee');
    expect(r.confidence).toBe('medium');
  });

  it('только число 150 → failed (нет категории)', () => {
    const r = parseMessage('150', noLearned);
    expect(r.amount).toBe(150);
    expect(r.categoryId).toBeNull();
    expect(r.confidence).toBe('failed');
  });

  it('такси 120 → transport/taxi, medium', () => {
    const r = parseMessage('такси 120', noLearned);
    expect(r.amount).toBe(120);
    expect(r.parentId).toBe('transport');
    expect(r.categoryId).toBe('taxi');
  });

  it('☕ 30 → dining/coffee, high (emoji)', () => {
    const r = parseMessage('☕ 30', noLearned);
    expect(r.amount).toBe(30);
    expect(r.parentId).toBe('dining');
    expect(r.categoryId).toBe('coffee');
    expect(r.confidence).toBe('high');
  });

  it('/баланс → slash-command → failed', () => {
    const r = parseMessage('/баланс', noLearned);
    expect(r.amount).toBe(0);
    expect(r.confidence).toBe('failed');
  });

  it('netflix 299 → digital/streaming', () => {
    const r = parseMessage('netflix 299', noLearned);
    expect(r.amount).toBe(299);
    expect(r.parentId).toBe('digital');
    expect(r.categoryId).toBe('streaming');
  });

  it('аренда 5000 → home/rent', () => {
    const r = parseMessage('аренда 5000', noLearned);
    expect(r.amount).toBe(5000);
    expect(r.parentId).toBe('home');
    expect(r.categoryId).toBe('rent');
  });

  it('65 врач → health/doctors', () => {
    const r = parseMessage('65 врач', noLearned);
    expect(r.amount).toBe(65);
    expect(r.parentId).toBe('health');
    expect(r.categoryId).toBe('doctors');
  });

  it('50,5 хлеб → amount 50.5 (запятая как разделитель)', () => {
    const r = parseMessage('50,5 хлеб', noLearned);
    expect(r.amount).toBe(50.5);
    expect(r.parentId).toBe('groceries');
  });

  it('learned keyword приоритетнее built-in → high', () => {
    const ctx = { learned: { 'хлеп': { parentId: 'groceries', subId: 'supermarket' } } };
    const r = parseMessage('хлеп 30', ctx);
    expect(r.amount).toBe(30);
    expect(r.parentId).toBe('groceries');
    expect(r.confidence).toBe('high');
    expect(r.matchedKeyword).toBe('хлеп');
  });

  it('неизвестное слово → failed', () => {
    const r = parseMessage('бла-бла 99', noLearned);
    expect(r.amount).toBe(99);
    expect(r.categoryId).toBeNull();
    expect(r.confidence).toBe('failed');
  });
});
