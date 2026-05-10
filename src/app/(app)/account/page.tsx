'use client';

import { useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setTheme, setCurrency, setLanguage } from '@/features/ui/store/uiSlice';
import { signOut } from '@/features/auth/services/authService';
import { doc, updateDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { Currency, Language, Theme } from '@/shared/types';

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'ILS', label: '₪ ILS' },
  { value: 'USD', label: '$ USD' },
  { value: 'CAD', label: 'CA$ CAD' },
  { value: 'RUB', label: '₽ RUB' },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'ru', label: '🇷🇺 Русский' },
  { value: 'he', label: '🇮🇱 עברית' },
];

export default function AccountPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { theme, currency, language } = useAppSelector((s) => s.ui);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function savePrefs(patch: Partial<{ theme: Theme; currency: Currency; language: Language }>) {
    setSaving(true);
    try {
      await updateDoc(doc(getDb(), 'users', user!.id), patch);
    } finally {
      setSaving(false);
    }
  }

  async function handleTheme(t: Theme) {
    dispatch(setTheme(t));
    await savePrefs({ theme: t });
  }

  async function handleCurrency(c: Currency) {
    dispatch(setCurrency(c));
    await savePrefs({ currency: c });
  }

  async function handleLanguage(l: Language) {
    dispatch(setLanguage(l));
    await savePrefs({ language: l });
  }

  async function handleSignOut() {
    if (!confirm('Sign out?')) return;
    setSigningOut(true);
    await signOut();
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold">Account</h1>

      {/* Profile card */}
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{user.name}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <span className="inline-block mt-1 text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground capitalize">
            {user.accountType}
          </span>
        </div>
        {saving && <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary shrink-0" />}
      </div>

      {/* Theme */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-3">Theme</p>
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {(['light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTheme(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
                theme === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              {t === 'light' ? '☀️ Light' : '🌙 Dark'}
            </button>
          ))}
        </div>
      </div>

      {/* Currency */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-3">Currency</p>
        <div className="grid grid-cols-2 gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c.value}
              onClick={() => handleCurrency(c.value)}
              className={`rounded-xl py-2.5 text-sm font-medium transition-colors border ${
                currency === c.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-3">Language</p>
        <div className="flex flex-col gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              onClick={() => handleLanguage(l.value)}
              className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors border ${
                language === l.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <span>{l.label}</span>
              {language === l.value && <span className="text-primary">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="rounded-2xl border border-destructive/40 bg-destructive/5 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
      >
        {signingOut ? 'Signing out…' : 'Sign Out'}
      </button>
    </div>
  );
}
