'use client';

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { setEmailVerified } from '@/features/auth/store/authSlice';
import { refreshEmailVerification, sendVerificationEmail } from '@/features/auth/services/authService';
import { useT } from '@/shared/hooks/useT';

export function VerifyEmailBanner() {
  const { user, emailVerified } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!user || emailVerified) return null;

  async function verify(check: boolean) {
    setBusy(true);
    setMessage('');
    try {
      if (check) {
        const verified = await refreshEmailVerification();
        if (verified) dispatch(setEmailVerified(true));
        else setMessage(t('auth.verifyPending'));
      } else {
        await sendVerificationEmail();
        setMessage(t('auth.verifySent'));
      }
    } catch { setMessage(t('auth.verifyError')); }
    finally { setBusy(false); }
  }

  return <section className="mx-4 mt-3 rounded-xl border border-border bg-card p-4 text-sm" aria-label={t('auth.verifyTitle')}>
    <p className="font-semibold">{t('auth.verifyTitle')}</p>
    <p className="mt-1 text-muted-foreground">{t('auth.verifyDescription')}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <button disabled={busy} onClick={() => void verify(false)} className="min-h-11 rounded-lg bg-primary px-3 text-primary-foreground disabled:opacity-50">{t('auth.verifySend')}</button>
      <button disabled={busy} onClick={() => void verify(true)} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-50">{t('auth.verifyCheck')}</button>
    </div>
    {message && <p role="status" className="mt-2">{message}</p>}
  </section>;
}
