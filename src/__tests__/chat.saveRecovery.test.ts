/**
 * A rejected chat save is not proof that nothing was saved. The chat must say
 * «not confirmed», keep what is needed to retry the SAME operation, and after
 * a reload either finish a committed save or offer the retry — never claim
 * success or failure it has not checked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ receipt: false }));

vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  getDoc: vi.fn(async () => ({ exists: () => m.receipt })),
}));
vi.mock('@/features/expenses/services/expensesService', () => ({ addExpense: vi.fn() }));
vi.mock('@/features/income/services/incomeService', () => ({ addIncome: vi.fn() }));
vi.mock('@/features/chat/services/messagesService', () => ({ addMessage: vi.fn(), updateMessage: vi.fn() }));

import { getDoc } from 'firebase/firestore';
import { addExpense } from '@/features/expenses/services/expensesService';
import { addIncome } from '@/features/income/services/incomeService';
import { updateMessage } from '@/features/chat/services/messagesService';
import { respondToUserMessage } from '@/features/chat/bot/respond';
import {
  CHAT_STALL_MS, chatOperationId, chatRecoveryAction, isChatOperationCommitted,
} from '@/features/chat/services/chatSaveRecovery';
import type { BotContext } from '@/features/chat/bot/context';
import type { Category } from '@/shared/types';
import type { SerializableChatMessage } from '@/shared/types/message';

const NOW = Date.parse('2026-10-11T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function userMsg(overrides: Partial<SerializableChatMessage> = {}): SerializableChatMessage {
  return {
    id: 'u-msg', userId: 'u1', senderId: 'u1', kind: 'user', text: 'кофе 20',
    status: 'pending', createdAt: ago(5_000), ...overrides,
  };
}

function ctx(): BotContext {
  const cats: Category[] = [
    { id: 'coffee', userId: 'u1', name: 'Кофе', icon: 'coffee', color: '#111111', type: 'expense', isPrivate: false, order: 0 },
    { id: 'groceries', userId: 'u1', name: 'Продукты', icon: 'cart', color: '#222222', type: 'expense', isPrivate: false, order: 1 },
  ];
  const salary: Category = { id: 'salary', userId: 'u1', name: 'Зарплата', icon: 'briefcase', color: '#333333', type: 'income', isPrivate: false, order: 0 };
  return {
    userId: 'u1', currency: 'ILS', language: 'ru',
    categoriesById: new Map(cats.map((c) => [c.id, c])), foldersById: new Map(),
    topCategoryIds: [], incomeCategoriesById: new Map([[salary.id, salary]]), topIncomeCategoryIds: [],
    todaySpent: 0,
    suggestionMemory: { merchants: {}, recents: [], splitCombos: [], tagAssociations: [], merchantContextStats: {} },
  } as BotContext;
}

beforeEach(() => { vi.clearAllMocks(); m.receipt = false; });

describe('chatRecoveryAction', () => {
  it('leaves fresh and finished messages alone', () => {
    expect(chatRecoveryAction(userMsg(), NOW, false)).toBe('none');
    expect(chatRecoveryAction(userMsg({ status: 'saved', createdAt: ago(10 * CHAT_STALL_MS) }), NOW, false)).toBe('none');
    expect(chatRecoveryAction(userMsg({ status: 'clarifying', createdAt: ago(10 * CHAT_STALL_MS) }), NOW, false)).toBe('none');
    expect(chatRecoveryAction({ ...userMsg({ status: 'failed' }), kind: 'bot' }, NOW, false)).toBe('none');
  });

  it('never interrupts work this session is still doing', () => {
    expect(chatRecoveryAction(userMsg({ status: 'failed', saveAttempt: { categoryId: 'coffee', startedAt: ago(1) } }), NOW, true)).toBe('none');
    expect(chatRecoveryAction(userMsg({ createdAt: ago(2 * CHAT_STALL_MS) }), NOW, true)).toBe('none');
  });

  it('offers a parse retry for a message that never got a reply', () => {
    expect(chatRecoveryAction(userMsg({ createdAt: ago(CHAT_STALL_MS + 1) }), NOW, false)).toBe('retry_parse');
    expect(chatRecoveryAction(userMsg({ status: 'failed' }), NOW, false)).toBe('retry_parse');
  });

  it('retries a failed save with its stored category', () => {
    expect(chatRecoveryAction(userMsg({
      status: 'failed', saveAttempt: { categoryId: 'coffee', startedAt: ago(1_000) },
    }), NOW, false)).toBe('retry_save');
  });

  it('checks the receipt only once an in-flight save is abandoned', () => {
    const saving = (startedAt: string) => userMsg({ status: 'saving', saveAttempt: { categoryId: 'coffee', startedAt } });
    expect(chatRecoveryAction(saving(ago(5_000)), NOW, false)).toBe('none');
    expect(chatRecoveryAction(saving(ago(CHAT_STALL_MS + 1)), NOW, false)).toBe('check_save');
  });
});

describe('isChatOperationCommitted', () => {
  it('reads the chat receipt under the message operation id', async () => {
    m.receipt = true;
    await expect(isChatOperationCommitted('u1', 'u-msg')).resolves.toBe(true);
    expect(getDoc).toHaveBeenCalledWith('users/u1/entryOperations/chat-u-msg');
    m.receipt = false;
    await expect(isChatOperationCommitted('u1', 'u-msg')).resolves.toBe(false);
    expect(chatOperationId('x')).toBe('chat-x');
  });
});

describe('respondToUserMessage save failures', () => {
  const confirmed = { amount: 20, categoryId: 'coffee', confidence: 'high' as const, confirmed: true };

  it('reports an unconfirmed expense save instead of a plain failure', async () => {
    vi.mocked(addExpense).mockRejectedValueOnce(Object.assign(new Error('deadline'), { code: 'deadline-exceeded' }));
    const reply = await respondToUserMessage(userMsg(), confirmed, ctx());
    expect(reply.saveFailed).toBe(true);
    expect(reply.expense).toBeUndefined();
    expect(reply.messages[0].text).toContain('подтвердить');
    expect(vi.mocked(addExpense).mock.calls[0][0].operationId).toBe('chat-u-msg');
    expect(updateMessage).not.toHaveBeenCalledWith('u1', 'u-msg', expect.objectContaining({ status: 'saved' }));
  });

  it('does not recreate an entry the user deleted after it was saved', async () => {
    vi.mocked(addExpense).mockRejectedValueOnce(new Error('entry-already-deleted'));
    const reply = await respondToUserMessage(userMsg(), confirmed, ctx());
    expect(reply.alreadyDeleted).toBe(true);
    expect(reply.saveFailed).toBeUndefined();
  });

  it('marks a failed income save too', async () => {
    vi.mocked(addIncome).mockRejectedValueOnce(new Error('unavailable'));
    const reply = await respondToUserMessage(userMsg({ text: '+500' }),
      { amount: 500, categoryId: 'salary', confidence: 'high', isIncome: true }, ctx());
    expect(reply.saveFailed).toBe(true);
  });

  it('shows the category the first attempt really saved under', async () => {
    // The first tap committed «Продукты»; the retry tapped «Кофе» and got the receipt's entry back
    vi.mocked(addExpense).mockResolvedValueOnce({ id: 'e1', categoryId: 'groceries', amount: 20 } as never);
    const reply = await respondToUserMessage(userMsg(), confirmed, ctx());
    const card = reply.messages[0].card?.data as { catName: string; icon: string };
    expect(card.catName).toBe('Продукты');
    expect(card.icon).toBe('cart');
  });
});
