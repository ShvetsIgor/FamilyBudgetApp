import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { UserProfile } from '@/shared/types';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  emailVerified: boolean;
  sessionVersion: number;
}

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
  initialized: false,
  emailVerified: false,
  sessionVersion: 0,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    beginSession() { return { ...initialState }; },
    setUser(state, action: PayloadAction<UserProfile | null>) {
      state.user = action.payload;
      state.loading = false;
      state.initialized = true;
      state.error = null;
    },
    setEmailVerified(state, action: PayloadAction<boolean>) {
      state.emailVerified = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },
    clearAuth(state) {
      state.user = null;
      state.loading = false;
      state.error = null;
    },
  },
});

export const { beginSession, setUser, setEmailVerified, setLoading, setError, clearAuth } = authSlice.actions;
export default authSlice.reducer;
