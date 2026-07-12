'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { signInWithGoogle } from '@/features/auth/services/authService';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

interface Props {
  label?: string;
}

export function GoogleButton({ label }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const t = useT();
  const buttonLabel = label ?? t('auth.withGoogle');
  const dispatch = useAppDispatch();
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setError('');
    try {
      const profile = await signInWithGoogle();
      dispatch(setUser(profile));
      router.replace('/home');
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('popup-closed')) return;
      setError(t('auth.googleFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted active:scale-[0.98]',
          loading && 'opacity-60 cursor-not-allowed'
        )}
      >
        {/* Google G icon */}
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {loading ? t('auth.signingIn') : buttonLabel}
      </button>
      {error && <p role="alert" aria-live="assertive" className="mt-2 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
