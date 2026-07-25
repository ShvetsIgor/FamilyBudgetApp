import {
  collection, doc, updateDoc, setDoc,
  getDocs, getDoc, query, where, serverTimestamp, Timestamp, arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { Family, FamilyInvite, UserProfile } from '@/shared/types';

/**
 * Invites live under the deterministic id `{familyId}_{toEmail}` so security
 * rules can look the invite up while validating a family join (rules cannot
 * run queries). Never create invites under any other id.
 */
export function inviteDocId(familyId: string, toEmail: string): string {
  return `${familyId}_${toEmail.toLowerCase().trim()}`;
}

// Family/invite objects land in Redux — Firestore Timestamps must become ISO
// strings on read or the store holds non-serializable values
function tsToISO(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : (value as string) ?? new Date().toISOString();
}

// ─── Family CRUD ──────────────────────────────────────────────────────────────

export async function createFamily(userId: string, name: string): Promise<Family> {
  // One batch: rules verify the profile's new familyId against the family
  // doc created in the same write (getAfter), so the pair can never diverge.
  const ref = doc(collection(getDb(), 'families'));
  const batch = writeBatch(getDb());
  batch.set(ref, {
    name,
    ownerId: userId,
    memberIds: [userId],
    createdAt: serverTimestamp(),
  });
  batch.update(doc(getDb(), 'users', userId), {
    familyId: ref.id,
    accountType: 'family',
  });
  await batch.commit();

  return {
    id: ref.id,
    name,
    ownerId: userId,
    memberIds: [userId],
    createdAt: new Date().toISOString(),
  };
}

export async function fetchFamily(familyId: string): Promise<Family | null> {
  const snap = await getDoc(doc(getDb(), 'families', familyId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: snap.id, ...data, createdAt: tsToISO(data.createdAt) } as Family;
}

export async function fetchFamilyMembers(memberIds: string[]): Promise<UserProfile[]> {
  if (memberIds.length === 0) return [];
  const members: UserProfile[] = [];
  for (const uid of memberIds) {
    const snap = await getDoc(doc(getDb(), 'users', uid));
    if (snap.exists()) members.push({ id: snap.id, ...snap.data() } as UserProfile);
  }
  return members;
}

export async function leaveFamily(userId: string, family: Family): Promise<void> {
  const newMembers = family.memberIds.filter((id) => id !== userId);

  if (family.ownerId === userId) {
    // Owner dissolves the family: detach every member and delete the family
    // doc in ONE batch, so an interruption can't leave the family half-alive.
    // (Rules' get() sees the pre-batch state, so the owner check still passes.)
    const batch = writeBatch(getDb());
    for (const memberId of family.memberIds) {
      batch.update(doc(getDb(), 'users', memberId), {
        familyId: null,
        accountType: 'personal',
      });
    }
    batch.delete(doc(getDb(), 'families', family.id));
    await batch.commit();
  } else {
    // One batch: rules allow clearing the profile familyId only when the
    // same write provably removes the uid from memberIds (getAfter).
    const batch = writeBatch(getDb());
    batch.update(doc(getDb(), 'families', family.id), { memberIds: newMembers });
    batch.update(doc(getDb(), 'users', userId), {
      familyId: null,
      accountType: 'personal',
    });
    await batch.commit();
  }
}

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function sendInvite(
  familyId: string,
  fromUserId: string,
  toEmail: string
): Promise<FamilyInvite> {
  const email = toEmail.toLowerCase().trim();

  // One pending invite per email: re-sending would create dangling duplicates
  // (the query is constrained to fromUserId so security rules can prove it)
  const existing = await getDocs(query(
    collection(getDb(), 'invites'),
    where('fromUserId', '==', fromUserId),
    where('toEmail', '==', email),
    where('status', '==', 'pending'),
  ));
  const stillValid = existing.docs.find((d) => {
    const exp = (d.data().expiresAt as Timestamp | undefined)?.toDate();
    return !exp || exp > new Date();
  });
  if (stillValid) {
    throw new Error('already-invited');
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Deterministic id — required by the families join rule. setDoc also
  // re-issues an expired/answered invite for the same email in place.
  const id = inviteDocId(familyId, email);
  await setDoc(doc(getDb(), 'invites', id), {
    familyId,
    fromUserId,
    toEmail: email,
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  return {
    id,
    familyId,
    fromUserId,
    toEmail: email,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function fetchPendingInvite(email: string): Promise<FamilyInvite | null> {
  const q = query(
    collection(getDb(), 'invites'),
    where('toEmail', '==', email.toLowerCase().trim()),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  // Ignore invites past their expiresAt — they stay 'pending' in Firestore
  // but must not resurface in the UI
  const now = new Date();
  const valid = snap.docs.find((d) => {
    const exp = (d.data().expiresAt as Timestamp | undefined)?.toDate();
    return !exp || exp > now;
  });
  if (!valid) return null;
  const raw = valid.data();
  const invite = {
    id: valid.id,
    ...raw,
    createdAt: tsToISO(raw.createdAt),
    expiresAt: tsToISO(raw.expiresAt),
  } as FamilyInvite;
  // Invites created before deterministic ids cannot pass the join rule.
  // Reject them so the sender can re-send; don't surface them in the UI.
  if (invite.id !== inviteDocId(invite.familyId, invite.toEmail)) {
    updateDoc(doc(getDb(), 'invites', invite.id), { status: 'rejected' }).catch(() => {});
    return null;
  }
  return invite;
}

export async function acceptInvite(invite: FamilyInvite, userId: string): Promise<void> {
  // ONE atomic batch: invite status + membership + profile pointer. Rules
  // verify each piece against the others (join requires the live pending
  // invite via get(); the profile change requires post-batch membership via
  // getAfter()), so a partial state can never be committed.
  const batch = writeBatch(getDb());
  batch.update(doc(getDb(), 'invites', invite.id), { status: 'accepted' });
  batch.update(doc(getDb(), 'families', invite.familyId), {
    memberIds: arrayUnion(userId),
  });
  batch.update(doc(getDb(), 'users', userId), {
    familyId: invite.familyId,
    accountType: 'family',
  });
  await batch.commit();
}

export async function rejectInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'invites', inviteId), { status: 'rejected' });
}
