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

vi.mock('@/features/income/services/incomeService', () => ({
  addIncome: vi.fn(),
}));

vi.mock('@/features/chat/services/messagesService', () => ({
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
}));

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
    { id: 'dining',    userId: 'u1', name: 'Кафе',      icon: 'plate',  color: '#D4A574', type: 'expense', isPrivate: false, order: 0 },
    { id: 'coffee',    userId: 'u1', name: 'Кофе',      icon: 'coffee', color: '#D4A574', type: 'expense', isPrivate: false, order: 0, folderId: 'dining' },
    { id: 'groceries', userId: 'u1', name: 'Продукты',  icon: 'cart',   color: '#E07A5F', type: 'expense', isPrivate: false, order: 0 },
  ];
  const map = new Map<string, Category>();
  cats.forEach((c) => map.set(c.id, c));

  const folders: CategoryFolder[] = [
    { id: 'dining', userId: 'u1', name: 'Кафе', icon: 'plate', color: '#D4A574', type: 'expense', order: 0 },
  ];
  const foldersById = new Map<string, CategoryFolder>();
  folders.forEach((f) => foldersById.set(f.id, f));

  const incomeCats: Category[] = [
    { id: 'salary', userId: 'u1', name: 'Зарплата', icon: 'briefcase', color: '#81B29A', type: 'income', isPrivate: false, order: 0 },
  ];
  const incomeMap = new Map<string, Category>();
  incomeCats.forEach((c) => incomeMap.set(c.id, c));

  return {
    userId: 'u1',
    currency: 'ILS',
    language: 'ru',
    categoriesById: map,
    foldersById,
    topCategoryIds: ['dining', 'groceries'],
    incomeCategoriesById: incomeMap,
    topIncomeCategoryIds: ['salary'],
    todaySpent: 0,
    storeProfiles: {},
    suggestionMemory: {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [],
      merchantContextStats: {},
    },
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

// ── Expense flow: merchant/amount/history may rank options, but only an
// explicit user choice saves. Ambiguous purchases stay lightweight in chat.
describe('respondToUserMessage — progressive expense classification', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { addExpense } = await import('@/features/expenses/services/expensesService');
    (addExpense as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'exp-001', userId: 'u1', amount: 65, currency: 'ILS', categoryId: 'coffee',
      date: new Date().toISOString(), paymentMethod: 'card', privacy: 'regular', splits: [], tags: [],
    });
  });

  it('«65 кофе» → компактная clarify-карточка, без автосохранения', async () => {
    const { addExpense } = await import('@/features/expenses/services/expensesService');
    const parsed = parseMessage('65 кофе', { learned: {} });
    const reply = await respondToUserMessage(makeUserMsg('65 кофе'), parsed, makeCtx());
    expect(reply.messages[0].card?.kind).toBe('clarify');
    expect((reply.messages[0].card?.data as { userMsgId: string }).userMsgId).toBe('msg-user-001');
    expect(reply.openSplit).toBeUndefined();
    expect(addExpense).not.toHaveBeenCalled();
  });

  it('«150» → тоже уточнение, потому что сумма не является категорией', async () => {
    const parsed = parseMessage('150', { learned: {} });
    const reply = await respondToUserMessage(makeUserMsg('150'), parsed, makeCtx());
    expect(reply.messages[0].card?.kind).toBe('clarify');
  });

  it('известный супермаркет сохраняется в данных карточки, но не определяет категорию молча', async () => {
    const parsed = {
      amount: 350,
      categoryId: 'groceries',
      confidence: 'high' as const,
      storeId: 'rami_levy',
      storeName: 'Рами Леви',
      storeGroup: 'supermarket',
    };
    const reply = await respondToUserMessage(makeUserMsg('Рами Леви 350'), parsed, makeCtx());
    const data = reply.messages[0].card?.data as Record<string, unknown>;
    expect(data.storeId).toBe('rami_levy');
    expect(data.storeName).toBe('Рами Леви');
    expect(data.storeGroup).toBe('supermarket');
  });

  it('после явного выбора categoryId расход сохраняется и связывается с user message', async () => {
    const { addExpense } = await import('@/features/expenses/services/expensesService');
    const { updateMessage } = await import('@/features/chat/services/messagesService');
    const reply = await respondToUserMessage(makeUserMsg('65 кофе'), {
      amount: 65,
      categoryId: 'coffee',
      confidence: 'high',
      confirmed: true,
    }, makeCtx());
    expect(addExpense).toHaveBeenCalledOnce();
    expect(updateMessage).toHaveBeenCalledWith('u1', 'msg-user-001', { status: 'saved', expenseId: 'exp-001' });
    expect(reply.expense?.id).toBe('exp-001');
    expect(reply.messages[0].card?.kind).toBe('saved');
  });

  it('текст без числа → unknown text (нет карточки, нет openSplit)', async () => {
    const parsed = parseMessage('привет', { learned: {} });
    const reply = await respondToUserMessage(makeUserMsg('привет'), parsed, makeCtx());
    expect(reply.openSplit).toBeUndefined();
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.expense).toBeUndefined();
  });
});

// ── Income flow is intentionally untouched: clarify card still appears
//    when category is unknown, save still happens in chat.
describe('respondToUserMessage — income flow stays clarify-based', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { addIncome } = await import('@/features/income/services/incomeService');
    (addIncome as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'inc-001',
      userId: 'u1',
      amount: 5000,
      categoryId: 'salary',
      currency: 'ILS',
      date: '2026-05-17',
    });
  });

  it('«+5000» без категории → clarify card для дохода', async () => {
    const parsed = {
      amount: 5000,
      categoryId: null,
      confidence: 'failed' as const,
      isIncome: true,
    };
    const reply = await respondToUserMessage(makeUserMsg('+5000'), parsed, makeCtx());
    expect(reply.messages[0].card?.kind).toBe('clarify');
    expect(((reply.messages[0].card?.data) as any).isIncome).toBe(true);
    expect(reply.openSplit).toBeUndefined();
  });

  it('«+5000» с категорией → income сохраняется (без Split)', async () => {
    const parsed = {
      amount: 5000,
      categoryId: 'salary',
      confidence: 'high' as const,
      isIncome: true,
    };
    const reply = await respondToUserMessage(makeUserMsg('+5000 зарплата'), parsed, makeCtx());
    expect(reply.income?.id).toBe('inc-001');
    expect(reply.openSplit).toBeUndefined();
  });
});
