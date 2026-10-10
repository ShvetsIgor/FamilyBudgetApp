import type { UnknownAction } from '@reduxjs/toolkit';
import type { Category, CategoryFolder, CategoryType, Language } from '@/shared/types';
import type { ParseResult, SerializableChatMessage, StarterCardData } from '@/shared/types/message';
import type { addMessage as addMessageFn, updateMessage as updateMessageFn } from './messagesService';
import type {
  activateStarterCategories as activateFn,
} from '@/features/categories/services/starterCategories';
import { needsStarterCategories } from '@/features/categories/services/starterCategories';
import {
  addCategory,
  addFolder,
  setCategories,
  setFolders,
  updateCategory,
} from '@/features/categories/store/categoriesSlice';
import { starterContinuationMessage } from '@/features/chat/components/BotCard/starterCardData';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import { ChatSessionChangedError, type ChatParseOutcome } from './parseChatMessage';

/**
 * Everything the first-expense setup needs from the page, injected so the
 * ordering (persist «resolved» before continuing), the one-operation-at-a-time
 * guard and the account-switch checks can be tested without rendering it.
 */
export interface StarterFlowDeps {
  /** The account signed in right now. A flow stops as soon as it changes. */
  currentUserId(): string | undefined;
  /** Shared with every other chat write, so two taps cannot run twice. */
  lock: { acquire(): boolean; release(): void };
  setTyping(on: boolean): void;
  addMessage: typeof addMessageFn;
  updateMessage: typeof updateMessageFn;
  parse(text: string, uid: string, referenceDate?: string): Promise<ChatParseOutcome>;
  /** The normal reply to a parsed message: saved card, clarify chips, Split. */
  reply(uid: string, userMsg: SerializableChatMessage, parsed: ParseResult): Promise<void>;
  expenseCategories(): readonly Category[];
  messages(): readonly SerializableChatMessage[];
  fetchCategories(uid: string, type: CategoryType): Promise<Category[]>;
  fetchFolders(uid: string, type: CategoryType): Promise<CategoryFolder[]>;
  activateStarterCategories: typeof activateFn;
  dispatch(action: UnknownAction): unknown;
  language: Language;
  botText: string;
  failureText: string;
  /** Local YYYY-MM-DD; injectable for tests. */
  today?(): string;
}

export function createStarterFlow(deps: StarterFlowDeps) {
  const isCurrent = (uid: string) => deps.currentUserId() === uid;
  const today = deps.today ?? (() => toLocalDateKey(new Date()));

  // The pending text lives in the persisted card, so setup can finish the
  // original message after a reload without the user retyping it.
  const postCard = (uid: string, card: StarterCardData) => deps.addMessage({
    userId: uid, senderId: 'bot', kind: 'bot', status: 'clarifying',
    text: deps.botText, card: { kind: 'starter', data: card },
  });

  /**
   * Parse → reply for a user message that is already in the chat. Callers own
   * the lock, the typing dots and the failure path. `referenceDate` is the day
   * the message was originally written, so «yesterday» keeps its meaning when
   * the message is finished later.
   */
  async function continueMessage(uid: string, userMsg: SerializableChatMessage, referenceDate?: string) {
    const outcome = await deps.parse(userMsg.text, uid, referenceDate);
    if (!isCurrent(uid)) return;
    if (outcome.kind === 'parsed') {
      await deps.reply(uid, userMsg, outcome.parsed);
      return;
    }
    await deps.updateMessage(uid, userMsg.id, { status: 'clarifying' });
    if (!isCurrent(uid)) return;
    if (outcome.kind === 'needs_categories') {
      await postCard(uid, {
        pendingText: userMsg.text, userMsgId: userMsg.id, fromServer: true, writtenOn: referenceDate ?? today(),
      });
    } else {
      await deps.addMessage({ userId: uid, senderId: 'bot', kind: 'bot', status: 'clarifying', text: outcome.message });
    }
  }

  /**
   * The expense branch of a send. A brand-new account has no expense category
   * to file anything under, so it gets setup in place instead of a round trip
   * that can only refuse — and the AI is not called at all.
   */
  async function sendExpense(uid: string, text: string) {
    const starter = !text.trimStart().startsWith('+') && needsStarterCategories(deps.expenseCategories());
    const userMsg = await deps.addMessage({
      userId: uid, senderId: uid, kind: 'user', text, status: starter ? 'clarifying' : 'pending',
    });
    if (!isCurrent(uid)) return;
    if (starter) {
      await postCard(uid, { pendingText: text, userMsgId: userMsg.id, writtenOn: today() });
      return;
    }
    await continueMessage(uid, userMsg);
  }

  /**
   * Finishes a starter card: `setup` makes categories exist (returns how many
   * the card should report), the card is marked resolved — persisted BEFORE
   * the continuation, so it never offers setup twice — and the ORIGINAL
   * message goes through the normal parse/clarify flow. If that fails, the
   * categories stay created.
   */
  async function finish(botMsgId: string, card: StarterCardData, setup: (uid: string) => Promise<number>) {
    const uid = deps.currentUserId();
    if (!uid || !deps.lock.acquire()) return;
    deps.setTyping(true);
    try {
      const count = await setup(uid);
      if (!isCurrent(uid)) return;
      await deps.updateMessage(uid, botMsgId, { card: { kind: 'starter', data: { ...card, resolved: { count } } } });
      if (!isCurrent(uid)) return;
      await continueMessage(uid, starterContinuationMessage(card, deps.messages(), uid), card.writtenOn);
    } catch (err) {
      if (err instanceof ChatSessionChangedError || !isCurrent(uid)) return;
      console.error('chat starter setup failed', err);
      void deps.addMessage({ userId: uid, senderId: 'bot', kind: 'bot', status: 'saved', text: deps.failureText });
    } finally {
      if (isCurrent(uid)) deps.setTyping(false);
      deps.lock.release();
    }
  }

  /**
   * Activation always starts from what Firestore holds now, never from Redux:
   * another device (or a reset) may have created, renamed or archived
   * categories since this screen loaded them.
   */
  const activate = (botMsgId: string, card: StarterCardData, ids: readonly string[]) =>
    finish(botMsgId, card, async (uid) => {
      const [categories, folders] = await Promise.all([
        deps.fetchCategories(uid, 'expense'), deps.fetchFolders(uid, 'expense'),
      ]);
      if (!isCurrent(uid)) throw new ChatSessionChangedError();
      deps.dispatch(setCategories({ type: 'expense', categories }));
      deps.dispatch(setFolders({ type: 'expense', folders }));
      const result = await deps.activateStarterCategories({
        userId: uid, blueprintIds: ids, language: deps.language, folders, categories,
      });
      if (!isCurrent(uid)) throw new ChatSessionChangedError();
      [...result.adopted.folders, ...result.folders].forEach((folder) => deps.dispatch(addFolder(folder)));
      [...result.adopted.categories, ...result.created].forEach((category) => deps.dispatch(addCategory(category)));
      result.restored.forEach((category) => deps.dispatch(updateCategory(category)));
      return result.activeIds.length;
    });

  return {
    sendExpense,
    continueMessage,
    activate,
    /** Categories exist by now (another card, another device): only finish the message. */
    continueWithExisting: (botMsgId: string, card: StarterCardData) => finish(botMsgId, card, async () => 0),
    /** The user created one category of their own in the editor. */
    continueAfterCustom: (botMsgId: string, card: StarterCardData) => finish(botMsgId, card, async () => 1),
  };
}

export type StarterFlow = ReturnType<typeof createStarterFlow>;
