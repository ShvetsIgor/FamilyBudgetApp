import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SerializableRecurringPayment } from '@/shared/types';

interface RecurringState {
  list: SerializableRecurringPayment[];
  status: 'idle' | 'loading' | 'ready';
}

const recurringSlice = createSlice({
  name: 'recurring',
  initialState: { list: [], status: 'idle' } as RecurringState,
  reducers: {
    setRecurring(state, action: PayloadAction<SerializableRecurringPayment[]>) {
      state.list = action.payload;
      state.status = 'ready';
    },
    addRecurringItem(state, action: PayloadAction<SerializableRecurringPayment>) {
      state.list.push(action.payload);
    },
    removeRecurringItem(state, action: PayloadAction<string>) {
      state.list = state.list.filter((r) => r.id !== action.payload);
    },
    updateRecurringItem(state, action: PayloadAction<SerializableRecurringPayment>) {
      const idx = state.list.findIndex((r) => r.id === action.payload.id);
      if (idx !== -1) state.list[idx] = action.payload;
    },
    toggleRecurringItem(state, action: PayloadAction<{ id: string; isActive: boolean }>) {
      const item = state.list.find((r) => r.id === action.payload.id);
      if (item) item.isActive = action.payload.isActive;
    },
  },
});

export const { setRecurring, addRecurringItem, removeRecurringItem, updateRecurringItem, toggleRecurringItem } = recurringSlice.actions;
export default recurringSlice.reducer;
