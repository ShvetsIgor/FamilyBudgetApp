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
        categoryId: string;
      }>
    ) {
      const { storeId, storeName, storeGroup, categoryId } = action.payload;
      const now = new Date().toISOString().slice(0, 10);
      const existing = state.profiles[storeId];

      if (!existing) {
        state.profiles[storeId] = {
          id: storeId,
          name: storeName,
          ...(storeGroup ? { storeGroup } : {}),
          probableCategories: [{ categoryId, usageCount: 1, lastUsed: now }],
        };
        return;
      }

      const cats = [...existing.probableCategories];
      const idx = cats.findIndex((c) => c.categoryId === categoryId);
      if (idx >= 0) {
        cats[idx] = { ...cats[idx], usageCount: cats[idx].usageCount + 1, lastUsed: now };
      } else {
        cats.push({ categoryId, usageCount: 1, lastUsed: now });
      }
      state.profiles[storeId] = { ...existing, probableCategories: cats };
    },
  },
});

export const { setProfiles, upsertProfile } = storeProfilesSlice.actions;
export default storeProfilesSlice.reducer;
