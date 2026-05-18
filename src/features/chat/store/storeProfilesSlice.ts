import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { StoreProfile } from '@/shared/types';

interface StoreProfilesState {
  profiles: Record<string, StoreProfile>;
}

const initialState: StoreProfilesState = { profiles: {} };

const storeProfilesSlice = createSlice({
  name: 'storeProfiles',
  initialState,
  reducers: {
    setProfiles(state, action: PayloadAction<Record<string, StoreProfile>>) {
      state.profiles = action.payload;
    },
    upsertProfile(
      state,
      action: PayloadAction<{
        storeId: string;
        storeName: string;
        storeGroup?: string;
        subcategoryId: string;
        parentId: string;
      }>
    ) {
      const { storeId, storeName, storeGroup, subcategoryId, parentId } = action.payload;
      const now = new Date().toISOString().slice(0, 10);
      const existing = state.profiles[storeId];

      if (!existing) {
        state.profiles[storeId] = {
          id: storeId,
          name: storeName,
          ...(storeGroup ? { storeGroup } : {}),
          probableSubcategories: [{ subcategoryId, parentId, usageCount: 1, lastUsed: now }],
        };
        return;
      }

      const subs = [...existing.probableSubcategories];
      const idx = subs.findIndex((s) => s.subcategoryId === subcategoryId);
      if (idx >= 0) {
        subs[idx] = { ...subs[idx], usageCount: subs[idx].usageCount + 1, lastUsed: now };
      } else {
        subs.push({ subcategoryId, parentId, usageCount: 1, lastUsed: now });
      }
      state.profiles[storeId] = { ...existing, probableSubcategories: subs };
    },
  },
});

export const { setProfiles, upsertProfile } = storeProfilesSlice.actions;
export default storeProfilesSlice.reducer;
