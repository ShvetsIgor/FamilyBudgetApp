import type { SerializableChatMessage, StarterCardData } from '@/shared/types/message';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Firestore hands the card back untyped; a malformed one renders as plain text. */
export function readStarterCard(data: unknown): StarterCardData | null {
  if (!data || typeof data !== 'object') return null;
  const { pendingText, userMsgId, fromServer, writtenOn, resolved } = data as Record<string, unknown>;
  if (typeof pendingText !== 'string' || !pendingText.trim() || typeof userMsgId !== 'string' || !userMsgId) return null;
  const count = (resolved as { count?: unknown } | undefined)?.count;
  return {
    pendingText, userMsgId,
    ...(fromServer === true ? { fromServer: true } : {}),
    ...(typeof writtenOn === 'string' && DATE_KEY.test(writtenOn) ? { writtenOn } : {}),
    ...(resolved && typeof count === 'number' ? { resolved: { count } } : {}),
  };
}

/**
 * The user message to finish after setup. It is the ORIGINAL bubble (no new
 * one is posted) and its text comes from the persisted card, so this still
 * works after a reload or when the bubble has scrolled out of the loaded window.
 */
export function starterContinuationMessage(
  card: StarterCardData,
  messages: readonly SerializableChatMessage[],
  userId: string,
): SerializableChatMessage {
  const original = messages.find((message) => message.id === card.userMsgId && message.kind === 'user');
  return original
    ? { ...original, text: card.pendingText }
    : {
        id: card.userMsgId, userId, senderId: userId, kind: 'user', text: card.pendingText,
        status: 'clarifying', createdAt: new Date().toISOString(),
      };
}
