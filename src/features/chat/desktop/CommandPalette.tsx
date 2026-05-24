'use client';
import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useAppSelector } from '@/store/store';

interface Props { onClose: () => void; }

export function CommandPalette({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const expenses = useAppSelector((s) => s.expenses.list ?? []);
  const categories = useAppSelector((s) => s.categories.expense);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Global Cmd+K closes this when already open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const q = query.toLowerCase().trim();
  const results = q.length >= 2
    ? expenses
        .filter((e) => {
          const cat = categories.find((c) => c.id === e.categoryId);
          return (
            (e.comment ?? '').toLowerCase().includes(q) ||
            (cat?.name ?? '').toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 w-full max-w-[560px] rounded-2xl overflow-hidden"
        style={{ background: C.card, boxShadow: '0 20px 60px rgba(61,44,31,.2)', border: `1px solid ${C.hairline}` }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: `1px solid ${C.hairline}` }}>
          <Search className="h-5 w-5 flex-shrink-0" style={{ color: C.sub }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по тратам, категориям…"
            className="flex-1 text-[15px] font-[700] bg-transparent outline-none"
            style={{ color: C.fg }}
          />
          <button onClick={onClose} className="flex-shrink-0" style={{ color: C.sub }}>
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {q.length >= 2 && results.length === 0 && (
            <p className="px-5 py-6 text-center text-sm font-semibold" style={{ color: C.sub }}>Ничего не найдено</p>
          )}
          {results.map((e) => {
            const cat = categories.find((c) => c.id === e.categoryId);
            return (
              <div
                key={e.id}
                className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-black/[0.03]"
                style={{ borderBottom: `1px solid ${C.hairline}80` }}
              >
                <div>
                  <p className="text-sm font-bold" style={{ color: C.fg }}>{e.comment || cat?.name || 'Трата'}</p>
                  <p className="text-xs font-semibold" style={{ color: C.sub }}>{cat?.name} · {new Date(e.date).toLocaleDateString('ru')}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: C.fg }}>₪{e.amount.toLocaleString()}</span>
              </div>
            );
          })}
          {q.length < 2 && (
            <div className="px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: C.sub }}>Команды</p>
              {['/баланс', '/неделя', '/конверты'].map((cmd) => (
                <div key={cmd} className="flex items-center gap-3 py-2 cursor-pointer">
                  <code className="text-sm font-bold" style={{ color: C.primary }}>{cmd}</code>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-5 py-2.5" style={{ borderTop: `1px solid ${C.hairline}`, background: C.bgSoft }}>
          <span className="text-[10px] font-semibold" style={{ color: C.sub }}>↵ открыть · ESC закрыть · поиск локально</span>
        </div>
      </div>
    </>
  );
}
