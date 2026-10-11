/**
 * Choosing a category teaches the chat the message's word, and that word
 * then RANKS the choice next time — it never saves anything by itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ writes: [] as { path: string; data: unknown }[] }));
vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  collection: (_db: unknown, ...parts: string[]) => parts.join('/'),
  setDoc: vi.fn(async (path: string, data: unknown) => { fs.writes.push({ path, data }); }),
  getDocs: vi.fn(async () => ({ docs: [{ id: 'старое', data: () => ({ categoryId: 'old' }) }] })),
  deleteDoc: vi.fn(), serverTimestamp: () => '<ts>',
}));
vi.mock('@/features/expenses/services/expensesService', () => ({ addExpense: vi.fn() }));
vi.mock('@/features/income/services/incomeService', () => ({ addIncome: vi.fn() }));
vi.mock('@/features/chat/services/messagesService', () => ({ addMessage: vi.fn(), updateMessage: vi.fn() }));

import { extractLearnableKeyword, matchLearnedKeyword } from '@/features/chat/parser/keywordLearning';
import { cachedLearnedKeywords, fetchLearnedKeywords, learnKeyword, subscribeLearnedKeywords } from '@/features/chat/parser/learning';
import { respondToUserMessage } from '@/features/chat/bot/respond';
import type { BotContext } from '@/features/chat/bot/context';
import type { Category } from '@/shared/types';

beforeEach(() => { fs.writes = []; });

describe('extractLearnableKeyword', () => {
  it.each([
    ['Шмулик 50', 'шмулик'],
    ['50 шмулик', 'шмулик'],
    ['вчера Шмулику 50 шекелей', 'шмулику'],
    ['кофе на вокзале 20₪', 'кофе вокзале'],
    ['Pilates 120 ILS yesterday', 'pilates'],
    ['Ёлка 300', 'елка'],
  ])('%s → %s', (text, keyword) => {
    expect(extractLearnableKeyword(text)).toBe(keyword);
  });

  it.each([
    ['50'], ['вчера 50 долларов'], ['купил подарок маме на день рождения 300'], ['x 5'],
  ])('learns nothing from «%s»', (text) => {
    expect(extractLearnableKeyword(text)).toBeNull();
  });
});

describe('matchLearnedKeyword', () => {
  const learned = { 'кофе': { categoryId: 'coffee' }, 'кофе вокзале': { categoryId: 'travel' }, 'ко': { categoryId: 'x' } };
  it('matches whole words, preferring the longest phrase', () => {
    expect(matchLearnedKeyword('кофе на вокзале 20', learned)).toMatchObject({ categoryId: 'travel', keyword: 'кофе вокзале' });
    expect(matchLearnedKeyword('Кофе 15', learned)).toMatchObject({ categoryId: 'coffee' });
    expect(matchLearnedKeyword('кофеварка 400', learned)).toBeNull();
  });
});

describe('learnKeyword', () => {
  it('stores the latest choice and updates the session cache for listeners', async () => {
    await fetchLearnedKeywords('u1');
    const heard: string[] = [];
    const stop = subscribeLearnedKeywords((uid) => heard.push(uid));
    await learnKeyword('u1', 'шмулик', 'nanny');
    stop();
    expect(fs.writes).toEqual([{ path: 'users/u1/learnedKeywords/шмулик', data: { categoryId: 'nanny', updatedAt: '<ts>' } }]);
    expect(cachedLearnedKeywords('u1')).toEqual({ 'старое': { categoryId: 'old' }, 'шмулик': { categoryId: 'nanny' } });
    expect(heard).toEqual(['u1']);
  });
});

describe('clarify card', () => {
  const cats: Category[] = [
    { id: 'food', userId: 'u1', name: 'Еда', icon: 'cart', color: '#111', type: 'expense', isPrivate: false, order: 0 },
    { id: 'nanny', userId: 'u1', name: 'Няня', icon: 'teddy', color: '#222', type: 'expense', isPrivate: false, order: 1 },
  ];
  const ctx = {
    userId: 'u1', currency: 'ILS', language: 'ru', categoriesById: new Map(cats.map((c) => [c.id, c])),
    foldersById: new Map(), topCategoryIds: [], incomeCategoriesById: new Map(), topIncomeCategoryIds: [], todaySpent: 0,
    suggestionMemory: { merchants: {}, recents: [], splitCombos: [], tagAssociations: [], merchantContextStats: {} },
  } as unknown as BotContext;
  const msg = { id: 'm', userId: 'u1', senderId: 'u1', kind: 'user' as const, text: 'Шмулик 50', status: 'pending' as const, createdAt: '' };

  it('puts the taught category first and does not promise to learn again', async () => {
    const reply = await respondToUserMessage(msg, { amount: 50, categoryId: 'food', learnedCategoryId: 'nanny', confidence: 'high' }, ctx);
    const data = reply.messages[0].card?.data as { chips: { id: string }[]; rememberWord?: string };
    expect(data.chips.map((c) => c.id)).toEqual(['nanny', 'food']);
    expect(data.rememberWord).toBeUndefined();
    expect(reply.expense).toBeUndefined();
  });

  it('says which word choosing will teach', async () => {
    const reply = await respondToUserMessage(msg, { amount: 50, categoryId: 'food', confidence: 'high' }, ctx);
    expect((reply.messages[0].card?.data as { rememberWord?: string }).rememberWord).toBe('шмулик');
  });
});
