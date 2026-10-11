import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { SerializableChatMessage } from '@/shared/types/message';

/**
 * How long a chat message may sit unfinished before it is treated as
 * abandoned (app closed, reload, lost connection) rather than in progress.
 * A Groq parse times out at 25 s on the client, a transaction well before this.
 */
export const CHAT_STALL_MS = 60_000;

/**
 * - `retry_parse`: never got a reply (or an income save threw) — run the
 *   original text through the normal flow again. No money moved without a
 *   reply, and income saves reuse the message's operation id.
 * - `retry_save`: the expense write threw — repeat it with the stored
 *   category; the operation receipt makes a second write impossible.
 * - `check_save`: the write was in flight when the app went away — read the
 *   receipt before claiming anything either way.
 */
export type ChatRecoveryAction = 'none' | 'retry_parse' | 'retry_save' | 'check_save';

export function chatRecoveryAction(
  message: SerializableChatMessage,
  now: number,
  busy: boolean,
  /** A bot message follows it. Older chats leave answered messages «pending». */
  answered = false,
): ChatRecoveryAction {
  // While this session is working on the chat, nothing is abandoned yet. A
  // receipt photo is not stored, so it cannot be re-read; its card's own Save
  // button is the retry (same operation id).
  if (message.kind !== 'user' || busy || message.receipt) return 'none';
  if (message.status === 'failed') return message.saveAttempt ? 'retry_save' : 'retry_parse';
  if (message.status === 'saving') {
    const started = Date.parse(message.saveAttempt?.startedAt ?? message.updatedAt ?? message.createdAt);
    if (!(now - started > CHAT_STALL_MS)) return 'none';
    return message.saveAttempt ? 'check_save' : 'retry_parse';
  }
  if (message.status === 'pending') {
    return !answered && now - Date.parse(message.createdAt) > CHAT_STALL_MS ? 'retry_parse' : 'none';
  }
  return 'none';
}

/** User messages that a bot message follows — answered, whatever their stored status. */
export function answeredMessageIds(messages: readonly SerializableChatMessage[]): Set<string> {
  const answered = new Set<string>();
  let botLater = false;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.kind === 'bot') botLater = true;
    else if (botLater) answered.add(message.id);
  }
  return answered;
}

/** The chat's retry key: `respond.ts` writes every chat entry under `chat-{userMsgId}`. */
export function chatOperationId(userMsgId: string): string {
  return `chat-${userMsgId}`;
}

/** True once the transaction that records this message's entry has committed. */
export async function isChatOperationCommitted(userId: string, userMsgId: string): Promise<boolean> {
  const receipt = await getDoc(doc(getDb(), 'users', userId, 'entryOperations', chatOperationId(userMsgId)));
  return receipt.exists();
}
