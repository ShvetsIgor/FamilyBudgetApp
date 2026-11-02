import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { UserProfile } from '@/shared/types';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  emailVerified: boolean;
  sessionVersion: number;
  /** Signed in, but the profile could not be loaded yet (no network, no cache). NOT signed out. */
  sessionLoadFailed: boolean;
}

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
  initialized: false,
  emailVerified: false,
  sessionVersion: 0,
  sessionLoadFailed: false,
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
      state.sessionLoadFailed = false;
    },
    setSessionLoadFailed(state) {
      state.sessionLoadFailed = true;
      state.loading = false;
      state.initialized = true;
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

export const { beginSession, setUser, setSessionLoadFailed, setEmailVerified, setLoading, setError, clearAuth } = authSlice.actions;
export default authSlice.reducer;
