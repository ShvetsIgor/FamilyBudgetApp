import 'server-only';
import { createHash } from 'node:crypto';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import type { Language } from '@/shared/types';
import type { SavedSiriExpense } from '@/features/expenses/services/siriExpensesService';

export interface SiriRequestIdentity {
  id: string;
  fingerprint: string;
  language: Language;
}
export class SiriRequestConflictError extends Error {}

// Do not include server time: retries across midnight must still match.
export function siriRequestFingerprint(text: string, timeZone: string): string {
  return createHash('sha256').update(JSON.stringify([text, timeZone])).digest('hex');
}

export function readSiriReceipt(data: Record<string, unknown> | undefined, fingerprint: string) {
  if (!data) return null;
  if (data.fingerprint !== fingerprint) throw new SiriRequestConflictError('Request ID already used for different input.');
  return { expense: data.expense as SavedSiriExpense, language: data.language as Language };
}

export async function findSiriReceipt(uid: string, id: string, fingerprint: string) {
  const snapshot = await getAdminDb().doc(`users/${uid}/shortcutRequests/${id}`).get();
  return readSiriReceipt(snapshot.data(), fingerprint);
}
