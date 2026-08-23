'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { fetchRecurringById } from '@/features/recurring/services/recurringService';
import { fetchExpensesByRecurringId } from '@/features/expenses/services/expensesService';
import { useRecurringActions } from '@/features/recurring/hooks/useRecurringActions';
import { RecurringDetailView } from '@/features/recurring/components/RecurringDetailView';
import { useT } from '@/shared/hooks/useT';
import type { SerializableExpense, SerializableRecurringPayment } from '@/shared/types';

export default function RecurringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useT();

  const user = useAppSelector((s) => s.auth.user);
  const categories = useAppSelector((s) => s.categories.expense);
  // (app)/layout already loads the whole list when it is idle; this screen only
  // fetches its own document when it was opened before that finished.
  const reduxItem = useAppSelector((s) => s.recurring.list.find((r) => r.id === id));

  const [loadedItem, setLoadedItem] = useState<SerializableRecurringPayment | null>(null);
  const [loading, setLoading] = useState(!reduxItem);
  const [history, setHistory] = useState<SerializableExpense[] | null>(null);
  const [payEdit, setPayEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const item = reduxItem ?? loadedItem ?? undefined;
  const { markPaid, skip, toggle, remove, finish } = useRecurringActions();

  useEffect(() => {
    if (reduxItem || !user) return;
    fetchRecurringById(user.id, id)
      .then(setLoadedItem)
      .catch(() => setLoadedItem(null))
      .finally(() => setLoading(false));
  }, [id, reduxItem, user]);

  const loadHistory = useCallback(() => {
    if (!user) return;
    fetchExpensesByRecurringId(user.id, id).then(setHistory).catch(() => setHistory([]));
  }, [user, id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const run = useCallback(async (action: () => Promise<boolean>) => {
    setBusy(true);
    try { return await action(); } finally { setBusy(false); }
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center px-4 py-20 text-center">
        <Search className="mb-3 h-9 w-9 text-muted-foreground" strokeWidth={1.6} />
        <p className="font-medium">{t('common.entryNotFound')}</p>
        <button onClick={() => router.replace('/recurring')} className="mt-4 text-sm text-primary hover:underline">
          {t('common.back')}
        </button>
      </div>
    );
  }

  const template = item;

  return (
    <RecurringDetailView
      item={template}
      category={categories.find((c) => c.id === template.categoryId)}
      history={history}
      busy={busy}
      payEditValue={payEdit}
      onBack={() => {
        if (window.history.length > 1) router.back();
        else router.replace('/recurring');
      }}
      // The editor is part of the list page; the deep link opens it there
      onEdit={() => router.push(`/recurring?edit=${template.id}`)}
      onMarkPaid={(amount) => run(async () => {
        const ok = await markPaid(template, amount);
        if (ok) {
          setPayEdit(null);
          loadHistory();
        }
        return ok;
      })}
      onStartPayEdit={() => setPayEdit(String(template.amount))}
      onChangePayEdit={setPayEdit}
      onCancelPayEdit={() => setPayEdit(null)}
      onSkip={() => run(() => skip(template))}
      onToggleActive={() => run(() => toggle(template))}
      onFinish={() => run(() => finish(template))}
      onDelete={() => run(async () => {
        const ok = await remove(template);
        if (ok) router.replace('/recurring');
        return ok;
      })}
      onOpenExpense={(expenseId) => router.push(`/expenses/${expenseId}`)}
    />
  );
}
