'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { signInWithEmail, getUserProfile, requestPasswordReset } from '@/features/auth/services/authService';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/shared/lib/firebase';
import { GoogleButton } from './GoogleButton';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import { Eye, EyeOff } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const t = useT();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    setNotice('');

    try {
      await signInWithEmail(email, password);
      const auth = getAuth(getFirebaseApp());
      const uid = auth.currentUser?.uid;
      if (uid) {
        const profile = await getUserProfile(uid);
        dispatch(setUser(profile));
      }
      router.replace('/home');
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError(t('auth.invalidCredentials'));
      } else if (code === 'auth/user-not-found') {
        setError(t('auth.invalidCredentials'));
      } else {
        setError(t('auth.loginFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setNotice('');
      setError(t('auth.resetEmailRequired'));
      return;
    }
    setResetting(true);
    setError('');
    setNotice('');
    try {
      await requestPasswordReset(email);
      setNotice(t('auth.resetEmailSent'));
    } catch {
      setError(t('auth.resetEmailFailed'));
    } finally {
      setResetting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium text-foreground">{t('auth.email')}</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.emailPlaceholder')}
          className={cn(
            'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-hidden',
            'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
          )}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="text-sm font-medium text-foreground">{t('auth.password')}</label>
          <button type="button" onClick={handlePasswordReset} disabled={resetting} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">
            {t('auth.forgotPassword')}
          </button>
        </div>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={cn(
              'w-full rounded-xl border border-border bg-card py-3 pl-4 pr-14 text-sm outline-hidden',
              'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
            )}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="fb-touch-target absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" aria-live="polite" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className={cn(
          'w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground',
          'transition-all active:scale-[0.98] hover:opacity-90',
          loading && 'opacity-60 cursor-not-allowed'
        )}
      >
        {loading ? t('auth.signingIn') : t('auth.signIn')}
      </button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">{t('auth.or')}</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <GoogleButton />

      <p className="text-center text-sm text-muted-foreground">
        {t('auth.noAccount')}{' '}
        <Link href="/auth/register" className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-primary hover:bg-primary/5">
          {t('auth.signUpLink')}
        </Link>
      </p>
    </form>
  );
}
