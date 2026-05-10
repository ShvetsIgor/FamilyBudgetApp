import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SerializableIncome } from '@/shared/types';

interface IncomeState {
  list: SerializableIncome[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: IncomeState = { list: [], status: 'idle' };

const incomeSlice = createSlice({
  name: 'income',
  initialState,
  reducers: {
    setIncome(state, action: PayloadAction<SerializableIncome[]>) {
      state.list = action.payload;
      state.status = 'ready';
    },
    prependIncome(state, action: PayloadAction<SerializableIncome>) {
      state.list.unshift(action.payload);
    },
    removeIncome(state, action: PayloadAction<string>) {
      state.list = state.list.filter((i) => i.id !== action.payload);
    },
    setIncomeStatus(state, action: PayloadAction<IncomeState['status']>) {
      state.status = action.payload;
    },
  },
});

export const { setIncome, prependIncome, removeIncome, setIncomeStatus } = incomeSlice.actions;
export default incomeSlice.reducer;
