'use client';

import { Lock } from 'lucide-react';

import { useAppSelector } from '@/store/store';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { paymentMethodIcon } from '@/shared/config/domainIcons';
import type { SerializableIncome } from '@/shared/types';

interface Props {
  income: SerializableIncome;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function IncomeCard({ income, onDelete, onEdit }: Props) {
  const categories = useAppSelector((s) => s.categories.income);
  const currency = useAppSelector((s) => s.ui.currency);
  const category = categories.find((c) => c.id === income.categoryId);
  const t = useT();
  const isRecurring = income.tags?.includes('recurring') ?? false;
  const borderColor = category?.color ?? '#18A957';

  return (
    <div className="flex w-full items-center gap-3 pl-3 pr-4 py-3.5 group"
      style={{ borderLeft: `4px solid ${borderColor}` }}>
      {/* Tap anywhere on the row body to edit — on mobile this is the ONLY
          path to edit/delete (the hover icons below are desktop-only) */}
      <div
        className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer active:opacity-70 transition-opacity"
        onClick={onEdit}
        role={onEdit ? 'button' : undefined}
        tabIndex={onEdit ? 0 : undefined}
        onKeyDown={(e) => {
          if (onEdit && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onEdit();
          }
        }}
      >
        {category ? (
          <CategoryIcon icon={category.icon} color={category.color} size="md" />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-muted shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold truncate leading-snug">
            {income.comment || (category ? t.cat(category.name) : t('income.title'))}
          </p>
          <p className="flex items-center gap-1.5 mt-0.5">
            <span style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              fontWeight: 700, color: borderColor,
            }}>
              {category ? t.cat(category.name) : ''}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StickerIcon
              icon={isRecurring ? 'refund' : paymentMethodIcon(income.method)}
              color="hsl(var(--muted-foreground))"
              className="h-3.5 w-3.5 opacity-70"
            />
            {income.privacy === 'secret' && (
              <Lock className="h-3 w-3 text-muted-foreground" strokeWidth={2.2} aria-label={t('expense.secret')} />
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span style={{ fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', color: '#18A957' }}>
          +{formatAmount(income.amount, income.currency ?? currency)}
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
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 lg:flex hidden text-muted-foreground hover:text-destructive transition-all text-xs w-6 h-6 items-center justify-center rounded-lg hover:bg-muted"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
