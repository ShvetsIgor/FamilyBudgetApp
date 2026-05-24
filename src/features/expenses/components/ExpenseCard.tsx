'use client';

import { useState } from 'react';
import { useAppSelector } from '@/store/store';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
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
  const currency = useAppSelector((s) => s.ui.currency);
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const category = allCategories.find((c) => c.id === expense.categoryId);
  const folders = useAppSelector((s) => s.categories.folders.expense);
  const folderCat = category?.folderId ? folders.find((f) => f.id === category.folderId) : null;
  const categoryLabel = category ? t.cat(category.name) : '';
  const folderLabel = folderCat ? t.cat(folderCat.name) : '';
  const subtitleLabel = categoryLabel || folderLabel || '';

  // Top line: comment or store name; if neither — category name
  const topLine = expense.comment || expense.store || categoryLabel;

  const splitSum = expense.splits.reduce((s, x) => s + x.amount, 0);
  const mainPortion = expense.amount - splitSum;
  const effectiveParts =
    expense.splits.filter((s) => s.amount > 0).length + (mainPortion > 0.01 ? 1 : 0);
  const hasSplit = effectiveParts > 1;

  return (
    <div className="flex flex-col">
      <div className="flex w-full items-center gap-3 px-4 py-3">
        {/* Icon — clickable to open detail */}
        <button onClick={onClick} className="shrink-0 active:opacity-70 transition-opacity">
          {category ? (
            <CategoryIcon icon={category.icon} color={category.color} size="md" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-muted" />
          )}
        </button>

        {/* Text — clickable to open detail */}
        <button onClick={onClick} className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity">
          <p className="text-sm font-medium truncate">{topLine}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <span>{subtitleLabel}</span>
            {hasSplit && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/80 transition-colors"
              >
                сплит · {effectiveParts} {expanded ? '▲' : '▼'}
              </button>
            )}
            <span>·</span>
            <span>{PAYMENT_ICONS[expense.paymentMethod]}</span>
            {expense.privacy === 'secret' && <span>🔒</span>}
          </p>
        </button>

        {/* Amount + action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold tabular-nums">
            {expense.amount > 0 ? '-' : ''}{formatAmount(expense.amount, expense.currency || currency)}
          </span>
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-muted-foreground hover:text-primary transition-colors text-xs px-1"
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-muted-foreground hover:text-destructive transition-colors text-xs"
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
