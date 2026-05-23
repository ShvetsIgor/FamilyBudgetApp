'use client';
/**
 * LAYER: shared confirm card — unified quick-confirm UX for expense and income flows.
 *
 * Used by:
 *   - QuickAddBar HIGH confidence expense path
 *   - QuickAddBar income intent confirm path
 *
 * Architecture invariant: this component only renders — no save logic inside.
 * All actions are dispatched via callback props.
 */

import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { cn } from '@/shared/utils/cn';

export interface AltAction {
  label: string;
  onClick: () => void;
}

export interface QuickConfirmCardProps {
  /** Category to confirm. */
  icon: string;
  color: string;
  name: string;
  /** Short reason label (e.g. "привычка", "5×", "2д"). Empty string = hide. */
  reason: string;
  /** Detected amount. */
  amount: number;
  /** Currency symbol. */
  symbol: string;
  /** True while save is in-flight. */
  saving: boolean;
  /** Optional pill shown next to the category name (e.g. "доход"). */
  badge?: string;
  /** Primary confirm action. */
  onConfirm: () => void;
  /** Secondary actions shown in the row below the card. */
  altActions?: AltAction[];
  /** Optional split button label. If omitted, no split button shown. */
  splitLabel?: string;
  onSplit?: () => void;
  /** Extra hint node rendered below the secondary row (e.g. split combo reuse). */
  extraHint?: React.ReactNode;
  /** Cancel / dismiss. */
  onCancel: () => void;
}

export function QuickConfirmCard({
  icon,
  color,
  name,
  reason,
  amount,
  symbol,
  saving,
  badge,
  onConfirm,
  altActions = [],
  splitLabel,
  onSplit,
  extraHint,
  onCancel,
}: QuickConfirmCardProps) {
  return (
    <div className="space-y-1.5">
      {/* Primary confirm button */}
      <button
        onClick={onConfirm}
        disabled={saving}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3.5 rounded-2xl',
          'text-white font-black active:scale-[0.98] transition-all disabled:opacity-50',
        )}
        style={{ background: color, boxShadow: `0 8px 20px ${color}55` }}
      >
        <div className="flex items-center gap-3">
          <StickerIcon icon={icon} color="#fff" className="h-5 w-5 flex-shrink-0" />
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-sm leading-tight">{name}</span>
              {badge && (
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded-full opacity-80"
                  style={{ background: 'rgba(255,255,255,0.25)' }}
                >
                  {badge}
                </span>
              )}
            </div>
            {reason && (
              <div className="text-[10px] opacity-70 font-semibold leading-tight mt-0.5">
                {reason}
              </div>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg leading-tight tabular-nums">{symbol}{amount}</div>
          {saving && <div className="text-[10px] opacity-70 mt-0.5">…</div>}
        </div>
      </button>

      {/* Secondary actions row */}
      <div className="flex items-center gap-3 px-1 flex-wrap">
        {splitLabel && onSplit && (
          <button
            onClick={onSplit}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            {splitLabel}
          </button>
        )}
        {altActions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            disabled={saving}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            {a.label}
          </button>
        ))}
        <button
          onClick={onCancel}
          className="ml-auto text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Отмена
        </button>
      </div>

      {/* Extra hint (e.g. split combo reuse) */}
      {extraHint}
    </div>
  );
}
