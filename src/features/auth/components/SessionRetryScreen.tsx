'use client';

import { WifiOff } from 'lucide-react';
import { signOut } from '@/features/auth/services/authService';
import { useT } from '@/shared/hooks/useT';

/**
 * Signed in, but the account could not be loaded (no network and nothing in
 * the local cache). AuthProvider keeps retrying behind this screen; a login
 * form here would tell the user they lost a session they still have.
 */
export function SessionRetryScreen() {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div role="alert" className="flex w-full max-w-xs flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary/10 text-primary">
          <WifiOff size={28} strokeWidth={2} aria-hidden />
        </span>
        <p className="text-[17px] font-extrabold">{t('auth.sessionRetry.title')}</p>
        <p className="text-sm text-muted-foreground">{t('auth.sessionRetry.text')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 min-h-11 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground"
        >
          {t('common.retry')}
        </button>
        <button
          type="button"
          onClick={() => { void signOut(); }}
          className="min-h-11 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          {t('account.signOut')}
        </button>
      </div>
    </div>
  );
}
