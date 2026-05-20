'use client';
import { useAppSelector } from '@/store/store';

export function usePanelPriority(): string[] {
  const messages = useAppSelector((s) => s.chat?.messages ?? []);
  if (messages.length === 0) return ['firstSteps', 'cheatSheet'];
  return ['today', 'envelopes', 'goals', 'bills'];
}
