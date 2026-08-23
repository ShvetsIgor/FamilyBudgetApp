'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { registerWithEmail } from '@/features/auth/services/authService';
import { setCurrency, setLanguage, setTheme } from '@/features/ui/store/uiSlice';
import { GoogleButton } from './GoogleButton';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import { Eye, EyeOff } from 'lucide-react';

export function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const t = useT();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return;
    if (password.length < 6) {
      setError(t('auth.weakPassword'));
      return;
    }
    setLoading(true);
    setError('');

    try {
      const profile = await registerWithEmail(name, email, password);
      dispatch(setUser(profile));
      dispatch(setCurrency(profile.currency));
      dispatch(setLanguage(profile.language));
      dispatch(setTheme(profile.theme === 'press' ? 'press' : 'mist'));
      router.replace('/home');
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/email-already-in-use') {
        setError(t('auth.emailExists'));
      } else if (code === 'auth/weak-password') {
        setError(t('auth.weakPassword'));
      } else {
        setError(t('auth.registerFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-name" className="text-sm font-medium text-foreground">{t('auth.name')}</label>
        <input
          id="register-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('auth.namePlaceholder')}
          className={cn(
            'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-hidden',
            'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
          )}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-email" className="text-sm font-medium text-foreground">{t('auth.email')}</label>
        <input
          id="register-email"
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
        <label htmlFor="register-password" className="text-sm font-medium text-foreground">{t('auth.password')}</label>
        <div className="relative">
          <input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordHint')}
            className={cn(
              'w-full rounded-xl border border-border bg-card py-3 pl-4 pr-14 text-sm outline-hidden',
              'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
            )}
            required
            minLength={6}
            aria-describedby="register-password-hint"
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
        <p id="register-password-hint" className="text-sm text-muted-foreground">{t('auth.passwordHint')}</p>
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
        {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
      </button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">{t('auth.or')}</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <GoogleButton label={t('auth.withGoogle')} />

      <p className="text-center text-sm text-muted-foreground">
        {t('auth.alreadyAccount')}{' '}
        <Link href="/auth/login" className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-primary hover:bg-primary/5">
          {t('auth.signInLink')}
        </Link>
      </p>
    </form>
  );
}
