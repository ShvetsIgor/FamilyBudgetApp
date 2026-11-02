/**
 * A failed profile read says nothing about the session: a signed-in user must
 * not be reported as signed out (the app would show the login form). The load
 * is retried on a growing delay and at once when the network returns.
 */
import { act, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type FirebaseUser = { uid: string; email: string; emailVerified: boolean };
const m = vi.hoisted(() => ({
  callback: null as ((user: FirebaseUser | null) => Promise<void>) | null,
  auth: { currentUser: null as FirebaseUser | null },
  getDoc: vi.fn(),
  seed: vi.fn(),
}));

vi.mock('firebase/auth', () => ({ onIdTokenChanged: (_: unknown, cb: typeof m.callback) => { m.callback = cb; return () => {}; } }));
vi.mock('firebase/firestore', () => ({
  doc: (_: unknown, ...parts: string[]) => parts.join('/'),
  getDoc: m.getDoc,
  onSnapshot: () => () => {},
}));
vi.mock('@/shared/lib/firebase', () => ({ getFirebaseAuth: () => m.auth, getDb: () => ({}), isFirebaseConfigured: () => true }));
vi.mock('@/features/categories/services/categoriesService', () => ({ seedDefaultCategories: m.seed }));

import { AuthProvider } from '@/features/auth/components/AuthProvider';
import { store } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';

const profile = { exists: () => true, data: () => ({ currency: 'ILS', language: 'en' }) };
const offline = () => Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' });
const user = { uid: 'A', email: 'a@example.test', emailVerified: true };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  store.dispatch(setUser(null));
  m.auth.currentUser = null;
  m.getDoc.mockReset();
  m.seed.mockReset().mockResolvedValue({ expense: [], income: [], expenseFolders: [], incomeFolders: [] });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function signIn(who: FirebaseUser | null) {
  await act(async () => {
    m.auth.currentUser = who;
    await m.callback!(who);
  });
}
const mount = () => render(<Provider store={store}><AuthProvider><div /></AuthProvider></Provider>);
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

it('reports a failed load as such, never as signed out, and keeps retrying with a growing delay', async () => {
  const view = mount();
  m.getDoc.mockRejectedValue(offline());
  await signIn(user);
  expect(store.getState().auth).toMatchObject({ user: null, initialized: true, sessionLoadFailed: true });
  expect(m.getDoc).toHaveBeenCalledTimes(1);

  await advance(2_999);
  expect(m.getDoc).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(m.getDoc).toHaveBeenCalledTimes(2);
  // The screen stays up between attempts instead of flashing the loader
  expect(store.getState().auth.sessionLoadFailed).toBe(true);
  expect(store.getState().auth.initialized).toBe(true);

  await advance(5_999);
  expect(m.getDoc).toHaveBeenCalledTimes(2);
  await advance(1);
  expect(m.getDoc).toHaveBeenCalledTimes(3);

  m.getDoc.mockResolvedValue(profile);
  await advance(12_000);
  expect(store.getState().auth).toMatchObject({ sessionLoadFailed: false });
  expect(store.getState().auth.user?.id).toBe('A');
  const reads = m.getDoc.mock.calls.length;
  await advance(120_000);
  expect(m.getDoc).toHaveBeenCalledTimes(reads); // recovered: nothing is scheduled any more
  view.unmount();
});

it('retries at once when the network comes back', async () => {
  const view = mount();
  m.getDoc.mockRejectedValueOnce(offline()).mockResolvedValue(profile);
  await signIn(user);
  expect(store.getState().auth.user).toBeNull();
  await act(async () => { window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0); });
  expect(store.getState().auth.user?.id).toBe('A');
  view.unmount();
});

it('signing out stops the retries and really reports signed out', async () => {
  const view = mount();
  m.getDoc.mockRejectedValue(offline());
  await signIn(user);
  await signIn(null);
  expect(store.getState().auth).toMatchObject({ user: null, sessionLoadFailed: false, initialized: true });
  const reads = m.getDoc.mock.calls.length;
  await advance(60_000);
  expect(m.getDoc).toHaveBeenCalledTimes(reads);
  view.unmount();
});

it('stops retrying after the provider unmounts', async () => {
  const view = mount();
  m.getDoc.mockRejectedValue(offline());
  await signIn(user);
  view.unmount();
  const reads = m.getDoc.mock.calls.length;
  await advance(60_000);
  expect(m.getDoc).toHaveBeenCalledTimes(reads);
});
