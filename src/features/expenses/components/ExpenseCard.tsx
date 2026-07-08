'use client';

import { useState } from 'react';
import { useAppSelector } from '@/store/store';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { getExpenseListMeta } from '@/features/expenses/utils/expensePresentation';
import { localizeSavingsExpenseComment } from '@/features/savings/utils/savingsExpenseComment';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import type { SerializableExpense } from '@/shared/types';

interface Props {
  expense: SerializableExpense;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const PAYMENT_ICONS: Record<string, string> = {
  card: '💳',
  cash: '💵',
  other: '🔄',
};

export function ExpenseCard({ expense, onClick, onEdit, onDelete }: Props) {
  const allCategories = useAppSelector((s) => s.categories.expense);
  const folders = useAppSelector((s) => s.categories.folders.expense);
  const currency = useAppSelector((s) => s.ui.currency);
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const category = allCategories.find((c) => c.id === expense.categoryId);
  const folderCat = category?.folderId ? folders.find((f) => f.id === category.folderId) : null;
  const listMeta = getExpenseListMeta(expense, allCategories, folders);
  const categoryLabel = category ? t.cat(category.name) : '';
  const folderLabel = folderCat ? t.cat(folderCat.name) : '';
  const subtitleLabel = listMeta ? t.cat(listMeta.labelSource) : categoryLabel || folderLabel || '';

  // Top line: comment or store name; if neither — category name
  const rawTopLine = expense.comment || expense.store || categoryLabel;
  const topLine = expense.tags?.includes('savings')
    ? localizeSavingsExpenseComment(rawTopLine, t('savings.expenseLabel'))
    : rawTopLine;

  const splitSum = expense.splits.reduce((s, x) => s + x.amount, 0);
  const mainPortion = expense.amount - splitSum;
  const effectiveParts =
    expense.splits.filter((s) => s.amount > 0).length + (mainPortion > 0.01 ? 1 : 0);
  const hasSplit = effectiveParts > 1;
  const isRecurring = expense.tags?.includes('recurring') ?? false;
  const isSavings = expense.tags?.includes('savings') ?? false;

  const borderColor = listMeta?.color ?? 'transparent';

  return (
    <div className="flex flex-col group" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex w-full items-center gap-3 pl-3 pr-4 py-3.5">
        {/* Icon */}
        <button onClick={onClick} className="shrink-0 active:opacity-70 transition-opacity">
          {listMeta ? (
            <CategoryIcon icon={listMeta.icon} color={listMeta.color} size="md" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-muted" />
          )}
        </button>

        {/* Text */}
        <div onClick={onClick} className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity cursor-pointer">
          <p className="text-[15px] font-semibold truncate leading-snug">{topLine}</p>
          <p className="flex items-center gap-1.5 mt-0.5">
            <span style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: listMeta?.color ?? 'hsl(var(--muted-foreground))',
            }}>{subtitleLabel}</span>
            {hasSplit && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/80 transition-colors text-muted-foreground"
              >
                {effectiveParts}× {expanded ? '▲' : '▼'}
              </button>
            )}
            <span className="text-muted-foreground/40">·</span>
            {isRecurring && <span title={t('expenses.recurringBadge')}>🔄</span>}
            {!isRecurring && !isSavings && <span className="opacity-50">{PAYMENT_ICONS[expense.paymentMethod]}</span>}
            {expense.privacy === 'secret' && <span>🔒</span>}
          </p>
        </div>

        {/* Amount + action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span style={{ fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
            {expense.amount > 0 ? '-' : ''}{formatAmount(expense.amount, expense.currency || currency)}
          </span>
          {onEdit && (
            <button
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 lg:flex hidden text-muted-foreground hover:text-primary transition-all text-xs w-6 h-6 items-center justify-center rounded-lg hover:bg-muted"
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="opacity-0 group-hover:opacity-100 lg:flex hidden text-muted-foreground hover:text-destructive transition-all text-xs w-6 h-6 items-center justify-center rounded-lg hover:bg-muted"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Expanded split breakdown */}
      {hasSplit && expanded && (
        <div className="px-4 pb-2 flex flex-col gap-1 border-t border-border/50 bg-muted/20">
          {mainPortion > 0.01 && category && (
            <div className="flex items-center gap-2 py-1.5 pl-12">
              <span className="text-xs text-muted-foreground flex-1">{t.cat(category.name)}</span>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                -{formatAmount(mainPortion, expense.currency)}
              </span>
            </div>
          )}
          {expense.splits.filter((s) => s.amount > 0).map((split, i) => {
            const splitCat = allCategories.find((c) => c.id === split.categoryId);
            return (
              <div key={i} className="flex items-center gap-2 py-1.5 pl-12">
                <span className="text-xs text-muted-foreground flex-1">
                  {splitCat ? t.cat(splitCat.name) : '—'}
                </span>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  -{formatAmount(split.amount, expense.currency)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-card pb-safe"
            style={{ padding: '24px 20px 32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-[15px] font-[700] mb-1" style={{ color: 'var(--foreground)' }}>
              {t('expense.confirmDelete')}
            </p>
            <p className="text-center text-[13px] font-[500] mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {topLine} · {formatAmount(expense.amount, expense.currency || currency)}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { onDelete?.(); setShowDeleteModal(false); }}
                className="w-full rounded-xl py-3.5 text-[15px] font-[700] transition-opacity active:opacity-70"
                style={{ background: '#EF4444', color: '#fff' }}
              >
                {t('common.delete')}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full rounded-xl py-3.5 text-[15px] font-[700] transition-opacity active:opacity-70"
                style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
