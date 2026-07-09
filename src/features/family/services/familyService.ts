import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, serverTimestamp, Timestamp, arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { Family, FamilyInvite, UserProfile } from '@/shared/types';

// ─── Family CRUD ──────────────────────────────────────────────────────────────

export async function createFamily(userId: string, name: string): Promise<Family> {
  const ref = await addDoc(collection(getDb(), 'families'), {
    name,
    ownerId: userId,
    memberIds: [userId],
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(getDb(), 'users', userId), {
    familyId: ref.id,
    accountType: 'family',
  });

  return {
    id: ref.id,
    name,
    ownerId: userId,
    memberIds: [userId],
    createdAt: Timestamp.fromDate(new Date()),
  };
}

export async function fetchFamily(familyId: string): Promise<Family | null> {
  const snap = await getDoc(doc(getDb(), 'families', familyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Family;
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
    await updateDoc(doc(getDb(), 'families', family.id), { memberIds: newMembers });
    await updateDoc(doc(getDb(), 'users', userId), {
      familyId: null,
      accountType: 'personal',
    });
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

  const ref = await addDoc(collection(getDb(), 'invites'), {
    familyId,
    fromUserId,
    toEmail: email,
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  return {
    id: ref.id,
    familyId,
    fromUserId,
    toEmail: email,
    status: 'pending',
    createdAt: Timestamp.fromDate(new Date()),
    expiresAt: Timestamp.fromDate(expiresAt),
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
  return { id: valid.id, ...valid.data() } as FamilyInvite;
}

export async function acceptInvite(invite: FamilyInvite, userId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'invites', invite.id), { status: 'accepted' });
  await updateDoc(doc(getDb(), 'families', invite.familyId), {
    memberIds: arrayUnion(userId),
  });
  await updateDoc(doc(getDb(), 'users', userId), {
    familyId: invite.familyId,
    accountType: 'family',
  });
}

export async function rejectInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'invites', inviteId), { status: 'rejected' });
}
