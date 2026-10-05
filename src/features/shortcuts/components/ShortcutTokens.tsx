'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { KeyRound, X } from 'lucide-react';
import { useT } from '@/shared/hooks/useT';
import { createShortcutToken, fetchShortcutTokens, revokeShortcutToken, type ShortcutToken } from '../services/shortcutTokenService';

export function ShortcutTokens({ uid }: { uid: string }) {
  const t = useT();
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="fb-card flex min-h-14 w-full items-center gap-3 p-4 text-left text-sm font-bold">
          <KeyRound className="h-5 w-5 text-primary" />
          <span className="flex-1">{t('shortcuts.title')}</span><span aria-hidden="true">›</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-60 mx-auto max-h-[85dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl bg-background p-6 pb-[max(env(safe-area-inset-bottom),24px)] lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-3xl">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-bold">{t('shortcuts.title')}</Dialog.Title>
            <Dialog.Close asChild><button aria-label={t('common.close')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-muted"><X className="h-5 w-5" /></button></Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-muted-foreground">{t('shortcuts.description')}</Dialog.Description>
          <TokenManager key={uid} uid={uid} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TokenManager({ uid }: { uid: string }) {
  const t = useT();
  const [tokens, setTokens] = useState<ShortcutToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<{ id: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    fetchShortcutTokens(uid).then((items) => { if (active) setTokens(items); })
      .catch(() => { if (active) setError('shortcuts.loadFailed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [uid]);

  async function create() {
    if (lock.current || !label.trim()) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await createShortcutToken(uid, label);
      setTokens((items) => [...items, result.token]);
      setCreated({ id: result.token.id, secret: result.secret });
      setCopied(false);
      setLabel('');
    } catch { setError('shortcuts.createFailed'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function revoke(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await revokeShortcutToken(uid, id);
      setTokens((items) => items.filter((item) => item.id !== id));
      if (created?.id === id) setCreated(null);
      setConfirmId(null);
    } catch { setError('shortcuts.revokeFailed'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function copy() {
    if (!created) return;
    try { await navigator.clipboard.writeText(created.secret); setCopied(true); setError(''); }
    catch { setError('shortcuts.copyFailed'); }
  }

  const button = 'min-h-11 rounded-xl px-3 text-sm font-bold disabled:opacity-40';
  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      {created && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-bold">{t('shortcuts.once')}</p>
          <textarea aria-label={t('shortcuts.secret')} readOnly value={created.secret} rows={3} spellCheck={false} className="w-full resize-none break-all rounded-xl border border-border bg-background p-3 font-mono text-sm" />
          <button onClick={copy} className={`${button} bg-primary text-primary-foreground`}>{t(copied ? 'shortcuts.copied' : 'shortcuts.copy')}</button>
          <button onClick={() => setCreated(null)} className={button}>{t('shortcuts.hide')}</button>
        </div>
      )}
      {loading ? <p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p> : (
        <ul className="divide-y divide-border">
          {tokens.map((token) => (
            <li key={token.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="min-w-0 break-words text-sm font-bold">{token.label}</span>
              {confirmId === token.id ? <div className="w-full">
                <p className="text-sm text-muted-foreground">{t('shortcuts.confirmRevoke')}</p>
                <div className="mt-2 flex gap-2">
                  <button disabled={busy} onClick={() => revoke(token.id)} className={`${button} bg-destructive text-white`}>{t('shortcuts.revoke')}</button>
                  <button disabled={busy} onClick={() => setConfirmId(null)} className={button}>{t('common.cancel')}</button>
                </div>
              </div> : <button disabled={busy} onClick={() => setConfirmId(token.id)} className={`${button} text-destructive`}>{t('shortcuts.revoke')}</button>}
            </li>
          ))}
          {tokens.length === 0 && !error && <li className="text-sm text-muted-foreground">{t('shortcuts.empty')}</li>}
        </ul>
      )}
      {!created && <form onSubmit={(event) => { event.preventDefault(); void create(); }} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2 text-sm font-bold">{t('shortcuts.label')}
          <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} disabled={busy || loading} placeholder={t('shortcuts.placeholder')} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm" />
        </label>
        <button disabled={busy || loading || !label.trim()} className={`${button} bg-primary text-primary-foreground`}>{t(busy ? 'common.saving' : 'shortcuts.create')}</button>
      </form>}
    </div>
  );
}
