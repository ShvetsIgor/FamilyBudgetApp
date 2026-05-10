'use client';

import { useEffect } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useAppSelector } from '@/store/store';
import { sendNotification } from '@/shared/hooks/useNotifications';

const STORAGE_KEY = 'notified_recurring';
const NOTIFY_DAYS_AHEAD = 2;

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getNotifiedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const todayKey = getTodayKey();
    return new Set(parsed[todayKey] ?? []);
  } catch {
    return new Set();
  }
}

function markNotified(id: string): void {
  try {
    const todayKey = getTodayKey();
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    // Keep only today (prune old days)
    const fresh: Record<string, string[]> = { [todayKey]: [...(parsed[todayKey] ?? []), id] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // ignore
  }
}

export function useRecurringNotifications() {
  const items = useAppSelector((s) => s.recurring.list);

  useEffect(() => {
    if (!items.length) return;
    if (typeof window === 'undefined' || Notification.permission !== 'granted') return;

    const notified = getNotifiedSet();
    const today = new Date();

    for (const item of items) {
      if (notified.has(item.id)) continue;

      const due = parseISO(item.nextDueDate);
      const daysUntil = differenceInCalendarDays(due, today);

      if (daysUntil < 0 || daysUntil > NOTIFY_DAYS_AHEAD) continue;

      const label = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`;
      sendNotification(
        `💳 ${item.name}`,
        `${label}: ${item.amount} ${item.currency}`,
        item.id,
      );
      markNotified(item.id);
    }
  }, [items]);
}
