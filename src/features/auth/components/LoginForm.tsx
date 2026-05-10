'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { signInWithEmail, getUserProfile } from '@/features/auth/services/authService';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/shared/lib/firebase';
import { GoogleButton } from './GoogleButton';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useAppDispatch();
  const router = useRouter();
  const t = useT();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');

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
        setError(t('auth.googleFailed'));
      } else if (code === 'auth/user-not-found') {
        setError(t('auth.googleFailed'));
      } else {
        setError(t('auth.googleFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t('auth.email')}</label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.emailPlaceholder')}
          className={cn(
            'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none',
            'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
          )}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">{t('auth.password')}</label>
          <Link href="#" className="text-xs text-primary hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className={cn(
            'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none',
            'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
          )}
          required
        />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
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
        <Link href="/auth/register" className="font-medium text-primary hover:underline">
          {t('auth.signUpLink')}
        </Link>
      </p>
    </form>
  );
}
