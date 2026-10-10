/**
 * The chat's first-expense orchestration, with every dependency injected:
 * a zero-category account gets setup without an AI call, the card is marked
 * resolved BEFORE the original message is finished (exactly once), a second
 * tap is ignored, activation always starts from Firestore, a server-side
 * «no categories» turns into a card, an account switch stops every write, and
 * the day the message was written travels with it.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Category, CategoryFolder } from '@/shared/types';
import type { ParseResult, SerializableChatMessage, StarterCardData } from '@/shared/types/message';

vi.mock('@/shared/lib/firebase', () => ({ getFirebaseAuth: () => ({ currentUser: null }), getDb: () => ({}) }));

import { createStarterFlow, type StarterFlowDeps } from '@/features/chat/services/starterFlow';
import type { ChatParseOutcome } from '@/features/chat/services/parseChatMessage';
import type { StarterActivation } from '@/features/categories/services/starterCategories';

const parsed: ParseResult = { amount: 20, currency: 'ILS', categoryId: 'coffee', confidence: 'high', needsConfirmation: true };

function cat(id: string, fields: Partial<Category> = {}): Category {
  return { id, userId: 'alice', name: id, icon: 'box', color: '#000', isPrivate: false, order: 0, type: 'expense', ...fields };
}
const folder = (id: string): CategoryFolder => ({ id, userId: 'alice', name: id, type: 'expense', order: 0 });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function harness({ categories = [] as Category[], outcome = { kind: 'parsed', parsed } as ChatParseOutcome } = {}) {
  const session = { uid: 'alice' as string | undefined };
  let held = false;
  let nextId = 0;
  const log: string[] = [];
  const freshCategories = [cat('mine', { name: 'Mine', archived: true })];
  const freshFolders = [folder('f1')];
  const activation: StarterActivation = {
    folders: [folder('food')], created: [cat('groceries')], restored: [cat('mine', { name: 'Mine' })],
    adopted: { folders: [folder('dining')], categories: [cat('coffee', { name: 'My coffee' })] },
    activeIds: ['groceries', 'mine', 'coffee'],
  };
  const deps = {
    currentUserId: () => session.uid,
    lock: {
      acquire: vi.fn(() => { if (held) return false; held = true; return true; }),
      release: vi.fn(() => { held = false; }),
    },
    setTyping: vi.fn(),
    addMessage: vi.fn(async (input: Parameters<StarterFlowDeps['addMessage']>[0]) => {
      log.push(`add:${input.kind}:${input.card?.kind ?? 'text'}`);
      return { ...input, id: `m${nextId++}`, createdAt: '2026-10-10T08:00:00.000Z' } as SerializableChatMessage;
    }),
    updateMessage: vi.fn(async (_uid: string, id: string, updates: Record<string, unknown>) => {
      log.push(`update:${id}:${Object.keys(updates).join(',')}`);
    }),
    parse: vi.fn(async (_text: string, _uid: string, _referenceDate?: string) => { log.push('parse'); return outcome; }),
    reply: vi.fn(async () => { log.push('reply'); }),
    expenseCategories: () => categories,
    messages: () => [] as SerializableChatMessage[],
    fetchCategories: vi.fn(async () => { log.push('fetchCategories'); return freshCategories; }),
    fetchFolders: vi.fn(async () => { log.push('fetchFolders'); return freshFolders; }),
    activateStarterCategories: vi.fn(async () => { log.push('activate'); return activation; }),
    dispatch: vi.fn((action: { type: string }) => { log.push(`dispatch:${action.type}`); }),
    language: 'en' as const,
    botText: 'Pick categories first',
    failureText: 'Could not save',
    today: () => '2026-10-10',
  };
  const flow = createStarterFlow(deps as unknown as StarterFlowDeps);
  return { deps, flow, log, session, freshCategories, freshFolders, isHeld: () => held };
}

const card: StarterCardData = { pendingText: 'вчера кофе 20', userMsgId: 'u-msg', writtenOn: '2026-10-08' };

describe('send on a zero-category account', () => {
  it('saves the message as clarifying and posts the starter card without any parse/API call', async () => {
    const h = harness({ categories: [cat('savings', { name: 'Savings' }), cat('old', { archived: true })] });
    await h.flow.sendExpense('alice', 'coffee 20');

    expect(h.deps.parse).not.toHaveBeenCalled();
    expect(h.deps.addMessage).toHaveBeenCalledTimes(2);
    expect(h.deps.addMessage.mock.calls[0][0]).toMatchObject({
      userId: 'alice', senderId: 'alice', kind: 'user', text: 'coffee 20', status: 'clarifying',
    });
    expect(h.deps.addMessage.mock.calls[1][0]).toEqual({
      userId: 'alice', senderId: 'bot', kind: 'bot', status: 'clarifying', text: 'Pick categories first',
      card: { kind: 'starter', data: { pendingText: 'coffee 20', userMsgId: 'm0', writtenOn: '2026-10-10' } },
    });
  });

  it('parses normally once a real category exists, and leaves «+» income alone', async () => {
    const h = harness({ categories: [cat('coffee')] });
    await h.flow.sendExpense('alice', 'coffee 20');
    expect(h.deps.addMessage.mock.calls[0][0]).toMatchObject({ status: 'pending' });
    expect(h.deps.parse).toHaveBeenCalledWith('coffee 20', 'alice', undefined);
    expect(h.deps.reply).toHaveBeenCalledTimes(1);

    const income = harness();
    await income.flow.sendExpense('alice', '+100 salary');
    expect(income.deps.parse).toHaveBeenCalledTimes(1);
    expect(income.log).not.toContain('add:bot:starter');
  });
});

describe('finishing a starter card', () => {
  it('persists «resolved» BEFORE the continuation, which runs exactly once', async () => {
    const h = harness();
    await h.flow.activate('bot-1', card, ['groceries', 'coffee']);

    const resolvedAt = h.log.indexOf('update:bot-1:card');
    expect(resolvedAt).toBeGreaterThan(h.log.indexOf('activate'));
    expect(h.log.indexOf('parse')).toBeGreaterThan(resolvedAt);
    expect(h.log.filter((entry) => entry === 'parse')).toHaveLength(1);
    expect(h.deps.reply).toHaveBeenCalledTimes(1);
    expect(h.deps.updateMessage).toHaveBeenCalledWith('alice', 'bot-1', {
      card: { kind: 'starter', data: { ...card, resolved: { count: 3 } } },
    });
    // The ORIGINAL message is finished, with its text from the card
    expect(h.deps.reply.mock.calls[0]).toEqual(['alice', expect.objectContaining({ id: 'u-msg', text: 'вчера кофе 20' }), parsed]);
    expect(h.deps.setTyping.mock.calls).toEqual([[true], [false]]);
    expect(h.isHeld()).toBe(false);
  });

  it('ignores a second tap while the first is in flight', async () => {
    const h = harness();
    const gate = deferred<Category[]>();
    h.deps.fetchCategories.mockImplementationOnce(() => gate.promise);
    const first = h.flow.activate('bot-1', card, ['groceries']);
    await h.flow.activate('bot-1', card, ['groceries']);
    await h.flow.continueWithExisting('bot-1', card);
    gate.resolve(h.freshCategories);
    await first;

    expect(h.deps.fetchCategories).toHaveBeenCalledTimes(1);
    expect(h.deps.activateStarterCategories).toHaveBeenCalledTimes(1);
    expect(h.deps.parse).toHaveBeenCalledTimes(1);
    expect(h.deps.updateMessage).toHaveBeenCalledTimes(1);
  });

  it('ignores a tap while another chat operation (a send) holds the lock', async () => {
    const h = harness();
    h.deps.lock.acquire();
    await h.flow.activate('bot-1', card, ['groceries']);
    expect(h.deps.fetchCategories).not.toHaveBeenCalled();
    expect(h.deps.lock.release).not.toHaveBeenCalled();
  });

  it('always re-reads categories and folders from Firestore and activates against those', async () => {
    const h = harness({ categories: [cat('stale-redux-only')] });
    await h.flow.activate('bot-1', card, ['groceries']); // not a fromServer card

    expect(h.log.slice(0, 2).sort()).toEqual(['fetchCategories', 'fetchFolders']);
    expect(h.log.indexOf('dispatch:categories/setCategories')).toBeLessThan(h.log.indexOf('activate'));
    expect(h.log.indexOf('dispatch:categories/setFolders')).toBeLessThan(h.log.indexOf('activate'));
    expect(h.deps.fetchCategories).toHaveBeenCalledWith('alice', 'expense');
    expect(h.deps.fetchFolders).toHaveBeenCalledWith('alice', 'expense');
    expect(h.deps.activateStarterCategories).toHaveBeenCalledWith({
      userId: 'alice', blueprintIds: ['groceries'], language: 'en', categories: h.freshCategories, folders: h.freshFolders,
    });
    const actions = h.deps.dispatch.mock.calls.map(([action]) => action as { type: string; payload: unknown });
    expect(actions.filter((a) => a.type === 'categories/addFolder').map((a) => (a.payload as CategoryFolder).id))
      .toEqual(['dining', 'food']);
    expect(actions.filter((a) => a.type === 'categories/addCategory').map((a) => (a.payload as Category).id))
      .toEqual(['coffee', 'groceries']);
    expect(actions.filter((a) => a.type === 'categories/updateCategory').map((a) => (a.payload as Category).id))
      .toEqual(['mine']);
  });

  it('sends the day the message was written as the reference date; old cards send none', async () => {
    const h = harness();
    await h.flow.continueWithExisting('bot-1', card);
    expect(h.deps.parse).toHaveBeenCalledWith('вчера кофе 20', 'alice', '2026-10-08');

    const old = harness();
    await old.flow.continueWithExisting('bot-1', { pendingText: 'кофе 20', userMsgId: 'u-msg' });
    expect(old.deps.parse).toHaveBeenCalledWith('кофе 20', 'alice', undefined);
  });

  it('reports a failed setup, writes nothing else and frees the lock', async () => {
    const h = harness();
    h.deps.activateStarterCategories.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await h.flow.activate('bot-1', card, ['groceries']);
    expect(h.deps.updateMessage).not.toHaveBeenCalled();
    expect(h.deps.parse).not.toHaveBeenCalled();
    expect(h.deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ userId: 'alice', text: 'Could not save' }));
    expect(h.isHeld()).toBe(false);
  });
});

describe('server says the account has no categories', () => {
  it('posts a starter card instead of a text reply, keeping the original day', async () => {
    const h = harness({ categories: [cat('coffee')], outcome: { kind: 'needs_categories' } });
    const userMsg = { id: 'u-msg', userId: 'alice', senderId: 'alice', kind: 'user', text: 'кофе 20',
      status: 'pending', createdAt: '2026-10-10T08:00:00.000Z' } as SerializableChatMessage;
    await h.flow.continueMessage('alice', userMsg, '2026-10-08');

    expect(h.deps.updateMessage).toHaveBeenCalledWith('alice', 'u-msg', { status: 'clarifying' });
    expect(h.deps.addMessage).toHaveBeenCalledTimes(1);
    expect(h.deps.addMessage.mock.calls[0][0]).toMatchObject({
      kind: 'bot', status: 'clarifying', text: 'Pick categories first',
      card: { kind: 'starter', data: { pendingText: 'кофе 20', userMsgId: 'u-msg', fromServer: true, writtenOn: '2026-10-08' } },
    });
    expect(h.deps.reply).not.toHaveBeenCalled();

    const fresh = harness({ categories: [cat('coffee')], outcome: { kind: 'needs_categories' } });
    await fresh.flow.sendExpense('alice', 'кофе 20');
    expect(fresh.deps.addMessage.mock.calls[1][0].card?.data).toMatchObject({ fromServer: true, writtenOn: '2026-10-10' });
  });

  it('keeps an ordinary clarification as text', async () => {
    const h = harness({ categories: [cat('coffee')], outcome: { kind: 'clarification', message: 'Which currency?' } });
    await h.flow.sendExpense('alice', 'coffee 20');
    expect(h.deps.addMessage.mock.calls[1][0]).toMatchObject({ kind: 'bot', text: 'Which currency?' });
    expect(h.deps.addMessage.mock.calls[1][0].card).toBeUndefined();
  });
});

describe('account switch mid-flow', () => {
  it('stops after the re-read: no activation and no chat writes for the new account', async () => {
    const h = harness();
    h.deps.fetchCategories.mockImplementationOnce(async () => { h.session.uid = 'bob'; return h.freshCategories; });
    await h.flow.activate('bot-1', card, ['groceries']);

    expect(h.deps.activateStarterCategories).not.toHaveBeenCalled();
    expect(h.deps.dispatch).not.toHaveBeenCalled();
    expect(h.deps.updateMessage).not.toHaveBeenCalled();
    expect(h.deps.addMessage).not.toHaveBeenCalled();
    expect(h.deps.parse).not.toHaveBeenCalled();
    expect(h.deps.setTyping).toHaveBeenCalledTimes(1); // only the «on» for alice
    expect(h.isHeld()).toBe(false);
  });

  it('stops after activation: the card is not resolved and the message not finished', async () => {
    const h = harness();
    h.deps.activateStarterCategories.mockImplementationOnce(async () => {
      h.session.uid = 'bob';
      return { folders: [], created: [], restored: [], adopted: { folders: [], categories: [] }, activeIds: [] };
    });
    await h.flow.activate('bot-1', card, ['groceries']);
    expect(h.deps.updateMessage).not.toHaveBeenCalled();
    expect(h.deps.parse).not.toHaveBeenCalled();
    expect(h.deps.addMessage).not.toHaveBeenCalled();
  });

  it('drops a parse that returns after the switch', async () => {
    const h = harness();
    h.deps.parse.mockImplementationOnce(async () => { h.session.uid = 'bob'; return { kind: 'needs_categories' }; });
    await h.flow.continueWithExisting('bot-1', card);
    expect(h.deps.updateMessage).toHaveBeenCalledTimes(1); // alice's «resolved», before the switch
    expect(h.deps.reply).not.toHaveBeenCalled();
    expect(h.deps.addMessage).not.toHaveBeenCalled();
  });

  it('does not post the starter card when the switch happens while saving the message', async () => {
    const h = harness();
    h.deps.addMessage.mockImplementationOnce(async (input) => {
      h.session.uid = 'bob';
      return { ...input, id: 'm0', createdAt: '2026-10-10T08:00:00.000Z' } as SerializableChatMessage;
    });
    await h.flow.sendExpense('alice', 'coffee 20');
    expect(h.deps.addMessage).toHaveBeenCalledTimes(1);
  });
});
