/**
 * Self-service account deletion. The order is the contract: a family owner
 * with members is refused BEFORE anything is deleted, Siri tokens go first,
 * the Auth user last (so a failed run can be repeated with the same token),
 * and other members' goals keep the money but lose the leaver's name.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { delete: () => '<delete>', arrayRemove: (v: string) => `<arrayRemove ${v}>` },
}));
const admin = vi.hoisted(() => ({ verifyIdToken: vi.fn(), db: null as unknown, auth: null as unknown }));
vi.mock('@/shared/lib/firebaseAdmin', () => ({
  getAdminDb: () => admin.db,
  getAdminAuth: () => ({ verifyIdToken: admin.verifyIdToken }),
}));
const report = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/serverMonitoring', () => ({ reportServerFailure: report }));

import {
  AccountDeletionBlockedError, DELETED_MEMBER_ID, USER_DATA_ROOTS, deleteAccount,
} from '@/features/account/accountDeletion';
import { clearLocalAccountData } from '@/features/account/deleteAccountClient';

type Doc = Record<string, unknown>;

function fakeStore(docs: Record<string, Doc>) {
  const log: string[] = [];
  const snap = (path: string) => ({
    exists: path in docs, data: () => docs[path], id: path.split('/').pop(),
    ref: ref(path),
  });
  function ref(path: string) {
    return {
      path,
      get: async () => snap(path),
      update: async (patch: Doc) => { log.push(`update ${path} ${JSON.stringify(patch)}`); },
      delete: async () => { log.push(`delete ${path}`); delete docs[path]; },
    };
  }
  const query = (col: string, field?: string, value?: unknown) => ({
    where: (f: string, _op: string, v: unknown) => query(col, f, v),
    get: async () => ({
      docs: Object.keys(docs)
        .filter((p) => p.startsWith(`${col}/`) && p.split('/').length === col.split('/').length + 1)
        .filter((p) => field === undefined || docs[p][field] === value)
        .map(snap),
    }),
  });
  const db = {
    doc: (path: string) => ref(path),
    collection: (path: string) => ({ path, ...query(path) }),
    recursiveDelete: async (target: { path: string }) => { log.push(`recursive ${target.path}`); },
  };
  const auth = {
    getUser: vi.fn(async () => ({ email: 'Me@Example.com' })),
    deleteUser: vi.fn(async () => { log.push('auth delete'); }),
  };
  return { db, auth, log };
}

const run = (store: ReturnType<typeof fakeStore>) =>
  deleteAccount('me', { db: store.db as never, auth: store.auth as never });

describe('deleteAccount', () => {
  it('deletes tokens first, every data root, the profile, then the Auth user', async () => {
    const store = fakeStore({ 'users/me': { email: 'me@example.com' } });
    await run(store);
    const recursive = store.log.filter((l) => l.startsWith('recursive'));
    expect(recursive[0]).toBe('recursive users/me/shortcutTokens');
    for (const root of USER_DATA_ROOTS) expect(recursive).toContain(`recursive ${root}/me`);
    expect(recursive.at(-1)).toBe('recursive users/me');
    expect(store.log.at(-1)).toBe('auth delete');
  });

  it('refuses a family owner with members before touching anything', async () => {
    const store = fakeStore({
      'users/me': { familyId: 'f1' },
      'families/f1': { ownerId: 'me', memberIds: ['me', 'ann'] },
    });
    await expect(run(store)).rejects.toBeInstanceOf(AccountDeletionBlockedError);
    expect(store.log).toEqual([]);
    expect(store.auth.deleteUser).not.toHaveBeenCalled();
  });

  it('a member leaves the family and is unnamed in the others\' goals', async () => {
    const store = fakeStore({
      'users/me': { familyId: 'f1' },
      'families/f1': { ownerId: 'ann', memberIds: ['ann', 'me'] },
      'savingsGoals/ann/goals/trip': { contributions: {
        c1: { amount: 50, byId: 'me', byName: 'Me' }, c2: { amount: 10, byId: 'ann' },
      } },
      'savingsGoals/ann/goals/legacy': { contributions: [{ amount: 5, byId: 'me', byName: 'Me' }, { amount: 7 }] },
      'savingsGoals/ann/goals/untouched': { contributions: { c3: { amount: 1, byId: 'ann' } } },
    });
    await run(store);
    expect(store.log).toContain(`update savingsGoals/ann/goals/trip ${JSON.stringify({
      'contributions.c1.byId': DELETED_MEMBER_ID, 'contributions.c1.byName': '<delete>',
    })}`);
    expect(store.log).toContain(`update savingsGoals/ann/goals/legacy ${JSON.stringify({
      contributions: [{ amount: 5, byId: DELETED_MEMBER_ID }, { amount: 7 }],
    })}`);
    expect(store.log.some((l) => l.includes('goals/untouched'))).toBe(false);
    expect(store.log).toContain(`update families/f1 ${JSON.stringify({ memberIds: '<arrayRemove me>' })}`);
    expect(store.log.indexOf(`update families/f1 ${JSON.stringify({ memberIds: '<arrayRemove me>' })}`))
      .toBeLessThan(store.log.indexOf('auth delete'));
  });

  it('a sole owner deletes the family and its invites, plus invites from and to them', async () => {
    const store = fakeStore({
      'users/me': { familyId: 'f1' },
      'families/f1': { ownerId: 'me', memberIds: ['me'] },
      'invites/f1_x@y.z': { familyId: 'f1', fromUserId: 'me', toEmail: 'x@y.z' },
      'invites/f9_me@example.com': { familyId: 'f9', fromUserId: 'zoe', toEmail: 'me@example.com' },
      'invites/f9_other@y.z': { familyId: 'f9', fromUserId: 'zoe', toEmail: 'other@y.z' },
    });
    await run(store);
    expect(store.log).toContain('delete families/f1');
    expect(store.log).toContain('delete invites/f1_x@y.z');
    expect(store.log).toContain('delete invites/f9_me@example.com');
    expect(store.log).not.toContain('delete invites/f9_other@y.z');
  });

  it('can be repeated after the Auth user is already gone', async () => {
    const store = fakeStore({});
    store.auth.getUser.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/user-not-found' }));
    store.auth.deleteUser.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/user-not-found' }));
    await expect(run(store)).resolves.toBeUndefined();
  });
});

describe('POST /api/account/delete', () => {
  const NOW = Date.parse('2026-10-11T12:00:00Z');
  const call = async (header?: string) => {
    const { POST } = await import('@/app/api/account/delete/route');
    return POST(new Request('http://x/api/account/delete', {
      method: 'POST', headers: header ? { authorization: header } : {},
    }));
  };

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    admin.verifyIdToken.mockReset();
    report.mockReset();
    const store = fakeStore({ 'users/u1': {} });
    admin.db = store.db;
    (store.auth as unknown as { verifyIdToken: unknown }).verifyIdToken = admin.verifyIdToken;
  });

  it('rejects a missing or invalid token', async () => {
    expect((await call()).status).toBe(401);
    admin.verifyIdToken.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/id-token-revoked' }));
    expect((await call('Bearer t')).status).toBe(401);
    expect(admin.verifyIdToken).toHaveBeenCalledWith('t', true);
  });

  it('requires a sign-in from the last five minutes', async () => {
    admin.verifyIdToken.mockResolvedValueOnce({ uid: 'u1', auth_time: (NOW - 6 * 60_000) / 1000 });
    const res = await call('Bearer t');
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('reauth_required');
  });

  it('reports infrastructure failures without blaming the user', async () => {
    admin.verifyIdToken.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'app/network-error' }));
    expect((await call('Bearer t')).status).toBe(503);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ route: 'account_delete', stage: 'auth' }));
  });
});

describe('clearLocalAccountData', () => {
  it('removes only keys carrying the uid', () => {
    const data = new Map([['budget_uid123', '1'], ['suggestionMemory_v2_uid123', '2'], ['ui.theme', 'mist'], ['budget_other', '3']]);
    const storage = {
      get length() { return data.size; },
      key: (i: number) => [...data.keys()][i] ?? null,
      removeItem: (k: string) => { data.delete(k); },
    };
    clearLocalAccountData('uid123', storage);
    expect([...data.keys()]).toEqual(['ui.theme', 'budget_other']);
  });
});
