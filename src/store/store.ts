import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector, useStore } from 'react-redux';
import authReducer, { clearAuth, setUser } from '@/features/auth/store/authSlice';
import uiReducer from '@/features/ui/store/uiSlice';
import categoriesReducer from '@/features/categories/store/categoriesSlice';
import expensesReducer from '@/features/expenses/store/expensesSlice';
import incomeReducer from '@/features/income/store/incomeSlice';
import recurringReducer from '@/features/recurring/store/recurringSlice';
import savingsReducer from '@/features/savings/store/savingsSlice';
import familyReducer from '@/features/family/store/familySlice';
import budgetReducer from '@/features/budget/store/budgetSlice';
import quickAddReducer from '@/features/quickadd/store/quickAddSlice';
import suggestionMemoryReducer from '@/features/expenses/store/suggestionMemorySlice';
import chatReducer from '@/features/chat/store/chatSlice';
import notificationsReducer from '@/features/notifications/store/notificationsSlice';

const appReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  categories: categoriesReducer,
  expenses: expensesReducer,
  income: incomeReducer,
  recurring: recurringReducer,
  savings: savingsReducer,
  family: familyReducer,
  budget: budgetReducer,
  quickAdd: quickAddReducer,
  suggestionMemory: suggestionMemoryReducer,
  chat: chatReducer,
  notifications: notificationsReducer,
});

const rootReducer: typeof appReducer = (state, action) => {
  const payload = 'payload' in action ? action.payload : undefined;
  const shouldResetAppState =
    action.type === clearAuth.type ||
    (action.type === setUser.type && payload === null);

  if (!shouldResetAppState) return appReducer(state, action);

  // Everything account-scoped is dropped, so user A's data can never surface
  // for user B. Theme, dark mode and language are device preferences, not
  // account data: they are chosen on the sign-in screen itself and must
  // survive the reset that fires when auth resolves to «nobody».
  const fresh = appReducer(undefined, action);
  const previousUi = state?.ui;
  if (!previousUi) return fresh;
  return {
    ...fresh,
    ui: {
      ...fresh.ui,
      theme: previousUi.theme,
      isDarkMode: previousUi.isDarkMode,
      language: previousUi.language,
    },
  };
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/setUser'],
        ignoredPaths: ['auth.user'],
      },
    }),
});

export type RootState = ReturnType<typeof appReducer>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppStore = () => useStore<RootState>();
