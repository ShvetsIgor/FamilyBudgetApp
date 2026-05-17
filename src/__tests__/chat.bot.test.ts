import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseMessage } from '@/features/chat/parser/parse';
import { respondToUserMessage } from '@/features/chat/bot/respond';
import type { SerializableChatMessage } from '@/shared/types/message';
import type { BotContext } from '@/features/chat/bot/context';
import type { Category } from '@/shared/types';

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
    { id: 'dining',  name: 'Кафе',      icon: 'plate',  color: '#D4A574', parentId: null,   type: 'expense' },
    { id: 'coffee',  name: 'Кофе',      icon: 'coffee', color: '#D4A574', parentId: 'dining', type: 'expense' },
    { id: 'groceries', name: 'Продукты', icon: 'cart',  color: '#E07A5F', parentId: null,   type: 'expense' },
  ];
  const map = new Map<string, Category>();
  cats.forEach((c) => map.set(c.id, c));

  return {
    userId: 'u1',
    currency: 'ILS',
    categoriesById: map,
    topParentIds: ['dining', 'groceries'],
    todaySpent: 0,
    ...overrides,
  };
}

// ── Parser tests (additional) ─────────────────────────────────────────────────

describe('parseMessage — bot flow inputs', () => {
  const noLearned = { learned: {} };

  it('65 кофе → amount=65, parentId=dining, categoryId=coffee', () => {
    const r = parseMessage('65 кофе', noLearned);
    expect(r.amount).toBe(65);
    expect(r.parentId).toBe('dining');
    expect(r.categoryId).toBe('coffee');
    expect(r.confidence).toBe('medium');
  });

  it('кофе 65 → same result (order of number/word is irrelevant)', () => {
    const r = parseMessage('кофе 65', noLearned);
    expect(r.amount).toBe(65);
    expect(r.parentId).toBe('dining');
    expect(r.categoryId).toBe('coffee');
  });

  it('КОФЕ 65 (uppercase) → normalised to match', () => {
    const r = parseMessage('КОФЕ 65', noLearned);
    expect(r.amount).toBe(65);
    expect(r.parentId).toBe('dining');
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
});

// ── respondToUserMessage ──────────────────────────────────────────────────────

describe('respondToUserMessage', () => {
  beforeEach(() => vi.clearAllMocks());

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
    expect(botMsg.card?.data.color).toBe('#D4A574');
  });

  it('«65 кофе» → expense создаётся через addExpense', async () => {
    const { addExpense } = await import('@/features/expenses/services/expensesService');
    const parsed = parseMessage('65 кофе', { learned: {} });
    const userMsg = makeUserMsg('65 кофе');

    await respondToUserMessage(userMsg, parsed, makeCtx());

    expect(addExpense).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', amount: 65, categoryId: 'coffee' })
    );
  });

  it('«65 кофе» → reply.expense содержит сохранённый expense', async () => {
    const parsed = parseMessage('65 кофе', { learned: {} });
    const userMsg = makeUserMsg('65 кофе');

    const reply = await respondToUserMessage(userMsg, parsed, makeCtx());

    expect(reply.expense).toBeDefined();
    expect(reply.expense?.id).toBe('exp-001');
    expect(reply.expense?.amount).toBe(65);
  });

  it('только число «150» → clarify card', async () => {
    const parsed = parseMessage('150', { learned: {} });
    const userMsg = makeUserMsg('150');
    const ctx = makeCtx();

    const reply = await respondToUserMessage(userMsg, parsed, ctx);

    expect(reply.messages).toHaveLength(1);
    expect(reply.messages[0].card?.kind).toBe('clarify');
    expect(reply.messages[0].card?.data.amount).toBe(150);
    expect(reply.expense).toBeUndefined();
  });

  it('«clarify» → chips содержат top-категории из ctx', async () => {
    const parsed = parseMessage('150', { learned: {} });
    const userMsg = makeUserMsg('150');
    const ctx = makeCtx({ topParentIds: ['dining', 'groceries'] });

    const reply = await respondToUserMessage(userMsg, parsed, ctx);

    const chips = reply.messages[0].card?.data.chips as { id: string }[];
    expect(chips.some((c) => c.id === 'dining')).toBe(true);
  });

  it('«бла-бла 99» (нет категории) — с суммой → clarify, не unknown', async () => {
    const parsed = parseMessage('бла-бла 99', { learned: {} });
    expect(parsed.confidence).toBe('failed');
    expect(parsed.amount).toBe(99);

    const reply = await respondToUserMessage(makeUserMsg('бла-бла 99'), parsed, makeCtx());
    expect(reply.messages[0].card?.kind).toBe('clarify');
  });

  it('текст без числа → unknown text (нет карточки)', async () => {
    const parsed = parseMessage('привет', { learned: {} });
    expect(parsed.amount).toBe(0);
    expect(parsed.confidence).toBe('failed');

    const reply = await respondToUserMessage(makeUserMsg('привет'), parsed, makeCtx());
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.messages[0].text).toBeTruthy();
    expect(reply.expense).toBeUndefined();
  });

  it('updateMessage вызывается с expenseId после сохранения', async () => {
    const { updateMessage } = await import('@/features/chat/services/messagesService');
    const parsed = parseMessage('65 кофе', { learned: {} });
    await respondToUserMessage(makeUserMsg('65 кофе'), parsed, makeCtx());
    expect(updateMessage).toHaveBeenCalledWith(
      'u1',
      'msg-user-001',
      expect.objectContaining({ expenseId: 'exp-001', status: 'saved' })
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
