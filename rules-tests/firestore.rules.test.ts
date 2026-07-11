/**
 * Firestore security rules tests — run against the emulator:
 *   npm run test:rules
 * (firebase emulators:exec boots the Firestore emulator and executes this
 * suite; FIRESTORE_EMULATOR_HOST is provided by the wrapper.)
 *
 * Threat model covered here:
 *  - profile.familyId is a pointer, never proof: setting it must not grant
 *    family reads, and it cannot be set without provable membership;
 *  - joining a family requires a live pending invite for the caller's email
 *    (deterministic invite id `{familyId}_{email}`);
 *  - reactions: only the caller's own key, short string values;
 *  - goal contributions: append-only, attributed, balance-consistent;
 *  - secret expenses / private goals stay owner-only.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  collection, query, where, arrayUnion, deleteField, Timestamp,
} from 'firebase/firestore';

const PROJECT = 'family-budget-rules-test';
const F = 'familyF';

let env: RulesTestEnvironment;

const inFuture = () => Timestamp.fromDate(new Date(Date.now() + 86_400_000));
const inPast = () => Timestamp.fromDate(new Date(Date.now() - 86_400_000));

function ctx(uid: string, email?: string) {
  return env.authenticatedContext(uid, email ? { email } : {}).firestore();
}

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'families', F), { name: 'Fam', ownerId: 'alice', memberIds: ['alice', 'bob'] });
    await setDoc(doc(db, 'users', 'alice'), { id: 'alice', email: 'alice@x.com', familyId: F, accountType: 'family' });
    await setDoc(doc(db, 'users', 'bob'), { id: 'bob', email: 'bob@x.com', familyId: F, accountType: 'family' });
    await setDoc(doc(db, 'users', 'mallory'), { id: 'mallory', email: 'mallory@x.com', familyId: null, accountType: 'personal' });

    await setDoc(doc(db, 'expenses', 'alice', 'items', 'exp-regular'), {
      userId: 'alice', amount: 100, privacy: 'regular', date: Timestamp.now(),
      categoryId: 'cat1', reactions: { alice: '👍' },
    });
    await setDoc(doc(db, 'expenses', 'alice', 'items', 'exp-secret'), {
      userId: 'alice', amount: 500, privacy: 'secret', date: Timestamp.now(), categoryId: 'cat1',
    });
    // Contributions are stored as a MAP keyed by contribution id.
    await setDoc(doc(db, 'savingsGoals', 'alice', 'goals', 'goal-open'), {
      userId: 'alice', name: 'Car', targetAmount: 1000, currentAmount: 100,
      isPrivate: false,
      contributions: { c1: { amount: 100, date: '2026-07-01', byId: 'alice' } },
      lastContributionId: 'c1',
    });
    await setDoc(doc(db, 'savingsGoals', 'alice', 'goals', 'goal-private'), {
      userId: 'alice', name: 'Secret dream', targetAmount: 1000, currentAmount: 0,
      isPrivate: true, contributions: {},
    });
  });
}

beforeAll(async () => {
  const hostEnv = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8090';
  const [host, port] = hostEnv.split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
      host,
      port: Number(port),
    },
  });
});

afterAll(async () => { await env?.cleanup(); });
beforeEach(seed);

// ── Family membership / join ─────────────────────────────────────────────

describe('family membership', () => {
  it('outsider cannot point their profile at a family they were not admitted to', async () => {
    const db = ctx('mallory', 'mallory@x.com');
    await assertFails(updateDoc(doc(db, 'users', 'mallory'), { familyId: F, accountType: 'family' }));
  });

  it('outsider cannot self-join memberIds without an invite', async () => {
    const db = ctx('mallory', 'mallory@x.com');
    await assertFails(updateDoc(doc(db, 'families', F), { memberIds: arrayUnion('mallory') }));
  });

  it('profile familyId alone grants no family reads (seeded stale pointer)', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(doc(c.firestore(), 'users', 'mallory'), { familyId: F });
    });
    const db = ctx('mallory', 'mallory@x.com');
    await assertFails(getDoc(doc(db, 'expenses', 'alice', 'items', 'exp-regular')));
    await assertFails(getDocs(query(
      collection(db, 'expenses', 'alice', 'items'), where('privacy', '==', 'regular'))));
  });

  it('expired / rejected / accepted / foreign invites do not allow joining', async () => {
    const cases = [
      { id: `${F}_mallory@x.com`, status: 'pending', expiresAt: inPast() },
      { id: `${F}_mallory@x.com`, status: 'rejected', expiresAt: inFuture() },
      { id: `${F}_mallory@x.com`, status: 'accepted', expiresAt: inFuture() },
      { id: `${F}_carol@x.com`, status: 'pending', expiresAt: inFuture() },
    ];
    for (const c of cases) {
      await seed();
      await env.withSecurityRulesDisabled(async (adminC) => {
        await setDoc(doc(adminC.firestore(), 'invites', c.id), {
          familyId: F, fromUserId: 'alice', toEmail: c.id.split('_')[1],
          status: c.status, expiresAt: c.expiresAt,
        });
      });
      const db = ctx('mallory', 'mallory@x.com');
      await assertFails(updateDoc(doc(db, 'families', F), { memberIds: arrayUnion('mallory') }));
    }
  });

  it('valid pending invite: atomic accept batch succeeds and grants reads', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'invites', `${F}_mallory@x.com`), {
        familyId: F, fromUserId: 'alice', toEmail: 'mallory@x.com',
        status: 'pending', expiresAt: inFuture(),
      });
    });
    const db = ctx('mallory', 'mallory@x.com');
    const batch = writeBatch(db);
    batch.update(doc(db, 'invites', `${F}_mallory@x.com`), { status: 'accepted' });
    batch.update(doc(db, 'families', F), { memberIds: arrayUnion('mallory') });
    batch.update(doc(db, 'users', 'mallory'), { familyId: F, accountType: 'family' });
    await assertSucceeds(batch.commit());

    // Now a real member: shared reads work, secret stays closed
    await assertSucceeds(getDoc(doc(db, 'expenses', 'alice', 'items', 'exp-regular')));
    await assertFails(getDoc(doc(db, 'expenses', 'alice', 'items', 'exp-secret')));
  });

  it('a member cannot add someone else to memberIds', async () => {
    const db = ctx('bob', 'bob@x.com');
    await assertFails(updateDoc(doc(db, 'families', F), { memberIds: arrayUnion('carol') }));
  });

  it('member self-leave batch succeeds', async () => {
    const db = ctx('bob', 'bob@x.com');
    const batch = writeBatch(db);
    batch.update(doc(db, 'families', F), { memberIds: ['alice'] });
    batch.update(doc(db, 'users', 'bob'), { familyId: null, accountType: 'personal' });
    await assertSucceeds(batch.commit());
  });

  it('stale familyId (family doc gone) can be self-healed', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(doc(c.firestore(), 'users', 'mallory'), { familyId: 'ghost-family' });
    });
    const db = ctx('mallory', 'mallory@x.com');
    await assertSucceeds(updateDoc(doc(db, 'users', 'mallory'), { familyId: null, accountType: 'personal' }));
  });

  it('profile create cannot pre-claim a family', async () => {
    const db = ctx('newbie', 'newbie@x.com');
    await assertFails(setDoc(doc(db, 'users', 'newbie'), { id: 'newbie', email: 'newbie@x.com', familyId: F }));
    await assertSucceeds(setDoc(doc(db, 'users', 'newbie'), { id: 'newbie', email: 'newbie@x.com', familyId: null }));
  });
});

// ── Family data reads ────────────────────────────────────────────────────

describe('family data access', () => {
  it('member reads regular expense, list with privacy filter; secret denied', async () => {
    const db = ctx('bob', 'bob@x.com');
    await assertSucceeds(getDoc(doc(db, 'expenses', 'alice', 'items', 'exp-regular')));
    await assertSucceeds(getDocs(query(
      collection(db, 'expenses', 'alice', 'items'), where('privacy', '==', 'regular'))));
    await assertFails(getDoc(doc(db, 'expenses', 'alice', 'items', 'exp-secret')));
    await assertFails(getDocs(collection(db, 'expenses', 'alice', 'items')));
  });

  it('private goal is owner-only; non-private readable by the family', async () => {
    const bob = ctx('bob', 'bob@x.com');
    await assertSucceeds(getDoc(doc(bob, 'savingsGoals', 'alice', 'goals', 'goal-open')));
    await assertFails(getDoc(doc(bob, 'savingsGoals', 'alice', 'goals', 'goal-private')));
  });
});

// ── Reactions ────────────────────────────────────────────────────────────

describe('expense reactions', () => {
  const path = () => doc(ctx('bob', 'bob@x.com'), 'expenses', 'alice', 'items', 'exp-regular');

  it('member may set and remove only their own reaction key', async () => {
    await assertSucceeds(updateDoc(path(), { 'reactions.bob': '❤️' }));
    await assertSucceeds(updateDoc(path(), { 'reactions.bob': deleteField() }));
  });

  it('member cannot rewrite or delete others reactions, or write junk', async () => {
    // Whole-map replace drops alice's reaction → denied
    await assertFails(updateDoc(path(), { reactions: { bob: '❤️' } }));
    // Touching someone else's key directly → denied
    await assertFails(updateDoc(path(), { 'reactions.alice': '💀' }));
    // Overlong value → denied
    await assertFails(updateDoc(path(), { 'reactions.bob': 'x'.repeat(20) }));
    // Reaction on a secret expense → denied
    const secret = doc(ctx('bob', 'bob@x.com'), 'expenses', 'alice', 'items', 'exp-secret');
    await assertFails(updateDoc(secret, { 'reactions.bob': '👍' }));
  });
});

// ── Goal contributions ───────────────────────────────────────────────────

describe('goal contributions (map shape)', () => {
  const goal = () => doc(ctx('bob', 'bob@x.com'), 'savingsGoals', 'alice', 'goals', 'goal-open');

  it('valid append (dot-path) with matching balance succeeds', async () => {
    await assertSucceeds(updateDoc(goal(), {
      currentAmount: 150,
      'contributions.c2': { amount: 50, date: '2026-07-12', byId: 'bob' },
      lastContributionId: 'c2',
    }));
  });

  it('forged appends are denied', async () => {
    // Arbitrary balance, no lastContributionId
    await assertFails(updateDoc(goal(), { currentAmount: 999999 }));
    // Wiping history wholesale
    await assertFails(updateDoc(goal(), { currentAmount: 0, contributions: {}, lastContributionId: 'c1' }));
    // Append attributed to someone else
    await assertFails(updateDoc(goal(), {
      currentAmount: 150,
      'contributions.c2': { amount: 50, date: '2026-07-12', byId: 'alice' },
      lastContributionId: 'c2',
    }));
    // Balance not matching the appended amount
    await assertFails(updateDoc(goal(), {
      currentAmount: 500,
      'contributions.c2': { amount: 50, date: '2026-07-12', byId: 'bob' },
      lastContributionId: 'c2',
    }));
    // Non-positive contribution
    await assertFails(updateDoc(goal(), {
      currentAmount: 100,
      'contributions.c2': { amount: 0, date: '2026-07-12', byId: 'bob' },
      lastContributionId: 'c2',
    }));
    // lastContributionId points at an existing key (would overwrite c1)
    await assertFails(updateDoc(goal(), {
      currentAmount: 150,
      'contributions.c1': { amount: 50, date: '2026-07-12', byId: 'bob' },
      lastContributionId: 'c1',
    }));
    // Touching two entries at once
    await assertFails(updateDoc(goal(), {
      currentAmount: 200,
      'contributions.c2': { amount: 50, date: '2026-07-12', byId: 'bob' },
      'contributions.c3': { amount: 50, date: '2026-07-12', byId: 'bob' },
      lastContributionId: 'c2',
    }));
    // Contribution to a private goal
    const priv = doc(ctx('bob', 'bob@x.com'), 'savingsGoals', 'alice', 'goals', 'goal-private');
    await assertFails(updateDoc(priv, {
      currentAmount: 50,
      'contributions.c2': { amount: 50, date: '2026-07-12', byId: 'bob' },
      lastContributionId: 'c2',
    }));
  });

  it('a member may roll back only their OWN contribution', async () => {
    // Seed one of bob's own contributions to reverse
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(doc(c.firestore(), 'savingsGoals', 'alice', 'goals', 'goal-open'), {
        'contributions.cb': { amount: 40, date: '2026-07-10', byId: 'bob' },
        currentAmount: 140,
      });
    });
    // bob removes his own entry, balance drops by 40
    await assertSucceeds(updateDoc(goal(), {
      currentAmount: 100,
      'contributions.cb': deleteField(),
      lastContributionId: 'cb',
    }));
  });

  it('a member cannot roll back someone else contribution', async () => {
    // c1 belongs to alice — bob must not be able to remove it
    await assertFails(updateDoc(goal(), {
      currentAmount: 0,
      'contributions.c1': deleteField(),
      lastContributionId: 'c1',
    }));
  });

  it('two concurrent appends both survive (no lost update)', async () => {
    // Simulated sequentially, but each targets a distinct key — the app uses
    // runTransaction so the second read sees the first write.
    await assertSucceeds(updateDoc(goal(), {
      currentAmount: 150,
      'contributions.cx': { amount: 50, date: '2026-07-12', byId: 'bob' },
      lastContributionId: 'cx',
    }));
    await assertSucceeds(updateDoc(goal(), {
      currentAmount: 180,
      'contributions.cy': { amount: 30, date: '2026-07-12', byId: 'bob' },
      lastContributionId: 'cy',
    }));
    const snap = await getDoc(goal());
    const contribs = snap.data()!.contributions as Record<string, unknown>;
    // c1 (alice) + cx + cy all present
    if (!('c1' in contribs && 'cx' in contribs && 'cy' in contribs)) {
      throw new Error('expected all three contributions to survive');
    }
  });

  it('owner keeps full control of their own goal', async () => {
    const own = doc(ctx('alice', 'alice@x.com'), 'savingsGoals', 'alice', 'goals', 'goal-open');
    await assertSucceeds(updateDoc(own, { currentAmount: 0, contributions: {} }));
  });
});
