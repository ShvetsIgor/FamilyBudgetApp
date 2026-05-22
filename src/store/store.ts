import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from '@/features/auth/store/authSlice';
import uiReducer from '@/features/ui/store/uiSlice';
import categoriesReducer from '@/features/categories/store/categoriesSlice';
import expensesReducer from '@/features/expenses/store/expensesSlice';
import incomeReducer from '@/features/income/store/incomeSlice';
import recurringReducer from '@/features/recurring/store/recurringSlice';
import savingsReducer from '@/features/savings/store/savingsSlice';
import familyReducer from '@/features/family/store/familySlice';
import budgetReducer from '@/features/budget/store/budgetSlice';
import quickAddReducer from '@/features/quickadd/store/quickAddSlice';
import draftReducer from '@/features/expenses/store/draftSlice';
import suggestionMemoryReducer from '@/features/expenses/store/suggestionMemorySlice';
import chatReducer from '@/features/chat/store/chatSlice';
import storeProfilesReducer from '@/features/chat/store/storeProfilesSlice';
import notificationsReducer from '@/features/notifications/store/notificationsSlice';

export const store = configureStore({
  reducer: {
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
    draft: draftReducer,
    suggestionMemory: suggestionMemoryReducer,
    chat: chatReducer,
    storeProfiles: storeProfilesReducer,
    notifications: notificationsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/setUser'],
        ignoredPaths: ['auth.user'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
