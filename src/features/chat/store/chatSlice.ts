import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SerializableChatMessage } from '@/shared/types/message';

interface ChatState {
  messages: SerializableChatMessage[];
  typing: boolean;
  status: 'idle' | 'loading' | 'ready';
}

const chatSlice = createSlice({
  name: 'chat',
  initialState: { messages: [], typing: false, status: 'idle' } as ChatState,
  reducers: {
    setMessages(state, action: PayloadAction<SerializableChatMessage[]>) {
      state.messages = action.payload;
      state.status = 'ready';
    },
    appendMessage(state, action: PayloadAction<SerializableChatMessage>) {
      const exists = state.messages.find((m) => m.id === action.payload.id);
      if (!exists) state.messages.push(action.payload);
    },
    updateMessageInStore(state, action: PayloadAction<Partial<SerializableChatMessage> & { id: string }>) {
      const idx = state.messages.findIndex((m) => m.id === action.payload.id);
      if (idx !== -1) state.messages[idx] = { ...state.messages[idx], ...action.payload };
    },
    removeMessage(state, action: PayloadAction<string>) {
      state.messages = state.messages.filter((m) => m.id !== action.payload);
    },
    setTyping(state, action: PayloadAction<boolean>) {
      state.typing = action.payload;
    },
    setChatStatus(state, action: PayloadAction<ChatState['status']>) {
      state.status = action.payload;
    },
  },
});

export const {
  setMessages, appendMessage, updateMessageInStore,
  removeMessage, setTyping, setChatStatus,
} = chatSlice.actions;

export default chatSlice.reducer;
