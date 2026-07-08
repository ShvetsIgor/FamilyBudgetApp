'use client';

import { format, parseISO } from 'date-fns';
import { getDateFnsLocale } from '@/shared/utils/dateLocale';
import { X } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { markAllRead, clearNotifications } from '../store/notificationsSlice';
import { C, SHADOW, RAD } from '@/features/chat/styles/tokens';
import { useT } from '@/shared/hooks/useT';

interface Props {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: Props) {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.notifications.items);
  const t = useT();
  const language = useAppSelector((s) => s.ui.language);

  function handleOpen() {
    dispatch(markAllRead());
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(61,44,31,.35)', backdropFilter: 'blur(2px)' }}
        onClick={() => { handleOpen(); onClose(); }}
      />

      {/* Panel */}
      <div
        className="fixed right-3 top-14 z-50 flex flex-col overflow-hidden"
        style={{
          width: 'min(360px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 80px)',
          background: C.bg,
          borderRadius: RAD.hero,
          boxShadow: SHADOW.card,
          animation: 'fadeSlideDown 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}
        onAnimationStart={handleOpen}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: `1px solid ${C.hairline}` }}
        >
          <span className="text-[15px] font-[800]" style={{ color: C.fg }}>
            {t('notifications.title')}
          </span>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={() => dispatch(clearNotifications())}
                className="text-[11px] font-[700] px-2 py-1 rounded-lg"
                style={{ color: C.sub, background: C.card }}
              >
                {t('notifications.clear')}
              </button>
            )}
            <button
              onClick={() => { handleOpen(); onClose(); }}
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ background: C.card, color: C.sub }}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-3xl">🔔</span>
              <p className="text-[13px] font-[700]" style={{ color: C.sub }}>
                {t('notifications.empty')}
              </p>
            </div>
          ) : (
            items.map((n) => {
              const dateLabel = (() => {
                try {
                  return format(parseISO(n.createdAt), 'd MMM, HH:mm', { locale: getDateFnsLocale(language) });
                } catch { return ''; }
              })();

              return (
                <div
                  key={n.id}
                  className="flex gap-3 px-4 py-3.5"
                  style={{
                    borderBottom: `1px solid ${C.hairline}`,
                    background: n.read ? 'transparent' : C.primaryTint + '22',
                  }}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] text-lg"
                    style={{ background: C.primaryTint + '44' }}
                  >
                    {n.kind === 'morning' ? '🌅' : n.kind === 'weekly' ? '📊' : n.kind === 'family_invite' ? '👨‍👩‍👧' : '🔔'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[13.5px] font-[800] leading-tight" style={{ color: C.fg }}>
                      {n.title}
                    </p>
                    <p className="m-0 mt-0.5 text-[12px] font-[600] leading-snug" style={{ color: C.sub }}>
                      {n.text}
                    </p>
                    {dateLabel && (
                      <p className="m-0 mt-1 text-[11px] font-[700]" style={{ color: C.sub + '99' }}>
                        {dateLabel}
                      </p>
                    )}
                  </div>
                  {!n.read && (
                    <div className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full" style={{ background: C.primary }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
