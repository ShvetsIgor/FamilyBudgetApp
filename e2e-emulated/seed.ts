/**
 * Seeds the Auth + Firestore emulators for the authenticated E2E suite.
 *
 * Auth users are created through the Auth emulator REST endpoint (returns the
 * generated uid); Firestore documents are written with security rules
 * DISABLED via @firebase/rules-unit-testing, so a two-member family with its
 * private goals and secret expenses can be set up directly without replaying
 * the whole invite flow.
 */
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import {
  E2E_PROJECT_ID, AUTH_EMULATOR, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT,
  PASSWORD, ALICE, BOB,
} from './constants';

async function createAuthUser(email: string, password: string): Promise<string> {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`auth seed failed for ${email}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { localId: string };
  return data.localId;
}

export interface SeededUsers {
  aliceUid: string;
  bobUid: string;
}

function profile(uid: string, name: string, email: string, extra: Record<string, unknown> = {}) {
  return {
    id: uid, name, email,
    currency: 'ILS', language: 'en', theme: 'mist', darkMode: false,
    accountType: 'personal', onboarded: true,
    createdAt: Timestamp.now(),
    ...extra,
  };
}

export async function seedEmulators(): Promise<SeededUsers> {
  const aliceUid = await createAuthUser(ALICE.email, PASSWORD);
  const bobUid = await createAuthUser(BOB.email, PASSWORD);

  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: E2E_PROJECT_ID,
    firestore: { host: FIRESTORE_EMULATOR_HOST, port: FIRESTORE_EMULATOR_PORT },
  });

  const familyId = 'e2e-family';

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Family: alice (owner) + bob
    await setDoc(doc(db, 'families', familyId), {
      name: 'E2E Family', ownerId: aliceUid, memberIds: [aliceUid, bobUid],
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'users', aliceUid), profile(aliceUid, ALICE.name, ALICE.email, { familyId, accountType: 'family' }));
    await setDoc(doc(db, 'users', bobUid), profile(bobUid, BOB.name, BOB.email, { familyId, accountType: 'family' }));

    // Alice's expense categories (one private)
    await setDoc(doc(db, 'categories', aliceUid, 'expense', 'cat-groceries'), {
      id: 'cat-groceries', userId: aliceUid, name: 'Groceries', icon: 'cart', color: '#E07A5F',
      type: 'expense', order: 0, isPrivate: false,
    });
    await setDoc(doc(db, 'categories', aliceUid, 'expense', 'cat-therapy'), {
      id: 'cat-therapy', userId: aliceUid, name: 'Therapy', icon: 'heart', color: '#A48BC9',
      type: 'expense', order: 1, isPrivate: true,
    });

    // A shared (regular) expense and a secret one, this month
    const now = Timestamp.now();
    await setDoc(doc(db, 'expenses', aliceUid, 'items', 'exp-shared'), {
      userId: aliceUid, amount: 120, currency: 'ILS', categoryId: 'cat-groceries',
      date: now, paymentMethod: 'card', tags: [], privacy: 'regular', splits: [],
      isRecurring: false, store: 'Shufersal', createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db, 'expenses', aliceUid, 'items', 'exp-secret'), {
      userId: aliceUid, amount: 400, currency: 'ILS', categoryId: 'cat-therapy',
      date: now, paymentMethod: 'card', tags: [], privacy: 'secret', splits: [],
      isRecurring: false, store: 'PrivateClinic', createdAt: now, updatedAt: now,
    });

    // A shared goal and a private one
    await setDoc(doc(db, 'savingsGoals', aliceUid, 'goals', 'goal-shared'), {
      userId: aliceUid, name: 'Family Trip', targetAmount: 5000, currentAmount: 1000,
      currency: 'ILS', isPrivate: false, contributions: {}, createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'savingsGoals', aliceUid, 'goals', 'goal-private'), {
      userId: aliceUid, name: 'Surprise Gift', targetAmount: 2000, currentAmount: 500,
      currency: 'ILS', isPrivate: true, contributions: {}, createdAt: Timestamp.now(),
    });

    // Bob needs an income category so his own screens aren't empty
    await setDoc(doc(db, 'categories', bobUid, 'income', 'inc-salary'), {
      id: 'inc-salary', userId: bobUid, name: 'Salary', icon: 'cash', color: '#10b981',
      type: 'income', order: 0, isPrivate: false,
    });
  });

  await testEnv.cleanup();
  return { aliceUid, bobUid };
}
