'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { registerWithEmail } from '@/features/auth/services/authService';
import { setCurrency, setLanguage, setTheme } from '@/features/ui/store/uiSlice';
import { GoogleButton } from './GoogleButton';
import { cn } from '@/shared/utils/cn';

export function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useAppDispatch();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return;
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const profile = await registerWithEmail(name, email, password);
      dispatch(setUser(profile));
      dispatch(setCurrency(profile.currency));
      dispatch(setLanguage(profile.language));
      dispatch(setTheme(profile.theme));
      router.replace('/home');
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        setError('Registration failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Full Name</label>
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Smith"
          className={cn(
            'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none',
            'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
          )}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Email</label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={cn(
            'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none',
            'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
          )}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Password</label>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className={cn(
            'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none',
            'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
          )}
          required
          minLength={6}
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
        {loading ? 'Creating account...' : 'Create Account'}
      </button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <GoogleButton label="Sign up with Google" />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
