import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { SerializableChatMessage, ParseResult, BotCard, MessageStatus } from '@/shared/types/message';

function col(userId: string) {
  return collection(getDb(), 'messages', userId, 'items');
}

function toISO(v: unknown): string {
  return v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? new Date().toISOString();
}

function toSerializable(id: string, data: Record<string, unknown>): SerializableChatMessage {
  return {
    id,
    userId:    data.userId    as string,
    senderId:  data.senderId  as string,
    kind:      data.kind      as 'user' | 'bot',
    text:      data.text      as string,
    status:    data.status    as MessageStatus,
    parsed:    data.parsed    as ParseResult | undefined,
    expenseId: data.expenseId as string | undefined,
    card:      data.card      as BotCard | undefined,
    createdAt: toISO(data.createdAt),
    updatedAt: data.updatedAt ? toISO(data.updatedAt) : undefined,
  };
}

export interface AddMessageInput {
  userId: string;
  senderId: string;
  kind: 'user' | 'bot';
  text: string;
  status: MessageStatus;
  parsed?: ParseResult;
  expenseId?: string;
  card?: BotCard;
}

export function subscribeMessages(
  userId: string,
  msgLimit: number,
  callback: (messages: SerializableChatMessage[]) => void
): Unsubscribe {
  const q = query(col(userId), orderBy('createdAt', 'asc'), fsLimit(msgLimit));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => toSerializable(d.id, d.data() as Record<string, unknown>));
    callback(msgs);
  });
}

export async function addMessage(input: AddMessageInput): Promise<SerializableChatMessage> {
  const { userId, expenseId, parsed, card, ...rest } = input;
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      expenseId,
      parsed,
      card,
      createdAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(col(userId), data);
  return toSerializable(ref.id, {
    ...data,
    createdAt: Timestamp.fromDate(new Date()),
  });
}

export async function updateMessage(
  userId: string,
  messageId: string,
  updates: Partial<Pick<SerializableChatMessage, 'status' | 'expenseId' | 'parsed' | 'card' | 'text'>>
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries({ ...updates, updatedAt: serverTimestamp() }).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(col(userId), messageId), clean);
}

export async function deleteMessageAndExpense(
  userId: string,
  messageId: string,
  expenseId?: string
): Promise<void> {
  await deleteDoc(doc(col(userId), messageId));
  if (expenseId) {
    await deleteDoc(doc(getDb(), 'expenses', userId, expenseId));
  }
}
