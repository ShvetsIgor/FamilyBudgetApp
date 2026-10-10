/**
 * A refused payment used to fail in silence: the button just stopped working.
 * The person must be told why — and what to do for a template without category.
 */
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const pay = vi.hoisted(() => vi.fn());
vi.mock('@/features/recurring/services/recurringService', () => ({
  payRecurringOccurrence: pay,
  advanceToNextFutureDue: vi.fn(), completeRecurring: vi.fn(), deleteRecurring: vi.fn(), toggleRecurring: vi.fn(),
}));

import { store } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { useRecurringActions } from '@/features/recurring/hooks/useRecurringActions';
import { makeT } from '@/shared/utils/makeT';
import type { SerializableRecurringPayment, UserProfile } from '@/shared/types';

const user = { id: 'bob', name: 'Bob', email: 'b@x.com', currency: 'ILS', language: 'en' } as UserProfile;
const item = {
  id: 'r1', userId: 'bob', name: 'Netflix', amount: 45, currency: 'ILS', categoryId: '', frequency: 'monthly',
  startDate: '2026-06-10T09:00:00.000Z', nextDueDate: '2026-09-10T09:00:00.000Z', type: 'subscription',
  reminderDays: 1, isActive: true,
} as SerializableRecurringPayment;

let alert: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  store.dispatch(setUser(user));
  alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); pay.mockReset(); });

function renderActions() {
  return renderHook(() => useRecurringActions(), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  }).result;
}

it('explains that a template without category needs one before it can be paid', async () => {
  pay.mockRejectedValue(new Error('recurring-category-required'));
  const actions = renderActions();
  let ok: boolean | undefined;
  await act(async () => { ok = await actions.current.markPaid(item); });
  expect(ok).toBe(false);
  const t = makeT(store.getState().ui.language);
  expect(alert).toHaveBeenCalledWith(t('recurring.payNeedsCategory'));
});

it('reports any other failure instead of doing nothing', async () => {
  pay.mockRejectedValue(new Error('unavailable'));
  const actions = renderActions();
  let ok: boolean | undefined;
  await act(async () => { ok = await actions.current.markPaid(item); });
  expect(ok).toBe(false);
  expect(alert).toHaveBeenCalledWith(makeT(store.getState().ui.language)('common.error'));
});
