'use client';

import Image from 'next/image';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { setLanguage } from '@/features/ui/store/uiSlice';
import { useT } from '@/shared/hooks/useT';
import type { Language } from '@/shared/types';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const language = useAppSelector((s) => s.ui.language);
  const t = useT();
  const features = [
    ['receipt', 'auth.featureTracking'],
    ['piggy', 'auth.featureSavings'],
    ['refund', 'auth.featureRecurring'],
    ['house', 'auth.featureFamily'],
  ];

  return (
    <div className="relative min-h-screen bg-background flex">
      <div className="absolute right-4 top-4 z-10 flex rounded-xl border border-border bg-card p-1 shadow-sm" aria-label={t('auth.language')}>
        {(['en', 'ru', 'he'] as Language[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => dispatch(setLanguage(value))}
            className={`fb-touch-target min-h-11 min-w-11 rounded-lg px-3 text-sm font-bold transition-colors ${language === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            aria-pressed={language === value}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>
      {/* ── Left brand panel — desktop only ── */}
      <div className="hidden lg:flex w-[480px] flex-shrink-0 flex-col items-center justify-center bg-primary px-12 gap-8">
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo-mark.svg" alt="Family Budget" width={100} height={100} priority className="h-24 w-24" />
          <Image src="/logo-wordmark.svg" alt="Family Budget" width={220} height={60} priority className="h-14 w-auto brightness-0 invert" style={{ width: 'auto' }} />
        </div>
        <p className="text-primary-foreground/80 text-center text-base leading-relaxed max-w-[280px]">
          {t('auth.tagline')}
        </p>
        <ul className="flex flex-col gap-3 w-full max-w-[280px]">
          {features.map(([icon, labelKey]) => (
            <li key={labelKey} className="flex items-center gap-3 text-primary-foreground/90 text-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12">
                <StickerIcon icon={icon} color="#fff" className="h-6 w-6" />
              </span>
              <span>{t(labelKey)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Logo — mobile only */}
          <div className="lg:hidden mb-8 flex flex-col items-center gap-3">
            <Image src="/logo-mark.svg" alt="Family Budget" width={96} height={96} priority className="h-24 w-24" />
            <Image src="/logo-wordmark.svg" alt="Family Budget" width={200} height={56} priority className="h-14 w-auto" style={{ width: 'auto' }} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
