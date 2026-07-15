import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AppNotification {
  id: string;
  kind: 'morning' | 'weekly' | 'alert' | 'family_invite' | 'family' | 'subscriptions';
  title: string;
  text: string;
  data?: unknown;
  createdAt: string;
  read: boolean;
}

interface NotificationsState {
  items: AppNotification[];
  /** Per-user localStorage key; null until hydrated after login */
  storageKey: string | null;
}

const LEGACY_KEY = 'app_notifications';

function load(key: string): AppNotification[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(key: string | null, items: AppNotification[]) {
  if (!key) return;
  try {
    // Keep last 50
    localStorage.setItem(key, JSON.stringify(items.slice(0, 50)));
  } catch {}
}

const initialState: NotificationsState = {
  items: [],
  storageKey: null,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /**
     * Loads the signed-in user's notifications. Storage is per-user so two
     * accounts on one device never see each other's bell items.
     */
    hydrateNotifications(state, action: PayloadAction<string>) {
      const key = `app_notifications_${action.payload}`;
      try {
        // One-time migration of the old shared key to this user
        if (!localStorage.getItem(key) && localStorage.getItem(LEGACY_KEY)) {
          localStorage.setItem(key, localStorage.getItem(LEGACY_KEY)!);
          localStorage.removeItem(LEGACY_KEY);
        }
      } catch {}
      state.storageKey = key;
      state.items = load(key);
    },
    addNotification(
      state,
      action: PayloadAction<Omit<AppNotification, 'id' | 'read'> & { dedupeUnreadKind?: boolean }>,
    ) {
      const { dedupeUnreadKind, ...payload } = action.payload;
      if (dedupeUnreadKind && state.items.some((n) => n.kind === payload.kind && !n.read)) return;
      const item: AppNotification = {
        ...payload,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        read: false,
      };
      state.items.unshift(item);
      save(state.storageKey, state.items);
    },
    markRead(state, action: PayloadAction<string>) {
      const item = state.items.find((n) => n.id === action.payload);
      if (item) { item.read = true; save(state.storageKey, state.items); }
    },
    markAllRead(state) {
      state.items.forEach((n) => { n.read = true; });
      save(state.storageKey, state.items);
    },
    clearNotifications(state) {
      state.items = [];
      save(state.storageKey, state.items);
    },
  },
});

export const { hydrateNotifications, addNotification, markRead, markAllRead, clearNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
