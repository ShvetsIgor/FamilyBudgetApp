'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/shared/hooks/useT';
import { useAppSelector } from '@/store/store';
import { hasPasswordProvider } from '@/features/auth/services/authService';
import { deleteMyAccount, type DeleteAccountError } from './deleteAccountClient';

/**
 * Self-service account deletion. Irreversible, so it asks for three things:
 * the user reads what goes, types the confirmation word, and proves who they
 * are again (password, or the Google popup for Google-only accounts).
 */
export function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const family = useAppSelector((s) => s.family.family);
  const usesPassword = hasPasswordProvider();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const word = t('account.delete.confirmWord');
  // An owner with members must dissolve the family first; the server refuses too
  const ownsSharedFamily = !!family && family.ownerId === userId && family.memberIds.some((id) => id !== userId);
  const canSubmit = !busy && !ownsSharedFamily
    && confirmText.trim().toLocaleUpperCase() === word.toLocaleUpperCase()
    && (!usesPassword || password.length > 0);

  const errorText = (reason: DeleteAccountError) => ({
    'wrong-password': t('account.password.wrongCurrent'),
    'too-many-requests': t('account.password.tooManyAttempts'),
    'reauth-cancelled': t('account.delete.reauthCancelled'),
    family_owner: t('account.delete.familyOwner'),
    reauth_required: t('account.delete.reauthCancelled'),
    unavailable: t('account.delete.failed'),
  }[reason]);

  async function handleDelete() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    const result = await deleteMyAccount(password);
    // On success the auth listener resets the app and routes to sign-in
    if (!result.ok) {
      setError(errorText(result.reason));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/40 lg:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('account.delete.title')}
        className="fb-sheet-enter max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl bg-background p-5 lg:rounded-3xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-destructive">{t('account.delete.title')}</h2>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label={t('common.close')}
            className="fb-touch-target flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <p>{t('account.delete.what')}</p>
          <p className="text-muted-foreground">{t('account.delete.familyNote')}</p>
          <p className="font-semibold">{t('account.delete.exportHint')}</p>

          {ownsSharedFamily ? (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 font-semibold text-destructive">
              {t('account.delete.familyOwner')}
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-muted-foreground">
                  {t('account.delete.typeWord', { word })}
                </span>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="min-h-11 rounded-xl border border-border bg-background px-3 text-base font-semibold outline-hidden focus:border-destructive"
                />
              </label>
              {usesPassword ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-muted-foreground">
                    {t('account.password.current')}
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="min-h-11 rounded-xl border border-border bg-background px-3 text-base font-semibold outline-hidden focus:border-destructive"
                  />
                </label>
              ) : (
                <p className="text-muted-foreground">{t('account.delete.googleHint')}</p>
              )}

              {error && (
                <p role="alert" aria-live="assertive" className="font-semibold text-destructive">{error}</p>
              )}

              <button
                onClick={handleDelete}
                disabled={!canSubmit}
                className="mt-1 min-h-11 rounded-2xl bg-destructive text-sm font-bold text-white disabled:opacity-40"
              >
                {busy ? t('account.delete.deleting') : t('account.delete.submit')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
