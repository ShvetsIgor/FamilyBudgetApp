'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { RAD, SHADOW } from '@/features/chat/styles/tokens';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useT } from '@/shared/hooks/useT';

interface HelpSheetProps {
  onClose: () => void;
}

interface Tip {
  icon: string;
  color: string;
  title: string;
  desc: string;
  example?: string;
}

export function HelpSheet({ onClose }: HelpSheetProps) {
  const C = useChatTokens();
  const t = useT();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tips: Tip[] = [
    {
      icon: 'cash',
      color: C.primary,
      title: t('chat.help.tip1.title'),
      desc: t('chat.help.tip1.desc'),
      example: t('chat.help.tip1.example'),
    },
    {
      icon: 'receipt',
      color: C.sage,
      title: t('chat.help.tip2.title'),
      desc: t('chat.help.tip2.desc'),
      example: t('chat.help.tip2.example'),
    },
    {
      icon: 'book',
      color: C.lavender,
      title: t('chat.help.tip3.title'),
      desc: t('chat.help.tip3.desc'),
      example: t('chat.help.tip3.example'),
    },
    {
      icon: 'refund',
      color: C.caramel,
      title: t('chat.help.tip4.title'),
      desc: t('chat.help.tip4.desc'),
    },
    {
      icon: 'star',
      color: '#F2CC8F',
      title: t('chat.help.tip5.title'),
      desc: t('chat.help.tip5.desc'),
      example: t('chat.help.tip5.example'),
    },
    {
      icon: 'briefcase',
      color: '#81B29A',
      title: t('chat.help.tip6.title'),
      desc: t('chat.help.tip6.desc'),
      example: t('chat.help.tip6.example'),
    },
    {
      icon: 'chart_up',
      color: '#E07A5F',
      title: t('chat.help.tip7.title'),
      desc: t('chat.help.tip7.desc'),
      example: t('chat.help.tip7.example'),
    },
    {
      icon: 'card',
      color: '#A48BC9',
      title: t('chat.help.tip8.title'),
      desc: t('chat.help.tip8.desc'),
      example: t('chat.help.tip8.example'),
    },
    {
      icon: 'hands',
      color: '#7BA6DE',
      title: t('chat.help.tip9.title'),
      desc: t('chat.help.tip9.desc'),
      example: t('chat.help.tip9.example'),
    },
    {
      icon: 'wifi',
      color: '#D98CA6',
      title: t('chat.help.tip10.title'),
      desc: t('chat.help.tip10.desc'),
      example: t('chat.help.tip10.example'),
    },
  ];

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(61,44,31,.42)', backdropFilter: 'blur(2px)' }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col overflow-hidden"
        style={{
          background: C.bg,
          borderRadius: `${RAD.hero} ${RAD.hero} 0 0`,
          boxShadow: SHADOW.card,
          maxHeight: '88vh',
          animation: 'slideUp 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[12px]"
              style={{ background: C.primary + '18' }}
            >
              <StickerIcon icon="piggy" color={C.primary} className="h-6 w-6" />
            </div>
            <div>
              <p className="m-0 text-[16px] font-black" style={{ color: C.fg }}>{t('chat.help.title')}</p>
              <p className="m-0 text-[11.5px] font-bold" style={{ color: C.sub }}>{t('chat.help.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-opacity active:opacity-50"
            style={{ background: C.card, color: C.sub }}
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px shrink-0" style={{ background: C.hairline }} />

        {/* Tips list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {tips.map((tip, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-[18px] p-4"
              style={{ background: C.card, border: `1px solid ${C.hairline}` }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                style={{ background: tip.color + '18' }}
              >
                <StickerIcon icon={tip.icon} color={tip.color} className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <p className="m-0 text-[13.5px] font-black" style={{ color: C.fg }}>{tip.title}</p>
                <p className="m-0 mt-0.5 text-[12.5px] font-semibold leading-[1.45]" style={{ color: C.sub }}>{tip.desc}</p>
                {tip.example && (
                  <div
                    className="mt-2 inline-block rounded-[10px] px-3 py-1.5"
                    style={{ background: tip.color + '14', border: `1px solid ${tip.color}33` }}
                  >
                    <span className="text-[12px] font-extrabold" style={{ color: tip.color }}>{tip.example}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="h-4" />
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
