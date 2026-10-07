import { act, render, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { expect, it, vi } from 'vitest';
type FirebaseUser = { uid: string; email: string; emailVerified: boolean };
const m = vi.hoisted(() => ({
  callback: null as ((user: FirebaseUser | null) => Promise<void>) | null,
  resolveA: null as ((value: unknown) => void) | null,
  auth: { currentUser: null as FirebaseUser | null },
}));
vi.mock('firebase/auth', () => ({ onIdTokenChanged: (_: unknown, cb: typeof m.callback) => { m.callback = cb; return () => {}; } }));
vi.mock('firebase/firestore', () => ({
  doc: (_: unknown, ...parts: string[]) => parts.join('/'),
  getDoc: (path: string) => path === 'users/A' ? new Promise(resolve => { m.resolveA = resolve; })
    : Promise.resolve({ exists: () => true, data: () => ({ id: 'B', currency: 'ILS', language: 'en' }) }),
}));
vi.mock('@/shared/lib/firebase', () => ({ getFirebaseAuth: () => m.auth, getDb: () => ({}), isFirebaseConfigured: () => true }));
vi.mock('@/features/categories/services/categoriesService', () => ({
  seedDefaultCategories: vi.fn().mockResolvedValue({ expense: [], income: [], expenseFolders: [], incomeFolders: [] }),
}));
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import { store, useAppDispatch } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
it('discards a delayed profile from an earlier signed-out session', async () => {
  store.dispatch(setUser(null));
  const view = render(<Provider store={store}><AuthProvider><div /></AuthProvider></Provider>);
  let pending: Promise<void>;
  await act(async () => {
    m.auth.currentUser = { uid: 'A', email: 'a@example.test', emailVerified: true };
    pending = m.callback!(m.auth.currentUser);
  });
  await act(async () => {
    m.auth.currentUser = null; await m.callback!(null);
    m.auth.currentUser = { uid: 'B', email: 'b@example.test', emailVerified: true };
    await m.callback!(m.auth.currentUser);
  });
  await act(async () => {
    m.resolveA!({ exists: () => true, data: () => ({ id: 'A', currency: 'USD', language: 'ru' }) });
    await pending;
  });
  expect(store.getState().auth.user?.id).toBe('B');
  expect(store.getState().ui.currency).toBe('ILS');
  view.unmount();
});

it('ignores an async dispatch captured before switching accounts', () => {
  const view = renderHook(() => useAppDispatch(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> });
  const staleDispatch = view.result.current;
  act(() => { store.dispatch(setUser(null)); });
  act(() => { staleDispatch({ type: 'income/setIncome', payload: [{ id: 'private-A' }] }); });
  expect(store.getState().income.list).toEqual([]);
  view.unmount();
});
