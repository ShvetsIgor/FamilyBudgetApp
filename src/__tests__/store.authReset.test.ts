/**
 * Logging out wipes account data — that is the isolation boundary between two
 * accounts in one browser. Theme, dark mode and language are device choices
 * (they are made on the sign-in screen itself) and must survive it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { setCategories } from '@/features/categories/store/categoriesSlice';
import { setLanguage, setTheme, setDarkMode, setBudgetMonthlyLimit } from '@/features/ui/store/uiSlice';
import type { Category, UserProfile } from '@/shared/types';

const user: UserProfile = {
  id: 'u1', name: 'A', email: 'a@x.com', currency: 'ILS', language: 'en',
  theme: 'mist', accountType: 'personal', createdAt: undefined as never,
};
const cat: Category = {
  id: 'c1', userId: 'u1', name: 'Groceries', icon: 'cart', color: '#E07A5F',
  type: 'expense', order: 0, isPrivate: false,
};

beforeEach(() => {
  store.dispatch(setUser(user));
  store.dispatch(setCategories({ type: 'expense', categories: [cat] }));
  store.dispatch(setLanguage('ru'));
  store.dispatch(setTheme('press'));
  store.dispatch(setDarkMode(true));
  store.dispatch(setBudgetMonthlyLimit(7000));
});

describe('auth reset', () => {
  it('drops account data when auth resolves to nobody', () => {
    store.dispatch(setUser(null));
    const state = store.getState();
    expect(state.categories.expense).toEqual([]);
    expect(state.auth.user).toBeNull();
    // Budget limits belong to the account, not the device
    expect(state.ui.budgetMonthlyLimit).not.toBe(7000);
  });

  it('keeps the device display preferences', () => {
    store.dispatch(setUser(null));
    const { ui } = store.getState();
    expect(ui.language).toBe('ru');
    expect(ui.theme).toBe('press');
    expect(ui.isDarkMode).toBe(true);
  });
});
