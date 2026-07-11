import {
  collection, doc, addDoc, updateDoc, deleteDoc, deleteField,
  getDocs, query, where, orderBy, serverTimestamp, Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { format } from 'date-fns';
import type { SavingsGoal, SavingsContribution, Currency } from '@/shared/types';

function col(userId: string) {
  return collection(getDb(), 'savingsGoals', userId, 'goals');
}

function goalDoc(ownerId: string, goalId: string) {
  return doc(getDb(), 'savingsGoals', ownerId, 'goals', goalId);
}

function toISO(v: unknown): string {
  return v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? new Date().toISOString();
}

/**
 * Contributions are stored as a MAP keyed by a stable contribution id
 * (`contributions.{cid}` + a `lastContributionId` marker so security rules
 * can validate exactly which entry an update touched). Legacy goals still
 * hold an array — reads normalize both shapes, and the owner's device
 * migrates the doc shape via backfillContributionsShape.
 */
type RawContribution = Record<string, unknown>;

function toContribution(raw: RawContribution, id?: string): SavingsContribution {
  return {
    ...(id ? { id } : raw.id ? { id: raw.id as string } : {}),
    amount: raw.amount as number,
    date: toISO(raw.date),
    note: raw.note as string | undefined,
    byId: raw.byId as string | undefined,
    byName: raw.byName as string | undefined,
  };
}

export function normalizeContributions(value: unknown): SavingsContribution[] {
  if (Array.isArray(value)) {
    return (value as RawContribution[]).map((c) => toContribution(c));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, RawContribution>)
      .map(([id, c]) => toContribution(c, id))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return [];
}

/** Firestore payload for one contribution map entry (no undefined fields). */
function contributionEntry(c: SavingsContribution): RawContribution {
  return {
    amount: c.amount,
    date: c.date,
    ...(c.note ? { note: c.note } : {}),
    ...(c.byId ? { byId: c.byId } : {}),
    ...(c.byName ? { byName: c.byName } : {}),
  };
}

function contributionsToMap(list: SavingsContribution[]): Record<string, RawContribution> {
  const map: Record<string, RawContribution> = {};
  for (const c of list) {
    map[c.id ?? newContributionId()] = contributionEntry(c);
  }
  return map;
}

export function newContributionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toGoal(id: string, data: Record<string, unknown>): SavingsGoal {
  return {
    id,
    userId: data.userId as string,
    name: data.name as string,
    icon: (data.icon as string) ?? '🎯',
    color: (data.color as string) ?? '#6366f1',
    targetAmount: data.targetAmount as number,
    currentAmount: data.currentAmount as number,
    currency: data.currency as Currency,
    monthlyContribution: data.monthlyContribution as number | undefined,
    deadline: data.deadline ? toISO(data.deadline) : undefined,
    contributions: normalizeContributions(data.contributions),
    isPrivate: data.isPrivate as boolean | undefined,
    createdAt: toISO(data.createdAt),
  };
}

export async function fetchGoals(userId: string): Promise<SavingsGoal[]> {
  const snap = await getDocs(query(col(userId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => toGoal(d.id, d.data()));
}

/**
 * Goals as visible to OTHER family members: only isPrivate == false.
 * The equality filter is mandatory — security rules prove family list
 * queries against it. No orderBy to avoid a composite index; sorted here.
 */
export async function fetchSharedGoals(userId: string): Promise<SavingsGoal[]> {
  const snap = await getDocs(query(col(userId), where('isPrivate', '==', false)));
  return snap.docs.map((d) => toGoal(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateGoalPrivacy(userId: string, goalId: string, isPrivate: boolean): Promise<void> {
  await updateDoc(doc(getDb(), 'savingsGoals', userId, 'goals', goalId), { isPrivate });
}

/**
 * Goals created before the privacy flag existed have no isPrivate field and
 * would silently drop out of the family view (equality filters skip missing
 * fields). Backfill them as shared once, on the owner's device.
 */
export async function backfillGoalPrivacy(userId: string, goals: SavingsGoal[]): Promise<void> {
  const missing = goals.filter((g) => (g as unknown as Record<string, unknown>).isPrivate === undefined);
  await Promise.all(missing.map((g) =>
    updateDoc(doc(getDb(), 'savingsGoals', userId, 'goals', g.id), { isPrivate: false }).catch(() => {})));
}

export interface AddGoalInput {
  userId: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  initialAmount?: number;
  currency: Currency;
  monthlyContribution?: number;
  deadline?: Date;
  isPrivate?: boolean;
}

export async function addGoal(input: AddGoalInput): Promise<SavingsGoal> {
  const { userId, deadline, monthlyContribution, initialAmount, ...rest } = input;
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      currentAmount: initialAmount ?? 0,
      isPrivate: input.isPrivate ?? false,
      contributions: [],
      monthlyContribution,
      deadline: deadline ? Timestamp.fromDate(deadline) : undefined,
      createdAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(col(userId), data);
  return toGoal(ref.id, { ...data, createdAt: Timestamp.fromDate(new Date()) });
}

export interface ContributionRequest {
  /** Stable id; generate with newContributionId(). Re-applying the same id is a no-op. */
  id: string;
  amount: number;
  note?: string;
  /** Contributor uid — REQUIRED by rules for family goals; set it always. */
  byId: string;
  byName?: string;
  /** Preserved on undo re-apply; defaults to now. */
  date?: string;
}

interface TxGoalState {
  raw: Record<string, unknown>;
  contributions: Record<string, RawContribution>;
  legacyArray: boolean;
}

function readTxGoal(data: Record<string, unknown>): TxGoalState {
  const value = data.contributions;
  if (Array.isArray(value)) {
    return { raw: data, contributions: contributionsToMap(normalizeContributions(value)), legacyArray: true };
  }
  return {
    raw: data,
    contributions: { ...((value as Record<string, RawContribution>) ?? {}) },
    legacyArray: false,
  };
}

/**
 * Applies a contribution inside a Firestore transaction: the goal is re-read
 * fresh, so concurrent contributions from several family members can never
 * overwrite each other (№3). Idempotent by contribution id — a retry after a
 * timeout cannot double-add.
 *
 * A legacy array-shaped goal is converted to the map shape in the same write
 * when the OWNER contributes; other members get 'goal-not-migrated' until the
 * owner's device has migrated the doc (rules deny array writes for them).
 */
export async function applyContribution(
  ownerId: string,
  goalId: string,
  contribution: ContributionRequest,
): Promise<SavingsGoal> {
  if (!Number.isFinite(contribution.amount) || contribution.amount <= 0) {
    throw new Error('invalid-contribution-amount');
  }
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(goalDoc(ownerId, goalId));
    if (!snap.exists()) throw new Error('goal-not-found');
    const state = readTxGoal(snap.data());

    if (state.contributions[contribution.id]) {
      return toGoal(snap.id, snap.data()); // already applied — no-op
    }
    if (state.legacyArray && contribution.byId !== ownerId) {
      throw new Error('goal-not-migrated');
    }

    const entry = contributionEntry({
      amount: contribution.amount,
      date: contribution.date ?? new Date().toISOString(),
      note: contribution.note,
      byId: contribution.byId,
      byName: contribution.byName,
    });
    const currentAmount = ((snap.data().currentAmount as number) ?? 0) + contribution.amount;

    if (state.legacyArray) {
      // Owner write: migrate the whole doc to the map shape in one go
      tx.update(goalDoc(ownerId, goalId), {
        contributions: { ...state.contributions, [contribution.id]: entry },
        lastContributionId: contribution.id,
        currentAmount,
      });
    } else {
      tx.update(goalDoc(ownerId, goalId), {
        [`contributions.${contribution.id}`]: entry,
        lastContributionId: contribution.id,
        currentAmount,
      });
    }

    const contributions = normalizeContributions({ ...state.contributions, [contribution.id]: entry });
    return { ...toGoal(snap.id, snap.data()), currentAmount, contributions };
  });
}

export async function addContribution(
  ownerId: string,
  goal: SavingsGoal,
  contribution: { amount: number; note?: string; byId?: string; byName?: string }
): Promise<SavingsGoal> {
  return applyContribution(ownerId, goal.id, {
    id: newContributionId(),
    amount: contribution.amount,
    note: contribution.note,
    byId: contribution.byId ?? ownerId,
    byName: contribution.byName,
  });
}

export interface ReversedContribution {
  goal: SavingsGoal;
  /** The removed entry — lets Undo re-apply it under the same id. */
  removed: SavingsContribution;
}

/**
 * Rolls back EXACTLY the linked contribution (№4). Idempotent: a second call
 * with the same id finds nothing and changes nothing. Works on another
 * member's goal too — rules allow removing only your own entry.
 * Returns null when the contribution was already gone.
 */
export async function reverseContributionById(
  ownerId: string,
  goalId: string,
  contributionId: string,
): Promise<ReversedContribution | null> {
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(goalDoc(ownerId, goalId));
    if (!snap.exists()) return null;
    const state = readTxGoal(snap.data());
    const entry = state.contributions[contributionId];
    if (!entry) return null; // already reversed / never existed

    const remaining = { ...state.contributions };
    delete remaining[contributionId];
    const currentAmount = Math.max(0, ((snap.data().currentAmount as number) ?? 0) - (entry.amount as number));

    tx.update(goalDoc(ownerId, goalId), state.legacyArray
      ? { contributions: remaining, lastContributionId: contributionId, currentAmount }
      : {
          [`contributions.${contributionId}`]: deleteField(),
          lastContributionId: contributionId,
          currentAmount,
        });

    return {
      goal: { ...toGoal(snap.id, snap.data()), currentAmount, contributions: normalizeContributions(remaining) },
      removed: toContribution(entry, contributionId),
    };
  });
}

/**
 * Legacy fallback for expenses saved before contribution ids existed:
 * removes the NEWEST own-goal entry with the matching amount. Never guesses
 * on another member's goal.
 */
export async function reverseContributionByAmount(
  ownerId: string,
  goalId: string,
  amount: number,
): Promise<ReversedContribution | null> {
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(goalDoc(ownerId, goalId));
    if (!snap.exists()) return null;
    const state = readTxGoal(snap.data());
    const match = normalizeContributions(state.contributions)
      .filter((c) => c.amount === amount)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!match?.id) return null;

    const remaining = { ...state.contributions };
    delete remaining[match.id];
    const currentAmount = Math.max(0, ((snap.data().currentAmount as number) ?? 0) - amount);

    tx.update(goalDoc(ownerId, goalId), {
      contributions: remaining,
      lastContributionId: match.id,
      currentAmount,
    });
    return {
      goal: { ...toGoal(snap.id, snap.data()), currentAmount, contributions: normalizeContributions(remaining) },
      removed: match,
    };
  });
}

/**
 * One-time owner-side migration of legacy array-shaped contributions to the
 * map shape (family contribution rules require the map). Safe to call on
 * every load — already-migrated goals are skipped.
 */
export async function backfillContributionsShape(userId: string, goals: SavingsGoal[]): Promise<void> {
  await Promise.all(goals.map(async (g) => {
    const snap = (g as unknown as { contributions: unknown }).contributions;
    void snap;
    // Re-read raw shape cheaply: normalize keeps no marker, so just rewrite
    // goals whose entries lack ids (only legacy arrays produce id-less entries)
    if (g.contributions.length === 0 || g.contributions.every((c) => c.id)) return;
    await updateDoc(goalDoc(userId, g.id), {
      contributions: contributionsToMap(g.contributions),
    }).catch(() => {});
  }));
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'savingsGoals', userId, 'goals', goalId));
}
