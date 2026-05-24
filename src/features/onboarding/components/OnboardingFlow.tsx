'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setCurrency, setLanguage } from '@/features/ui/store/uiSlice';
import { setUser } from '@/features/auth/store/authSlice';
import { formatAmount } from '@/shared/utils/currency';
import type { Currency, Language } from '@/shared/types';
import { useT } from '@/shared/hooks/useT';

const LANGUAGES: { value: Language; flag: string; label: string }[] = [
  { value: 'ru', flag: '🇷🇺', label: 'Русский' },
  { value: 'en', flag: '🇺🇸', label: 'English' },
];

const CURRENCIES: { value: Currency; label: string; example: string }[] = [
  { value: 'ILS', label: '₪ Shekel', example: formatAmount(1000, 'ILS') },
  { value: 'USD', label: '$ Dollar', example: formatAmount(1000, 'USD') },
  { value: 'CAD', label: 'CA$ Canadian', example: formatAmount(1000, 'CAD') },
  { value: 'RUB', label: '₽ Ruble', example: formatAmount(1000, 'RUB') },
];

const TOTAL_STEPS = 4;

interface Props {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: Props) {
  const dispatch = useAppDispatch();
  const t = useT();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const language = useAppSelector((s) => s.ui.language);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(getDb(), 'users', user.id), { onboarded: true });
      dispatch(setUser({ ...user, onboarded: true }));
      onComplete();
    } finally {
      setSaving(false);
    }
  }

  async function handleLanguageSelect(l: Language) {
    dispatch(setLanguage(l));
    if (user) await updateDoc(doc(getDb(), 'users', user.id), { language: l });
  }

  async function handleCurrencySelect(c: Currency) {
    dispatch(setCurrency(c));
    if (user) await updateDoc(doc(getDb(), 'users', user.id), { currency: c });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl bg-background px-6 pt-6 pb-10 flex flex-col gap-6 animate-in slide-in-from-bottom duration-300">

        {/* Step indicator */}
        <div className="flex gap-1.5 justify-center">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? 'w-8 bg-primary' : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-4xl mb-3">👋</p>
              <h1 className="text-2xl font-bold">
                {t('onboarding.hi', { name: user?.name ? `, ${user.name.split(' ')[0]}` : '' })}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {t('onboarding.welcome')}
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
              {(['💸', '📊', '🎯', '🔄'] as const).map((icon, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xl shrink-0">{icon}</span>
                  <p className="text-sm">{t(`onboarding.feature${i + 1}`)}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
            >
              {t('onboarding.start')}
            </button>
          </div>
        )}

        {/* Step 1 — Language */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-4xl mb-3">🌐</p>
              <h2 className="text-xl font-bold">{t('onboarding.chooseLanguage')}</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose your language</p>
            </div>

            <div className="flex flex-col gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  onClick={() => handleLanguageSelect(l.value)}
                  className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                    language === l.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground'
                  }`}
                >
                  <span className="text-3xl">{l.flag}</span>
                  <span className="text-base font-semibold">{l.label}</span>
                  {language === l.value && (
                    <span className="ml-auto text-primary">✓</span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
            >
              {t('onboarding.continue')}
            </button>
          </div>
        )}

        {/* Step 2 — Currency */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-4xl mb-3">💰</p>
              <h2 className="text-xl font-bold">{t('onboarding.chooseCurrency')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('onboarding.currencyHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleCurrencySelect(c.value)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border p-4 transition-all ${
                    currency === c.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground'
                  }`}
                >
                  <span className="text-base font-bold">{c.label}</span>
                  <span className="text-xs text-muted-foreground">{c.example}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
            >
              {t('onboarding.continue')}
            </button>
          </div>
        )}

        {/* Step 3 — Ready */}
        {step === 3 && (
          <div className="flex flex-col gap-4 items-center text-center">
            <p className="text-5xl">🎉</p>
            <div>
              <h2 className="text-xl font-bold">{t('onboarding.allSet')}</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {t('onboarding.allSetHint')}
              </p>
            </div>

            <div className="w-full rounded-2xl border border-border bg-card p-4 text-left flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Быстрый старт</p>
              <p className="text-sm">1. Добавьте расход через <span className="font-semibold">+</span></p>
              <p className="text-sm">2. Посмотрите статистику на вкладке <span className="font-semibold">📊</span></p>
              <p className="text-sm">3. Настройте категории и бюджеты в аккаунте</p>
            </div>

            <button
              onClick={finish}
              disabled={saving}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Открыть приложение'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
