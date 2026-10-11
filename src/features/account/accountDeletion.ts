import 'server-only';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { getAdminAuth, getAdminDb } from '@/shared/lib/firebaseAdmin';

/**
 * Every top-level collection keyed by the owner's uid (`{root}/{uid}/...`).
 * `users/{uid}` is not here: it goes last, after everything that hangs off it.
 * A new per-user collection MUST be added here, or deletion leaves it behind.
 */
export const USER_DATA_ROOTS = [
  'budgets', 'categories', 'categoryFolders', 'expenses', 'incomes', 'messages',
  'monthlyStats', 'recurringIncome', 'recurringPayments', 'savingsGoals', 'storeProfiles',
] as const;

/** Replaces the contributor id on goals that stay with other members. */
export const DELETED_MEMBER_ID = 'deleted-member';

/** Members' shared data depends on the family; only its owner can dissolve it. */
export class AccountDeletionBlockedError extends Error {
  constructor(readonly reason: 'family_owner') { super(reason); }
}

interface Deps { db: Firestore; auth: Auth }

type Contribution = { byId?: string; byName?: string };

/**
 * Another member's goal keeps its money — the balance is THEIR history — but
 * no longer names the person who left. An absent `byId` would read as «the
 * goal owner», so the id is replaced rather than removed.
 */
async function anonymizeContributions(db: Firestore, uid: string, ownerId: string): Promise<void> {
  const goals = await db.collection(`savingsGoals/${ownerId}/goals`).get();
  await Promise.all(goals.docs.map(async (goal) => {
    const contributions = goal.data().contributions as Contribution[] | Record<string, Contribution> | undefined;
    if (!contributions) return;
    if (Array.isArray(contributions)) {
      if (!contributions.some((c) => c?.byId === uid)) return;
      await goal.ref.update({
        contributions: contributions.map((c) => {
          if (c?.byId !== uid) return c;
          const { byName: _byName, ...rest } = c;
          return { ...rest, byId: DELETED_MEMBER_ID };
        }),
      });
      return;
    }
    const patch: Record<string, unknown> = {};
    for (const [id, c] of Object.entries(contributions)) {
      if (c?.byId !== uid) continue;
      patch[`contributions.${id}.byId`] = DELETED_MEMBER_ID;
      patch[`contributions.${id}.byName`] = FieldValue.delete();
    }
    if (Object.keys(patch).length > 0) await goal.ref.update(patch);
  }));
}

async function leaveFamily(db: Firestore, uid: string, familyId: string): Promise<void> {
  const familyRef = db.doc(`families/${familyId}`);
  const family = await familyRef.get();
  if (!family.exists) return;
  const { ownerId, memberIds = [] } = family.data() as { ownerId: string; memberIds?: string[] };
  const others = memberIds.filter((id) => id !== uid);
  if (ownerId === uid && others.length > 0) throw new AccountDeletionBlockedError('family_owner');

  await Promise.all(others.map((memberId) => anonymizeContributions(db, uid, memberId)));
  if (ownerId === uid) {
    await familyRef.delete();
    const invites = await db.collection('invites').where('familyId', '==', familyId).get();
    await Promise.all(invites.docs.map((invite) => invite.ref.delete()));
  } else {
    await familyRef.update({ memberIds: FieldValue.arrayRemove(uid) });
  }
}

/**
 * Deletes an account and everything it owns. Order matters:
 * - Siri tokens first, so nothing new is written through Shortcuts;
 * - the family next — an owner with members is refused before anything is
 *   touched, so a refusal never leaves a half-deleted account;
 * - then the profile DOCUMENT: firestore.rules refuses owner writes once it
 *   is gone (`ownerWrite`), so another device whose ID token has not expired
 *   yet can no longer leave orphaned data behind;
 * - then the data and the profile's subcollections, and the Auth user LAST:
 *   until then the client's token still works and a failed run can simply be
 *   repeated (every step is idempotent; a repeat finds no profile and skips
 *   the family step, which already ran).
 */
export async function deleteAccount(uid: string, deps: Deps = { db: getAdminDb(), auth: getAdminAuth() }): Promise<void> {
  const { db, auth } = deps;
  const profileRef = db.doc(`users/${uid}`);
  const profile = (await profileRef.get()).data() as { familyId?: string | null; email?: string } | undefined;

  if (profile?.familyId) {
    // Checked before any deletion: an owner with members must dissolve first
    const family = await db.doc(`families/${profile.familyId}`).get();
    const data = family.data() as { ownerId?: string; memberIds?: string[] } | undefined;
    if (data?.ownerId === uid && (data.memberIds ?? []).some((id) => id !== uid)) {
      throw new AccountDeletionBlockedError('family_owner');
    }
  }

  await db.recursiveDelete(db.collection(`users/${uid}/shortcutTokens`));
  if (profile?.familyId) await leaveFamily(db, uid, profile.familyId);

  let email = profile?.email;
  try { email = (await auth.getUser(uid)).email ?? email; } catch { /* already gone: profile email is enough */ }
  const inviteQueries = [db.collection('invites').where('fromUserId', '==', uid).get()];
  if (email) inviteQueries.push(db.collection('invites').where('toEmail', '==', email.toLowerCase().trim()).get());
  const inviteSnaps = await Promise.all(inviteQueries);
  await Promise.all(inviteSnaps.flatMap((snap) => snap.docs.map((invite) => invite.ref.delete())));

  // From here on every owner write is refused by the rules
  await profileRef.delete();
  for (const root of USER_DATA_ROOTS) await db.recursiveDelete(db.doc(`${root}/${uid}`));
  await db.recursiveDelete(profileRef);

  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }
}
