'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setDarkMode, setTheme, setCurrency, setLanguage, setWeekStart, type WeekStart } from '@/features/ui/store/uiSlice';
import { signOut } from '@/features/auth/services/authService';
import { doc, updateDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { setFamily, setMembers, setPendingInvite, clearFamily } from '@/features/family/store/familySlice';
import { setUser } from '@/features/auth/store/authSlice';
import {
  createFamily, sendInvite, acceptInvite, rejectInvite,
  leaveFamily, fetchFamilyMembers,
} from '@/features/family/services/familyService';
import { format, subMonths, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Currency, Language, Theme } from '@/shared/types';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { getNotificationPermission, requestNotificationPermission } from '@/shared/hooks/useNotifications';
import { fetchMonthIncome } from '@/features/income/services/incomeService';
import { expensesToCsv, incomeTocsv, downloadCsv } from '@/shared/utils/exportCsv';

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'ILS', label: '₪ ILS' },
  { value: 'USD', label: '$ USD' },
  { value: 'CAD', label: 'CA$ CAD' },
  { value: 'RUB', label: '₽ RUB' },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'ru', label: '🇷🇺 Русский' },
];

export default function AccountPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { theme, isDarkMode, currency, language, weekStart } = useAppSelector((s) => s.ui);
  const expenseCategories = useAppSelector((s) => s.categories.expense);
  const incomeCategories = useAppSelector((s) => s.categories.income);
  const family = useAppSelector((s) => s.family.family);
  const members = useAppSelector((s) => s.family.members);
  const pendingInvite = useAppSelector((s) => s.family.pendingInvite);

  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const t = useT();

  const [notifPermission, setNotifPermission] = useState<string>(() => getNotificationPermission());
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [exportType, setExportType] = useState<'expenses' | 'income' | 'both'>('both');
  const [exporting, setExporting] = useState(false);

  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  if (!user) return null;

  const initials = user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const isOwner = family?.ownerId === user.id;

  async function savePrefs(patch: Partial<{ theme: Theme; darkMode: boolean; currency: Currency; language: Language; weekStart: WeekStart }>) {
    setSaving(true);
    try { await updateDoc(doc(getDb(), 'users', user!.id), patch); } finally { setSaving(false); }
  }

  async function handleTheme(th: Theme) { dispatch(setTheme(th)); await savePrefs({ theme: th }); }
  async function handleDarkMode(enabled: boolean) { dispatch(setDarkMode(enabled)); await savePrefs({ darkMode: enabled }); }
  async function handleCurrency(c: Currency) { dispatch(setCurrency(c)); await savePrefs({ currency: c }); }
  async function handleLanguage(l: Language) { dispatch(setLanguage(l)); await savePrefs({ language: l }); }
  async function handleWeekStart(ws: WeekStart) { dispatch(setWeekStart(ws)); await savePrefs({ weekStart: ws }); }

  async function handleSaveName() {
    const name = nameInput.trim();
    if (!name || name === user!.name) { setEditingName(false); return; }
    setNameSaving(true);
    try {
      await updateDoc(doc(getDb(), 'users', user!.id), { name });
      dispatch(setUser({ ...user!, name }));
      setEditingName(false);
    } finally { setNameSaving(false); }
  }

  async function handleExport() {
    if (!user) return;
    setExporting(true);
    try {
      const catNames: Record<string, string> = {};
      for (const c of [...expenseCategories, ...incomeCategories]) catNames[c.id] = c.name;
      if (exportType === 'expenses' || exportType === 'both') {
        const data = await fetchMonthExpenses(user.id, exportMonth);
        if (data.length > 0) downloadCsv(expensesToCsv(data, catNames), `expenses-${exportMonth}.csv`);
      }
      if (exportType === 'income' || exportType === 'both') {
        const data = await fetchMonthIncome(user.id, exportMonth);
        if (data.length > 0) downloadCsv(incomeTocsv(data, catNames), `income-${exportMonth}.csv`);
      }
    } finally { setExporting(false); }
  }

  async function handleSignOut() {
    if (!confirm('Sign out?')) return;
    setSigningOut(true);
    await signOut();
  }

  async function handleCreateFamily() {
    if (!familyName.trim()) return;
    setFamilyLoading(true); setFamilyError('');
    try {
      const newFamily = await createFamily(user!.id, familyName.trim());
      dispatch(setFamily(newFamily)); dispatch(setMembers([user!]));
      dispatch(setUser({ ...user!, familyId: newFamily.id, accountType: 'family' }));
      setShowCreateFamily(false); setFamilyName('');
    } catch { setFamilyError('Failed to create family. Try again.'); } finally { setFamilyLoading(false); }
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim() || !family) return;
    setFamilyLoading(true); setFamilyError('');
    try {
      await sendInvite(family.id, user!.id, inviteEmail.trim());
      setInviteSent(true); setInviteEmail(''); setShowInvite(false);
    } catch { setFamilyError('Failed to send invite. Try again.'); } finally { setFamilyLoading(false); }
  }

  async function handleAcceptInvite() {
    if (!pendingInvite) return;
    setFamilyLoading(true); setFamilyError('');
    try {
      await acceptInvite(pendingInvite, user!.id);
      const { fetchFamily } = await import('@/features/family/services/familyService');
      const f = await fetchFamily(pendingInvite.familyId);
      if (f) { dispatch(setFamily(f)); dispatch(setMembers(await fetchFamilyMembers(f.memberIds))); }
      dispatch(setUser({ ...user!, familyId: pendingInvite.familyId, accountType: 'family' }));
      dispatch(setPendingInvite(null));
    } catch { setFamilyError('Failed to accept invite. Try again.'); } finally { setFamilyLoading(false); }
  }

  async function handleRejectInvite() {
    if (!pendingInvite) return;
    setFamilyLoading(true);
    try { await rejectInvite(pendingInvite.id); dispatch(setPendingInvite(null)); } finally { setFamilyLoading(false); }
  }

  async function handleLeaveFamily() {
    if (!family) return;
    const msg = isOwner ? 'You are the owner. Leaving will dissolve the family for all members. Continue?' : 'Leave this family?';
    if (!confirm(msg)) return;
    setFamilyLoading(true); setFamilyError('');
    try {
      await leaveFamily(user!.id, family);
      dispatch(clearFamily()); dispatch(setUser({ ...user!, familyId: undefined, accountType: 'personal' }));
    } catch { setFamilyError('Failed to leave family. Try again.'); } finally { setFamilyLoading(false); }
  }

  // ── Reusable section blocks ──────────────────────────────────────────────────

  const profileCard = (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
      <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm font-semibold outline-none focus:border-primary"
            />
            <button onClick={handleSaveName} disabled={nameSaving} className="text-xs font-medium text-primary disabled:opacity-50">
              {nameSaving ? '…' : t('account.save')}
            </button>
            <button onClick={() => setEditingName(false)} className="text-xs text-muted-foreground">{t('account.cancel')}</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{user.name}</p>
            <button onClick={() => { setNameInput(user.name); setEditingName(true); }} className="text-muted-foreground hover:text-primary transition-colors text-xs shrink-0">✎</button>
          </div>
        )}
        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        <span className="inline-block mt-1 text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground capitalize">{user.accountType}</span>
      </div>
      {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary shrink-0" />}
    </div>
  );

  const familyBlock = family ? (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{t('account.family')}</p>
          <p className="font-semibold mt-0.5">👨‍👩‍👧 {family.name}</p>
        </div>
        {isOwner && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t('account.owner')}</span>}
      </div>
      <div className="flex flex-col gap-2">
        {members.map((m) => {
          const ini = m.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
          return (
            <div key={m.id} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">{ini}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>
              {m.id === family.ownerId && <span className="ml-auto text-xs text-muted-foreground shrink-0">{t('account.owner')}</span>}
            </div>
          );
        })}
      </div>
      {isOwner && (
        <>
          {inviteSent && <p className="text-xs text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2">{t('account.inviteSent')}</p>}
          {showInvite ? (
            <div className="flex flex-col gap-2">
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="member@email.com"
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <div className="flex gap-2">
                <button onClick={handleSendInvite} disabled={!inviteEmail.trim() || familyLoading}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {familyLoading ? '…' : t('account.sendInvite')}
                </button>
                <button onClick={() => { setShowInvite(false); setInviteEmail(''); }}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setShowInvite(true); setInviteSent(false); }}
              className="rounded-xl border border-dashed border-primary/40 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors">
              {t('account.inviteMember')}
            </button>
          )}
        </>
      )}
      {familyError && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{familyError}</p>}
      <button onClick={handleLeaveFamily} disabled={familyLoading}
        className="rounded-xl border border-destructive/30 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50">
        {isOwner ? t('account.dissolveFamily') : t('account.leaveFamily')}
      </button>
    </div>
  ) : pendingInvite ? (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{t('account.pendingInvite')}</p>
      <p className="text-sm text-amber-700 dark:text-amber-400">{t('account.inviteText')}</p>
      {familyError && <p className="text-xs text-destructive">{familyError}</p>}
      <div className="flex gap-2">
        <button onClick={handleAcceptInvite} disabled={familyLoading}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {familyLoading ? '…' : t('account.accept')}
        </button>
        <button onClick={handleRejectInvite} disabled={familyLoading}
          className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground disabled:opacity-50">
          {t('account.decline')}
        </button>
      </div>
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-border bg-card p-4 flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t('account.noFamily')}</p>
      {showCreateFamily ? (
        <div className="flex flex-col gap-2">
          <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="Family name (e.g. The Smiths)"
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          {familyError && <p className="text-xs text-destructive">{familyError}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreateFamily} disabled={!familyName.trim() || familyLoading}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {familyLoading ? '…' : t('account.createFamily')}
            </button>
            <button onClick={() => { setShowCreateFamily(false); setFamilyName(''); }}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowCreateFamily(true)}
          className="rounded-xl bg-primary/10 text-primary py-2.5 text-sm font-semibold hover:bg-primary/20 transition-colors">
          {t('account.createFamily')}
        </button>
      )}
    </div>
  );

  const appearanceBlock = (
    <div className="fb-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.08em] text-muted-foreground">{t('account.appearance')}</p>
          <p className="mt-1 text-sm font-bold text-foreground">{t('account.theme')}</p>
        </div>
        <button
          onClick={() => handleDarkMode(!isDarkMode)}
          className="relative h-[28px] w-[50px] rounded-full border border-border bg-muted transition-colors"
          style={{ background: isDarkMode ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}
          aria-label={t('account.darkMode')}
        >
          <span
            className="absolute top-[3px] h-5 w-5 rounded-full bg-card transition-all duration-200"
            style={{ left: isDarkMode ? '25px' : '3px', boxShadow: 'var(--shadow-sm)' }}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([
          { value: 'mist' as const, title: t('account.themeMist'), desc: t('account.themeMistDesc'), swatch: '#5B6CFF' },
          { value: 'paper' as const, title: t('account.themePaper'), desc: t('account.themePaperDesc'), swatch: '#FF4F2B' },
        ]).map((option) => {
          const active = theme === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleTheme(option.value)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                active ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground',
              )}
            >
              <span className="mb-3 block h-8 rounded-lg border border-border" style={{ background: option.swatch }} />
              <span className="block text-sm font-extrabold text-foreground">{option.title}</span>
              <span className="mt-1 block text-[11px] font-semibold leading-snug text-muted-foreground">{option.desc}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-muted px-3 py-2">
        <span className="text-sm font-bold text-foreground">{t('account.darkMode')}</span>
        <span className="text-xs font-semibold text-muted-foreground">{isDarkMode ? t('account.dark') : t('account.light')}</span>
      </div>
    </div>
  );

  const preferencesBlock = (
    <>
      {appearanceBlock}

      {/* Currency */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-3">{t('account.currency')}</p>
        <div className="grid grid-cols-2 gap-2">
          {CURRENCIES.map((c) => (
            <button key={c.value} onClick={() => handleCurrency(c.value)}
              className={cn('rounded-xl py-2.5 text-sm font-medium transition-colors border', currency === c.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-3">{t('account.language')}</p>
        <div className="flex flex-col gap-2">
          {LANGUAGES.map((l) => (
            <button key={l.value} onClick={() => handleLanguage(l.value)}
              className={cn('flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors border', language === l.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
              <span>{l.label}</span>
              {language === l.value && <span className="text-primary">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const quickLinks = (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
      <Link href="/savings" className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors">
        <span className="text-sm font-medium">{t('account.savingsGoals')}</span>
        <span className="text-muted-foreground text-sm">→</span>
      </Link>
      <Link href="/recurring" className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors">
        <span className="text-sm font-medium">{t('account.recurringPayments')}</span>
        <span className="text-muted-foreground text-sm">→</span>
      </Link>
      <Link href="/categories" className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors">
        <span className="text-sm font-medium">{t('account.categories')}</span>
        <span className="text-muted-foreground text-sm">→</span>
      </Link>
    </div>
  );

  const notificationsBlock = (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t('notifications.title')}</p>
      <p className="text-xs text-muted-foreground/70">{t('notifications.description')}</p>
      {notifPermission === 'unsupported' ? (
        <p className="text-xs text-muted-foreground italic">{t('notifications.unsupported')}</p>
      ) : notifPermission === 'granted' ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('notifications.enabled')}</p>
      ) : notifPermission === 'denied' ? (
        <p className="text-xs text-destructive">{t('notifications.denied')}</p>
      ) : (
        <button onClick={async () => { const g = await requestNotificationPermission(); setNotifPermission(g ? 'granted' : 'denied'); }}
          className="rounded-xl bg-primary/10 text-primary py-2.5 text-sm font-semibold hover:bg-primary/20 transition-colors">
          {t('notifications.enable')}
        </button>
      )}
    </div>
  );

  const exportBlock = (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 overflow-hidden w-full min-w-0">
      <p className="text-xs text-muted-foreground">{t('export.title')}</p>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{t('export.month')}</label>
        <select
          value={exportMonth}
          onChange={(e) => setExportMonth(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary appearance-none cursor-pointer"
        >
          {Array.from({ length: 24 }, (_, i) => {
            const d = subMonths(new Date(), i);
            const val = format(d, 'yyyy-MM');
            const label = format(d, 'LLLL yyyy', { locale: ru });
            return <option key={val} value={val}>{label}</option>;
          })}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{t('export.type')}</label>
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {(['expenses', 'income', 'both'] as const).map((type) => (
            <button key={type} onClick={() => setExportType(type)}
              className={cn('flex-1 rounded-lg py-2 text-xs font-medium transition-colors', exportType === type ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
              {t(`export.${type}`)}
            </button>
          ))}
        </div>
      </div>
      <button onClick={handleExport} disabled={exporting}
        className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-opacity">
        {exporting ? t('export.exporting') : t('export.exportBtn')}
      </button>
    </div>
  );

  const signOutBtn = (
    <button onClick={handleSignOut} disabled={signingOut}
      className="rounded-2xl border border-destructive/40 bg-destructive/5 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50">
      {signingOut ? '…' : t('account.signOut')}
    </button>
  );

  const mobileRow = (icon: string, bg: string, title: string, sub?: string, right?: React.ReactNode, onClick?: () => void) => (
    <div onClick={onClick} className={cn('flex items-center gap-3 px-4 py-3.5', onClick && 'cursor-pointer active:bg-muted/50 transition-colors')}>
      <div className="h-10 w-10 rounded-[14px] flex items-center justify-center text-[18px] shrink-0" style={{ background: bg }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        {sub && <p className="text-xs font-semibold text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {right ?? <span className="text-muted-foreground text-lg leading-none">›</span>}
    </div>
  );

  const mobileLabel = (label: string) => (
    <p className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em] px-1">{label}</p>
  );

  const mobileCard = (children: React.ReactNode) => (
    <div className="fb-card overflow-hidden divide-y divide-border">
      {children}
    </div>
  );

  return (
    <>
      {/* ── MOBILE layout ── */}
      <div className="lg:hidden flex flex-col gap-4 px-[22px] pt-4 pb-28">
        {/* Profile card */}
        {profileCard}

        {/* Family */}
        {mobileLabel(t('account.family'))}
        {familyBlock}

        {/* Budget section */}
        {mobileLabel('Бюджет')}
        {mobileCard(<>
          <Link href="/categories">{mobileRow('🗂', '#F2CC8F22', t('account.categories').replace('🏷️ ', ''))}</Link>
          <Link href="/recurring">{mobileRow('🔁', '#8AA9D622', t('account.recurringPayments').replace('🔄 ', ''))}</Link>
          <Link href="/savings">{mobileRow('🐷', '#81B29A22', t('account.savingsGoals').replace('🎯 ', ''))}</Link>
        </>)}

        {mobileLabel(t('account.appearance'))}
        {appearanceBlock}

        {/* App section */}
        {mobileLabel('Приложение')}
        {mobileCard(<>
          {/* Language */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="h-10 w-10 rounded-[14px] flex items-center justify-center text-[18px] shrink-0" style={{ background: '#F2CC8F22' }}>🌐</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{t('account.language')}</p>
            </div>
            <select
              value={language}
              onChange={(e) => handleLanguage(e.target.value as Language)}
              className="text-sm font-bold text-primary bg-transparent border-0 outline-none cursor-pointer pr-1"
            >
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          {/* Currency */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="h-10 w-10 rounded-[14px] flex items-center justify-center text-[18px] font-black shrink-0" style={{ background: '#E07A5F22', color: '#E07A5F' }}>
              {getCurrencySymbol(currency)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{t('account.currency')}</p>
            </div>
            <select
              value={currency}
              onChange={(e) => handleCurrency(e.target.value as Currency)}
              className="text-sm font-bold text-primary bg-transparent border-0 outline-none cursor-pointer pr-1"
            >
              {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {/* Week start */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="h-10 w-10 rounded-[14px] flex items-center justify-center text-[18px] shrink-0" style={{ background: '#8AA9D622' }}>📅</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{t('account.weekStart')}</p>
            </div>
            <select
              value={weekStart}
              onChange={(e) => handleWeekStart(e.target.value as WeekStart)}
              className="text-sm font-bold text-primary bg-transparent border-0 outline-none cursor-pointer pr-1"
            >
              <option value="monday">{t('account.weekMonday')}</option>
              <option value="sunday">{t('account.weekSunday')}</option>
            </select>
          </div>
          {/* Notifications */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="h-10 w-10 rounded-[14px] flex items-center justify-center text-[18px] shrink-0" style={{ background: '#C97B8422' }}>🔔</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{t('notifications.title')}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                {notifPermission === 'granted' ? t('notifications.enabled') : notifPermission === 'denied' ? t('notifications.denied') : t('notifications.enable')}
              </p>
            </div>
            {notifPermission === 'default' && (
              <button
                onClick={async () => { const g = await requestNotificationPermission(); setNotifPermission(g ? 'granted' : 'denied'); }}
                className="text-xs font-extrabold text-primary border-0 bg-transparent cursor-pointer"
              >
                {t('notifications.enable')}
              </button>
            )}
          </div>
          {/* Export */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="h-10 w-10 rounded-[14px] flex items-center justify-center text-[18px] shrink-0" style={{ background: '#A8B89C22' }}>📤</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{t('export.title')}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">{exportMonth}</p>
            </div>
          </div>
        </>)}

        {/* Export controls */}
        {exportBlock}

        {/* Sign out */}
        {signOutBtn}
      </div>

      {/* ── DESKTOP layout — 2 columns ── */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start pb-8">
        {/* Left: profile + family */}
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-bold">{t('account.title')}</h1>
          {profileCard}
          {familyBlock}
          {exportBlock}
        </div>

        {/* Right: preferences + misc */}
        <div className="flex flex-col gap-4 pt-[52px]">
          {preferencesBlock}
          {notificationsBlock}
          {quickLinks}
          {signOutBtn}
        </div>
      </div>
    </>
  );
}
