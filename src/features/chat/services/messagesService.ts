import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
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
  incomeId?: string;
  card?: BotCard;
}

export function subscribeMessages(
  userId: string,
  msgLimit: number,
  callback: (messages: SerializableChatMessage[]) => void
): Unsubscribe {
  // desc + limit gives the NEWEST N messages; reverse for chronological (asc) display
  const q = query(col(userId), orderBy('createdAt', 'desc'), fsLimit(msgLimit));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .slice()
      .reverse()
      .map((d) => toSerializable(d.id, d.data() as Record<string, unknown>));
    callback(msgs);
  });
}

// Recursively strip undefined from plain objects (Firestore rejects undefined values)
function stripUndef(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(stripUndef);
  if (v !== null && typeof v === 'object' && v.constructor === Object) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, val]) => val !== undefined)
        .map(([k, val]) => [k, stripUndef(val)])
    );
  }
  return v;
}

export async function addMessage(input: AddMessageInput): Promise<SerializableChatMessage> {
  const { userId, expenseId, incomeId, parsed, card, ...rest } = input;
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      expenseId,
      incomeId,
      parsed: parsed ? stripUndef(parsed) : undefined,
      card: card ? stripUndef(card) : undefined,
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
  updates: Partial<Pick<SerializableChatMessage, 'status' | 'expenseId' | 'incomeId' | 'parsed' | 'card' | 'text'>>
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries({ ...updates, updatedAt: serverTimestamp() }).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(col(userId), messageId), clean);
}

/** Delete a single chat message. Does not cascade — entity-side delete handlers own the cascade. */
export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(col(userId), messageId));
}

/**
 * Delete every chat message for this user. Expenses, income, savings etc. stay.
 * Firestore batches cap at 500 ops, so we commit in chunks.
 */
export async function clearAllMessages(userId: string): Promise<void> {
  const snap = await getDocs(col(userId));
  if (snap.empty) return;

  let batch = writeBatch(getDb());
  let n = 0;
  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    n++;
    if (n === 450) {
      await batch.commit();
      batch = writeBatch(getDb());
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
}
