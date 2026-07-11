/**
 * Account isolation of localStorage caches: budget preferences (uiSlice) and
 * suggestion memory must not leak between two accounts in one browser.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import uiReducer, { hydrateBudgetPreferences, setBudgetMode } from '@/features/ui/store/uiSlice';
import memoryReducer, {
  hydrateSuggestionMemory,
  recordExpense,
  suggestionMemoryStorageKey,
} from '@/features/expenses/store/suggestionMemorySlice';

const uiInitial = () => uiReducer(undefined, { type: '@@INIT' });
const memInitial = () => memoryReducer(undefined, { type: '@@INIT' });

beforeEach(() => localStorage.clear());

describe('budget preferences per account', () => {
  it('first login claims legacy global keys and removes them', () => {
    localStorage.setItem('budgetMode', 'monthly');
    localStorage.setItem('budgetMonthlyLimit', '9000');
    localStorage.setItem('budgetByMonth', JSON.stringify({ '2026-06': { mode: 'monthly', dailyLimit: 0, monthlyLimit: 8000 } }));

    const a = uiReducer(uiInitial(), hydrateBudgetPreferences({ uid: 'userA' }));
    expect(a.budgetMode).toBe('monthly');
    expect(a.budgetMonthlyLimit).toBe(9000);
    expect(a.budgetByMonth['2026-06']?.monthlyLimit).toBe(8000);
    // legacy keys are gone, per-uid keys exist
    expect(localStorage.getItem('budgetMode')).toBeNull();
    expect(localStorage.getItem('budgetByMonth')).toBeNull();
    expect(localStorage.getItem('budgetMode_userA')).toBe('monthly');
  });

  it('second account does not inherit the first account settings', () => {
    localStorage.setItem('budgetMode', 'monthly');
    localStorage.setItem('budgetMonthlyLimit', '9000');
    uiReducer(uiInitial(), hydrateBudgetPreferences({ uid: 'userA' }));

    // logout resets Redux; user B hydrates fresh
    const b = uiReducer(uiInitial(), hydrateBudgetPreferences({ uid: 'userB' }));
    expect(b.budgetMode).toBe('auto');
    expect(b.budgetMonthlyLimit).toBe(0);
    expect(b.budgetByMonth).toEqual({});
  });

  it('profile fields win over the local cache', () => {
    localStorage.setItem('budgetMode_userA', 'daily');
    const a = uiReducer(uiInitial(), hydrateBudgetPreferences({ uid: 'userA', budgetMode: 'monthly', budgetMonthlyLimit: 5000 }));
    expect(a.budgetMode).toBe('monthly');
    expect(a.budgetMonthlyLimit).toBe(5000);
  });

  it('writes go to the account-scoped key only', () => {
    let state = uiReducer(uiInitial(), hydrateBudgetPreferences({ uid: 'userA' }));
    state = uiReducer(state, setBudgetMode('daily'));
    expect(localStorage.getItem('budgetMode_userA')).toBe('daily');
    expect(localStorage.getItem('budgetMode')).toBeNull();
  });
});

describe('suggestion memory per account', () => {
  const legacyPayload = JSON.stringify({
    merchants: { dabbah: [{ categoryId: 'cat1', count: 3, lastUsed: '2026-07-01' }] },
    recents: [], splitCombos: [], tagAssociations: [], merchantContextStats: {},
  });

  it('first login claims the legacy key; second account starts empty', () => {
    localStorage.setItem('suggestionMemory_v2', legacyPayload);

    const a = memoryReducer(memInitial(), hydrateSuggestionMemory({ uid: 'userA' }));
    expect(a.merchants['dabbah']?.[0]?.categoryId).toBe('cat1');
    expect(localStorage.getItem('suggestionMemory_v2')).toBeNull();
    expect(localStorage.getItem(suggestionMemoryStorageKey('userA'))).not.toBeNull();

    const b = memoryReducer(memInitial(), hydrateSuggestionMemory({ uid: 'userB' }));
    expect(b.merchants).toEqual({});
  });

  it('recordExpense persists under the hydrated account key', () => {
    let state = memoryReducer(memInitial(), hydrateSuggestionMemory({ uid: 'userA' }));
    state = memoryReducer(state, recordExpense({ merchant: 'Coffee', categoryId: 'catC', date: '2026-07-12' }));
    const stored = JSON.parse(localStorage.getItem(suggestionMemoryStorageKey('userA')) ?? '{}');
    expect(stored.merchants['coffee']?.[0]?.categoryId).toBe('catC');
    expect(localStorage.getItem(suggestionMemoryStorageKey('userB'))).toBeNull();
  });

  it('does not persist before an account is hydrated', () => {
    memoryReducer(memInitial(), recordExpense({ merchant: 'X', categoryId: 'c', date: '2026-07-12' }));
    expect(Object.keys(localStorage).filter((k) => k.startsWith('suggestionMemory'))).toEqual([]);
  });
});
