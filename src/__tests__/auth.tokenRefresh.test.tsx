/**
 * onIdTokenChanged fires on every hourly refresh and on every getIdToken(true).
 * Those change claims, not the profile: the same signed-in User must not
 * reload the profile and every category again — only emailVerified moves.
 * A failed load must still be retried by the next token event.
 */
import { act, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, expect, it, vi } from 'vitest';

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

beforeEach(() => {
  store.dispatch(setUser(null));
  m.auth.currentUser = null;
  m.getDoc.mockReset().mockResolvedValue(profile);
  m.seed.mockReset().mockResolvedValue({ expense: [], income: [], expenseFolders: [], incomeFolders: [] });
});

async function signIn(user: FirebaseUser) {
  await act(async () => {
    m.auth.currentUser = user;
    await m.callback!(user);
  });
}

it('a token refresh of the same user only updates emailVerified', async () => {
  const view = render(<Provider store={store}><AuthProvider><div /></AuthProvider></Provider>);
  const user = { uid: 'A', email: 'a@example.test', emailVerified: false };
  await signIn(user);
  expect(store.getState().auth.user?.id).toBe('A');
  expect(store.getState().auth.emailVerified).toBe(false);

  user.emailVerified = true; // what user.reload() does in place
  await signIn(user);

  expect(m.getDoc).toHaveBeenCalledTimes(1);
  expect(m.seed).toHaveBeenCalledTimes(1);
  expect(store.getState().auth.emailVerified).toBe(true);
  view.unmount();
});

it('a new sign-in (new User object) loads the profile again', async () => {
  const view = render(<Provider store={store}><AuthProvider><div /></AuthProvider></Provider>);
  await signIn({ uid: 'A', email: 'a@example.test', emailVerified: true });
  await signIn({ uid: 'A', email: 'a@example.test', emailVerified: true });
  expect(m.getDoc).toHaveBeenCalledTimes(2);
  view.unmount();
});

it('the next token event retries a load that failed', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  m.getDoc.mockRejectedValueOnce(new Error('unavailable'));
  const view = render(<Provider store={store}><AuthProvider><div /></AuthProvider></Provider>);
  const user = { uid: 'A', email: 'a@example.test', emailVerified: true };
  await signIn(user);
  expect(store.getState().auth.user).toBeNull();

  await signIn(user);
  expect(m.getDoc).toHaveBeenCalledTimes(2);
  expect(store.getState().auth.user?.id).toBe('A');
  view.unmount();
});
