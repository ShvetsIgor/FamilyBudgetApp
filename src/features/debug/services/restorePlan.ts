/**
 * Turns a «download all data» JSON export back into Firestore writes.
 *
 * Kept free of imports on purpose: the unit tests use it, and so does
 * `scripts/restore-export.mjs`, which Node 24 loads directly (type stripping)
 * and hands an Admin `Timestamp` factory.
 *
 * Why a plan and not a blind copy:
 * - dates must come back as Timestamps — every month query filters
 *   `where('date', '>=', Timestamp)`, and a string date silently drops the
 *   entry from every month;
 * - a backup may be restored into a different (test) account, so the owner
 *   uid is rewritten wherever it appears;
 * - derived and device-local sections are not data to write;
 * - unfinished chat actions must not be replayable: the retry receipts are
 *   not part of the export, so a restored «retry» could book money twice.
 */

export const TIMESTAMP_TAG = '$timestamp';

export interface RestoreWrite {
  path: string;
  data: Record<string, unknown>;
}

export interface RestorePlan {
  sourceUid: string;
  writes: RestoreWrite[];
  /** Sections intentionally not written, with the reason. */
  skipped: string[];
}

/** Export section → Firestore collection under the target uid. */
const COLLECTIONS: Record<string, (uid: string) => string> = {
  expenses: (uid) => `expenses/${uid}/items`,
  incomes: (uid) => `incomes/${uid}/items`,
  savingsGoals: (uid) => `savingsGoals/${uid}/goals`,
  recurringPayments: (uid) => `recurringPayments/${uid}/items`,
  recurringIncome: (uid) => `recurringIncome/${uid}/items`,
  expenseCategories: (uid) => `categories/${uid}/expense`,
  incomeCategories: (uid) => `categories/${uid}/income`,
  expenseFolders: (uid) => `categoryFolders/${uid}/expense`,
  incomeFolders: (uid) => `categoryFolders/${uid}/income`,
  storeProfiles: (uid) => `storeProfiles/${uid}/profiles`,
  messages: (uid) => `messages/${uid}/items`,
  learnedKeywords: (uid) => `users/${uid}/learnedKeywords`,
};

/**
 * Schema 2 exported Timestamps as bare ISO strings, indistinguishable from
 * fields that ARE strings (a contribution's `date`, a recurring income's
 * `nextDueDate`). These are the fields the app writes as Timestamps.
 */
const V2_TIMESTAMP_FIELDS: Record<string, readonly string[]> = {
  expenses: ['date', 'createdAt', 'updatedAt'],
  incomes: ['date', 'createdAt', 'updatedAt'],
  savingsGoals: ['createdAt', 'deadline'],
  recurringPayments: ['createdAt', 'startDate', 'nextDueDate', 'endDate'],
  recurringIncome: ['createdAt'],
  messages: ['createdAt', 'updatedAt'],
  profile: ['createdAt'],
};

const UNFINISHED = new Set(['pending', 'saving', 'failed']);
const ACTION_CARDS = new Set(['clarify', 'starter']);

type Json = Record<string, unknown>;

/** JSON objects only — a revived Timestamp must never be rebuilt field by field. */
function isPlainObject(value: unknown): value is Json {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Schema 3: `{ "$timestamp": iso }` → Timestamp; the owner uid → target uid. */
function revive(value: unknown, sourceUid: string, targetUid: string, toTimestamp: (iso: string) => unknown): unknown {
  if (typeof value === 'string') return value === sourceUid ? targetUid : value;
  if (Array.isArray(value)) return value.map((v) => revive(v, sourceUid, targetUid, toTimestamp));
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === TIMESTAMP_TAG && typeof value[TIMESTAMP_TAG] === 'string') {
      return toTimestamp(value[TIMESTAMP_TAG]);
    }
    return Object.fromEntries(keys.map((k) => [k, revive(value[k], sourceUid, targetUid, toTimestamp)]));
  }
  return value;
}

function reviveV2Fields(doc: Json, section: string, toTimestamp: (iso: string) => unknown): Json {
  const fields = V2_TIMESTAMP_FIELDS[section] ?? [];
  const out = { ...doc };
  for (const field of fields) {
    const v = out[field];
    if (typeof v === 'string' && !Number.isNaN(Date.parse(v)) && v.includes('T')) out[field] = toTimestamp(v);
  }
  return out;
}

/**
 * Chat history stays, its actions do not: action cards (category choice,
 * first-expense setup) are dropped, and an unfinished user message becomes
 * `undone` without its save attempt, so nothing offers a retry.
 */
function settleMessage(doc: Json): Json | null {
  const card = doc.card as { kind?: string } | undefined;
  if (doc.kind === 'bot' && card?.kind && ACTION_CARDS.has(card.kind)) return null;
  if (doc.kind === 'user' && typeof doc.status === 'string' && UNFINISHED.has(doc.status)) {
    const { saveAttempt: _saveAttempt, ...rest } = doc;
    return { ...rest, status: 'undone' };
  }
  return doc;
}

export function buildRestorePlan(
  exported: unknown,
  targetUid: string,
  toTimestamp: (iso: string) => unknown,
): RestorePlan {
  if (!isPlainObject(exported)) throw new Error('Export is not a JSON object');
  const version = exported.schemaVersion;
  if (version !== 2 && version !== 3) throw new Error(`Unsupported export schemaVersion: ${String(version)}`);
  const sourceUid = exported.userId;
  if (typeof sourceUid !== 'string' || !sourceUid) throw new Error('Export has no userId');
  if (!targetUid || targetUid.includes('/')) throw new Error('Invalid target uid');

  const prepare = (doc: Json, section: string): Json => {
    const revived = revive(doc, sourceUid, targetUid, toTimestamp) as Json;
    return version === 2 ? reviveV2Fields(revived, section, toTimestamp) : revived;
  };

  const writes: RestoreWrite[] = [];
  for (const [section, collectionPath] of Object.entries(COLLECTIONS)) {
    const docs = exported[section];
    if (docs === undefined) continue;
    if (!Array.isArray(docs)) throw new Error(`Section ${section} is not a list`);
    for (const raw of docs) {
      if (!isPlainObject(raw) || typeof raw.id !== 'string' || !raw.id || raw.id.includes('/')) {
        throw new Error(`Section ${section} has a document without a valid id`);
      }
      const { id, ...fields } = raw;
      const settled = section === 'messages' ? settleMessage(fields) : fields;
      if (!settled) continue;
      writes.push({ path: `${collectionPath(targetUid)}/${id}`, data: prepare(settled, section) });
    }
  }

  if (isPlainObject(exported.profile)) {
    // Family membership is the family's to grant: a restored account rejoins by invite
    const { familyId: _familyId, accountType: _accountType, ...profile } = exported.profile;
    writes.push({ path: `users/${targetUid}`, data: { ...prepare(profile, 'profile'), familyId: null, accountType: 'personal' } });
  }
  if (isPlainObject(exported.budgets)) {
    writes.push({ path: `budgets/${targetUid}`, data: prepare(exported.budgets, 'budgets') });
  }

  return {
    sourceUid,
    writes,
    skipped: [
      'monthlyStats — derived; rebuilt from entries on first read',
      'localSuggestionMemory — device-local ranking memory, not Firestore data',
      'family membership — rejoin by invite',
    ],
  };
}
