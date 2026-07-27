'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { changePassword, requestPasswordReset, type ChangePasswordError } from '@/features/auth/services/authService';
import { useT } from '@/shared/hooks/useT';
import { useAppSelector } from '@/store/store';

const MIN_LENGTH = 6;

/**
 * In-app password change. Firebase needs a recent login to accept a new
 * password, so the current one is re-verified inside `changePassword` — the
 * user never has to sign out and back in.
 */
export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const email = useAppSelector((s) => s.auth.user?.email);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = repeat.length > 0 && next !== repeat;
  const canSubmit = !!current && next.length >= MIN_LENGTH && next === repeat && !busy;

  const errorText = (reason: ChangePasswordError) => ({
    'wrong-password': t('account.password.wrongCurrent'),
    'weak-password': t('account.password.tooShort', { n: MIN_LENGTH }),
    'too-many-requests': t('account.password.tooManyAttempts'),
    'no-password-provider': t('account.password.googleOnly'),
    unknown: t('account.password.failed'),
  }[reason]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    const result = await changePassword(current, next);
    if (result.ok) {
      setDone(true);
      setBusy(false);
      return;
    }
    setError(errorText(result.reason));
    setBusy(false);
  }

  async function handleForgot() {
    if (!email || resetSent) return;
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch {
      setError(t('account.password.failed'));
    }
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    autoComplete: string,
    hint?: string,
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-muted-foreground">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
      />
      {hint && <span className="text-[11px] font-semibold text-destructive">{hint}</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 lg:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('account.password.title')}
        className="fb-sheet-enter w-full max-w-[440px] rounded-t-3xl bg-background p-5 lg:rounded-3xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold">{t('account.password.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="fb-touch-target flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col gap-4">
            <p role="status" aria-live="polite" className="text-sm font-semibold text-emerald-600">
              {t('account.password.changed')}
            </p>
            <button
              onClick={onClose}
              className="min-h-11 rounded-2xl bg-primary text-sm font-bold text-primary-foreground"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {field(t('account.password.current'), current, setCurrent, 'current-password')}
            {field(
              t('account.password.new'), next, setNext, 'new-password',
              tooShort ? t('account.password.tooShort', { n: MIN_LENGTH }) : undefined,
            )}
            {field(
              t('account.password.repeat'), repeat, setRepeat, 'new-password',
              mismatch ? t('account.password.mismatch') : undefined,
            )}

            {error && (
              <p role="alert" aria-live="assertive" className="text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="mt-1 min-h-11 rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {busy ? t('common.saving') : t('account.password.submit')}
            </button>

            {/* Forgot the current one? A reset link is the way out. */}
            <button
              onClick={handleForgot}
              disabled={!email || resetSent}
              className="min-h-11 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {resetSent ? t('account.password.resetSent') : t('account.password.forgot')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
