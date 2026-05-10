import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Family, FamilyInvite, UserProfile } from '@/shared/types';

interface FamilyState {
  family: Family | null;
  members: UserProfile[];
  pendingInvite: FamilyInvite | null;
}

const initialState: FamilyState = {
  family: null,
  members: [],
  pendingInvite: null,
};

const familySlice = createSlice({
  name: 'family',
  initialState,
  reducers: {
    setFamily(state, action: PayloadAction<Family | null>) {
      state.family = action.payload;
    },
    setMembers(state, action: PayloadAction<UserProfile[]>) {
      state.members = action.payload;
    },
    setPendingInvite(state, action: PayloadAction<FamilyInvite | null>) {
      state.pendingInvite = action.payload;
    },
    clearFamily(state) {
      state.family = null;
      state.members = [];
      state.pendingInvite = null;
    },
  },
});

export const { setFamily, setMembers, setPendingInvite, clearFamily } = familySlice.actions;
export default familySlice.reducer;
