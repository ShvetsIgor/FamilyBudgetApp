'use client';

import { useT } from '@/shared/hooks/useT';

export function ShortcutSetupGuide() {
  const t = useT();
  return (
    <details className="mb-5 rounded-2xl border border-border p-4 text-sm">
      <summary className="cursor-pointer font-bold">{t('shortcuts.guide.title')}</summary>
      <p className="mt-3 text-muted-foreground">{t('shortcuts.guide.intro')}</p>
      <ol className="my-3 list-decimal space-y-3 pl-5">
        <li>{t('shortcuts.guide.token')}</li>
        <li>{t('shortcuts.guide.url')}
          <code className="mt-2 block break-all select-all rounded-lg bg-muted p-2 text-xs">https://family-budget-app-pi.vercel.app/api/shortcut/expense</code>
        </li>
        <li>{t('shortcuts.guide.dictation')}</li>
        <li>{t('shortcuts.guide.date')}</li>
        <li>{t('shortcuts.guide.request')}</li>
        <li>{t('shortcuts.guide.body')}
          <dl className="mt-2 space-y-1">
            <div><dt className="inline font-mono">text</dt><dd className="inline"> — Dictated Text</dd></div>
            <div><dt className="inline font-mono">timeZone</dt><dd className="inline"> — Asia/Jerusalem</dd></div>
            <div><dt className="inline font-mono">requestId</dt><dd className="inline"> — Formatted Date</dd></div>
          </dl>
        </li>
        <li>{t('shortcuts.guide.speech')}</li>
      </ol>
      <p className="mb-3 text-muted-foreground">{t('shortcuts.guide.variables')}</p>
      <p className="mb-3">{t('shortcuts.guide.siri')}</p>
      <p className="mb-3">{t('shortcuts.guide.retry')}</p>
      <p>{t('shortcuts.guide.category')}</p>
    </details>
  );
}
