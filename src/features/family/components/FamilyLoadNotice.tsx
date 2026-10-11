'use client';

import { AlertTriangle } from 'lucide-react';
import { useT } from '@/shared/hooks/useT';
import type { UserProfile } from '@/shared/types';

interface FamilyLoadNoticeProps {
  /** Members whose data could not be read; empty means everything loaded. */
  failedMemberIds: string[];
  members: UserProfile[];
  /** Nothing loaded at all — there is no partial total to warn about. */
  failedEntirely?: boolean;
  onRetry: () => void;
}

/**
 * A family total that silently skips one member reads as a real number.
 * Whenever a member's entries could not be loaded the view says so and
 * offers a retry instead of presenting the partial sum as the family's.
 */
export function FamilyLoadNotice({ failedMemberIds, members, failedEntirely = false, onRetry }: FamilyLoadNoticeProps) {
  const t = useT();
  if (!failedEntirely && failedMemberIds.length === 0) return null;
  const names = failedMemberIds
    .map((id) => members.find((m) => m.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const text = failedEntirely
    ? t('common.familyLoadFailed')
    : t('common.familyLoadPartial', { names: names.length > 0 ? names.join(', ') : '—' });
  return (
    <div
      role="alert"
      className="mx-4 my-2 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="flex-1 leading-snug">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 shrink-0 rounded-xl px-3 font-bold text-primary hover:bg-primary/10 -my-2.5"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}
