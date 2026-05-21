import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseMessage } from '@/features/chat/parser/parse';
import { respondToUserMessage } from '@/features/chat/bot/respond';
import type { SerializableChatMessage } from '@/shared/types/message';
import type { BotContext } from '@/features/chat/bot/context';
import type { Category, CategoryFolder } from '@/shared/types';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/features/expenses/services/expensesService', () => ({
  addExpense: vi.fn(),
}));

vi.mock('@/features/chat/services/messagesService', () => ({
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
}));

const mockExpense = {
  id: 'exp-001',
  userId: 'u1',
  amount: 65,
  categoryId: 'coffee',
  date: '2026-05-17',
  paymentMethod: 'card',
  tags: [],
  privacy: 'regular',
  currency: 'ILS',
  splits: [],
  createdAt: '2026-05-17T09:14:00.000Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUserMsg(text: string, overrides: Partial<SerializableChatMessage> = {}): SerializableChatMessage {
  return {
    id: 'msg-user-001',
    userId: 'u1',
    senderId: 'u1',
    kind: 'user',
    text,
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCtx(overrides: Partial<BotContext> = {}): BotContext {
  const cats: Category[] = [
    { id: 'dining',    name: 'Кафе',      icon: 'plate',  color: '#D4A574', type: 'expense', isPrivate: false, order: 0 },
    { id: 'coffee',    name: 'Кофе',      icon: 'coffee', color: '#D4A574', type: 'expense', isPrivate: false, order: 0, folderId: 'dining' },
    { id: 'groceries', name: 'Продукты',  icon: 'cart',   color: '#E07A5F', type: 'expense', isPrivate: false, order: 0 },
  ];
  const map = new Map<string, Category>();
  cats.forEach((c) => map.set(c.id, c));

  const folders: CategoryFolder[] = [
    { id: 'dining', userId: 'u1', name: 'Кафе', icon: 'plate', color: '#D4A574', type: 'expense', order: 0 },
  ];
  const foldersById = new Map<string, CategoryFolder>();
  folders.forEach((f) => foldersById.set(f.id, f));

  const incomeCats: Category[] = [
    { id: 'salary', name: 'Зарплата', icon: 'briefcase', color: '#81B29A', type: 'income', isPrivate: false, order: 0 },
  ];
  const incomeMap = new Map<string, Category>();
  incomeCats.forEach((c) => incomeMap.set(c.id, c));

  return {
    userId: 'u1',
    currency: 'ILS',
    categoriesById: map,
    foldersById,
    topCategoryIds: ['dining', 'groceries'],
    incomeCategoriesById: incomeMap,
    topIncomeCategoryIds: ['salary'],
    todaySpent: 0,
    storeProfiles: {},
    ...overrides,
  };
}

// ── Parser tests (additional) ─────────────────────────────────────────────────

describe('parseMessage — bot flow inputs', () => {
  const noLearned = { learned: {} };

  it('65 кофе → amount=65, categoryId=coffee', () => {
    const r = parseMessage('65 кофе', noLearned);
    expect(r.amount).toBe(65);
    expect(r.categoryId).toBe('coffee');
    expect(r.confidence).toBe('medium');
  });

  it('кофе 65 → same result (order of number/word irrelevant)', () => {
    const r = parseMessage('кофе 65', noLearned);
    expect(r.amount).toBe(65);
    expect(r.categoryId).toBe('coffee');
  });

  it('КОФЕ 65 (uppercase) → normalised to match', () => {
    const r = parseMessage('КОФЕ 65', noLearned);
    expect(r.amount).toBe(65);
    expect(r.categoryId).toBe('coffee');
  });

  it('пустая строка → confidence failed, amount 0', () => {
    const r = parseMessage('', noLearned);
    expect(r.amount).toBe(0);
    expect(r.confidence).toBe('failed');
  });

  it('слово без числа → confidence failed, amount 0', () => {
    const r = parseMessage('кофе', noLearned);
    expect(r.amount).toBe(0);
    expect(r.confidence).toBe('failed');
  });

  it('parentId больше не возвращается в ParseResult', () => {
    const r = parseMessage('кофе 65', noLearned);
    expect(r).not.toHaveProperty('parentId');
  });
});

// ── respondToUserMessage ──────────────────────────────────────────────────────

describe('respondToUserMessage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { addExpense } = await import('@/features/expenses/services/expensesService');
    (addExpense as ReturnType<typeof vi.fn>).mockResolvedValue(mockExpense);
    const { updateMessage } = await import('@/features/chat/services/messagesService');
    (updateMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('«65 кофе» → saved-card с правильными данными', async () => {
    const parsed = parseMessage('65 кофе', { learned: {} });
    const userMsg = makeUserMsg('65 кофе');
    const ctx = makeCtx();

    const reply = await respondToUserMessage(userMsg, parsed, ctx);

    expect(reply.messages).toHaveLength(1);
    const botMsg = reply.messages[0];
    expect(botMsg.kind).toBe('bot');
    expect(botMsg.card?.kind).toBe('saved');
    expect(botMsg.card?.data.amount).toBe(65);
  });

  it('«65 кофе» → saved-card использует цвет категории', async () => {
    const parsed = parseMessage('65 кофе', { learned: {} });
    const reply = await respondToUserMessage(makeUserMsg('65 кофе'), parsed, makeCtx());
    expect(reply.messages[0].card?.data.color).toBe('#D4A574');
  });

  it('«65 кофе» → expense создаётся через addExpense', async () => {
    const { addExpense } = await import('@/features/expenses/services/expensesService');
    const parsed = parseMessage('65 кофе', { learned: {} });
    await respondToUserMessage(makeUserMsg('65 кофе'), parsed, makeCtx());
    expect(addExpense).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', amount: 65, categoryId: 'coffee' }),
    );
  });

  it('«65 кофе» → reply.expense содержит сохранённый expense', async () => {
    const parsed = parseMessage('65 кофе', { learned: {} });
    const reply = await respondToUserMessage(makeUserMsg('65 кофе'), parsed, makeCtx());
    expect(reply.expense).toBeDefined();
    expect(reply.expense?.id).toBe('exp-001');
  });

  it('folder name отображается в catPath через foldersById', async () => {
    const parsed = parseMessage('65 кофе', { learned: {} });
    const reply = await respondToUserMessage(makeUserMsg('65 кофе'), parsed, makeCtx());
    // coffee has folderId='dining', folder name='Кафе'
    expect(reply.messages[0].card?.data.groupName).toBe('Кафе');
  });

  it('только число «150» → clarify card', async () => {
    const parsed = parseMessage('150', { learned: {} });
    const reply = await respondToUserMessage(makeUserMsg('150'), parsed, makeCtx());
    expect(reply.messages[0].card?.kind).toBe('clarify');
    expect(reply.messages[0].card?.data.amount).toBe(150);
    expect(reply.expense).toBeUndefined();
  });

  it('«clarify» → chips содержат top-категории из ctx', async () => {
    const parsed = parseMessage('150', { learned: {} });
    const reply = await respondToUserMessage(makeUserMsg('150'), parsed, makeCtx({ topCategoryIds: ['dining', 'groceries'] }));
    const chips = reply.messages[0].card?.data.chips as { id: string }[];
    expect(chips.some((c) => c.id === 'dining')).toBe(true);
  });

  it('«бла-бла 99» → clarify card (есть сумма, нет категории)', async () => {
    const parsed = parseMessage('бла-бла 99', { learned: {} });
    expect(parsed.confidence).toBe('failed');
    const reply = await respondToUserMessage(makeUserMsg('бла-бла 99'), parsed, makeCtx());
    expect(reply.messages[0].card?.kind).toBe('clarify');
  });

  it('текст без числа → unknown text (нет карточки)', async () => {
    const parsed = parseMessage('привет', { learned: {} });
    expect(parsed.amount).toBe(0);
    const reply = await respondToUserMessage(makeUserMsg('привет'), parsed, makeCtx());
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.expense).toBeUndefined();
  });

  it('updateMessage вызывается с expenseId после сохранения', async () => {
    const { updateMessage } = await import('@/features/chat/services/messagesService');
    const parsed = parseMessage('65 кофе', { learned: {} });
    await respondToUserMessage(makeUserMsg('65 кофе'), parsed, makeCtx());
    expect(updateMessage).toHaveBeenCalledWith(
      'u1',
      'msg-user-001',
      expect.objectContaining({ expenseId: 'exp-001', status: 'saved' }),
    );
  });

  it('ошибка addExpense → возвращает bot-msg с текстом об ошибке', async () => {
    const { addExpense } = await import('@/features/expenses/services/expensesService');
    (addExpense as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
    const parsed = parseMessage('65 кофе', { learned: {} });
    const reply = await respondToUserMessage(makeUserMsg('65 кофе'), parsed, makeCtx());
    expect(reply.messages[0].text).toContain('Не удалось');
    expect(reply.expense).toBeUndefined();
  });
});
