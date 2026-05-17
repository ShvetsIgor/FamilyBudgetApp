import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AppNotification {
  id: string;
  kind: 'morning' | 'weekly' | 'alert' | 'family_invite';
  title: string;
  text: string;
  data?: unknown;
  createdAt: string;
  read: boolean;
}

interface NotificationsState {
  items: AppNotification[];
}

const STORAGE_KEY = 'app_notifications';

function load(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: AppNotification[]) {
  try {
    // Keep last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {}
}

const initialState: NotificationsState = {
  items: typeof window !== 'undefined' ? load() : [],
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<Omit<AppNotification, 'id' | 'read'>>) {
      const item: AppNotification = {
        ...action.payload,
        id: Date.now().toString(),
        read: false,
      };
      state.items.unshift(item);
      save(state.items);
    },
    markAllRead(state) {
      state.items.forEach((n) => { n.read = true; });
      save(state.items);
    },
    clearNotifications(state) {
      state.items = [];
      save(state.items);
    },
  },
});

export const { addNotification, markAllRead, clearNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
