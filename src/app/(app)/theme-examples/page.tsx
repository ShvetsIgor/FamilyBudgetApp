'use client';

import { useState } from 'react';

/* ── mock data ─────────────────────────────────────────── */
const DAYS = [
  {
    label: 'Сегодня', sublabel: '21 июня', total: 413,
    items: [
      { id: '1', name: 'Shufersal',    category: 'Продукты',    amount: 340, color: '#3A7D44' },
      { id: '2', name: 'Coffee Aroma', category: 'Кофе',        amount: 28,  color: '#C2641C' },
      { id: '3', name: 'Bolt',         category: 'Транспорт',   amount: 45,  color: '#2E6488' },
    ],
  },
  {
    label: 'Вчера', sublabel: '20 июня', total: 443,
    items: [
      { id: '4', name: 'Netflix',  category: 'Развлечения', amount: 54,  color: '#6A52A0' },
      { id: '5', name: 'H&M',      category: 'Шоппинг',    amount: 389, color: '#B04070' },
    ],
  },
  {
    label: '19 июня', sublabel: '19 июня', total: 1298,
    items: [
      { id: '6', name: 'Leumi Card',   category: 'Счета',     amount: 1200, color: '#A07A12' },
      { id: '7', name: 'Super-Pharm',  category: 'Здоровье',  amount: 98,   color: '#C23A24' },
    ],
  },
];
const MONTHLY_TOTAL = 2154;
const BUDGET = 3000;

/* ─────────────────────────────────────────────────────────
   Tab 1 · СПИСОК  — architectural grid + category colours
───────────────────────────────────────────────────────── */
function ListTheme() {
  const pct = Math.min(100, Math.round((MONTHLY_TOTAL / BUDGET) * 100));
  return (
    <div style={{ background: '#FAFAFA', minHeight: '100%', color: '#0A0A0A' }}>

      {/* Month summary */}
      <div style={{ padding: '28px 24px 20px', borderBottom: '2px solid #0A0A0A' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#888', marginBottom: 6 }}>
              Июнь 2026
            </p>
            <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em' }}>
              ₪{MONTHLY_TOTAL.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>
              Бюджет
            </p>
            <p style={{ fontSize: 18, fontWeight: 800, color: pct > 85 ? '#C23A24' : '#0A0A0A' }}>
              ₪{BUDGET.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Budget bar */}
        <div style={{ marginTop: 16, height: 4, background: '#E8E8E8', borderRadius: 0 }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: pct > 85 ? '#C23A24' : '#0A0A0A',
            transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontSize: 10, color: '#888' }}>{pct}% использовано</span>
          <span style={{ fontSize: 10, color: '#888' }}>осталось ₪{BUDGET - MONTHLY_TOTAL}</span>
        </div>
      </div>

      {/* Category colour legend */}
      <div style={{ display: 'flex', gap: 16, padding: '12px 24px', overflowX: 'auto', borderBottom: '1px solid #E8E8E8' }}>
        {[
          { label: 'Продукты', color: '#3A7D44' },
          { label: 'Шоппинг',  color: '#B04070' },
          { label: 'Счета',    color: '#A07A12' },
          { label: 'Кофе',     color: '#C2641C' },
          { label: 'Транспорт',color: '#2E6488' },
        ].map((c) => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
            <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', whiteSpace: 'nowrap' }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>

      {/* Day groups */}
      {DAYS.map((day) => (
        <div key={day.label}>
          {/* Day header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 24px', background: '#F2F2F2', borderBottom: '1px solid #E0E0E0',
          }}>
            <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800, color: '#555' }}>
              {day.label} · {day.sublabel}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#888', fontVariantNumeric: 'tabular-nums' }}>
              −₪{day.total}
            </span>
          </div>

          {/* Rows */}
          {day.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 24px 16px 20px',
                borderLeft: `4px solid ${item.color}`,
                borderBottom: '1px solid #F0F0F0',
                background: '#FAFAFA',
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0A0A0A', marginBottom: 3 }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: item.color, fontWeight: 700 }}>
                  {item.category}
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', color: '#0A0A0A' }}>
                ₪{item.amount}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ height: 48 }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Tab 2 · ЧАТ  — home page / expense entry via chat
───────────────────────────────────────────────────────── */
type ChatMsg =
  | { type: 'bot-text'; text: string }
  | { type: 'user'; text: string }
  | { type: 'bot-card'; store: string; amount: number; category: string; color: string; confirmed?: boolean };

const CHAT_MESSAGES: ChatMsg[] = [
  { type: 'bot-text', text: 'Привет 👋 Сегодня потрачено ₪413 из ₪3,000' },
  { type: 'user', text: 'шуферсал 340' },
  { type: 'bot-card', store: 'Shufersal', amount: 340, category: 'Продукты', color: '#3A7D44', confirmed: true },
  { type: 'user', text: 'болт 45' },
  { type: 'bot-card', store: 'Bolt', amount: 45, category: 'Транспорт', color: '#2E6488' },
];

function ChatTheme() {
  return (
    <div style={{ background: '#FAFAFA', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Spending summary bar */}
      <div style={{ padding: '16px 20px 14px', background: '#FFFFFF', borderBottom: '2px solid #0A0A0A' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>
              Сегодня
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: '#0A0A0A' }}>
              ₪413
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>
              Июнь
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: '#0A0A0A' }}>
              ₪2,154
            </p>
          </div>
        </div>
        {/* Budget progress */}
        <div style={{ height: 3, background: '#E8E8E8' }}>
          <div style={{ height: '100%', width: '72%', background: '#0A0A0A' }} />
        </div>
        <p style={{ marginTop: 4, fontSize: 10, color: '#888', letterSpacing: '0.05em' }}>
          72% бюджета · осталось ₪846
        </p>
      </div>

      {/* Chat messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CHAT_MESSAGES.map((msg, i) => {
          if (msg.type === 'bot-text') {
            return (
              <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '78%' }}>
                <div style={{
                  background: '#FFFFFF',
                  border: '1px solid #E8E8E8',
                  padding: '10px 14px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#0A0A0A',
                  lineHeight: 1.4,
                }}>
                  {msg.text}
                </div>
              </div>
            );
          }
          if (msg.type === 'user') {
            return (
              <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '60%' }}>
                <div style={{
                  background: '#0A0A0A',
                  padding: '10px 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#FFFFFF',
                }}>
                  {msg.text}
                </div>
              </div>
            );
          }
          if (msg.type === 'bot-card') {
            return (
              <div key={i} style={{ alignSelf: 'flex-start', width: '82%' }}>
                <div style={{
                  background: '#FFFFFF',
                  border: `1px solid #E8E8E8`,
                  borderLeft: `4px solid ${msg.color}`,
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0A0A0A' }}>{msg.store}</div>
                      <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: msg.color, fontWeight: 700, marginTop: 2 }}>
                        {msg.category}
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em', color: '#0A0A0A' }}>
                      ₪{msg.amount}
                    </div>
                  </div>
                  {msg.confirmed ? (
                    <div style={{ fontSize: 11, color: msg.color, fontWeight: 700, letterSpacing: '0.1em' }}>
                      ✓ СОХРАНЕНО
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{
                        flex: 1, padding: '8px 0', background: '#0A0A0A', color: '#FFF',
                        border: 'none', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em',
                        textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        Сохранить
                      </button>
                      <button style={{
                        flex: 1, padding: '8px 0', background: 'transparent', color: '#888',
                        border: '1px solid #DDD', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        Изменить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Quick category chips */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', background: '#FFF', borderTop: '1px solid #E8E8E8' }}>
        {[
          { label: 'Продукты', color: '#3A7D44' },
          { label: 'Кофе',     color: '#C2641C' },
          { label: 'Транспорт',color: '#2E6488' },
          { label: 'Еда',      color: '#C23A24' },
        ].map((c) => (
          <button key={c.label} style={{
            flexShrink: 0, padding: '5px 12px',
            border: `1.5px solid ${c.color}`,
            background: 'transparent', color: c.color,
            fontSize: 11, fontWeight: 800,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div style={{ padding: '10px 16px 20px', background: '#FFFFFF', borderTop: '2px solid #0A0A0A', display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, height: 44, border: '1.5px solid #0A0A0A',
          display: 'flex', alignItems: 'center', padding: '0 14px',
          fontSize: 14, color: '#999',
        }}>
          магазин, сумма…
        </div>
        <button style={{
          width: 44, height: 44, background: '#0A0A0A', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, cursor: 'pointer',
        }}>
          ↑
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Tab 3 · ДОБАВИТЬ  — expense entry screen
───────────────────────────────────────────────────────── */
const CATEGORIES_GRID = [
  { label: 'Продукты',  color: '#3A7D44' },
  { label: 'Кофе',      color: '#C2641C' },
  { label: 'Транспорт', color: '#2E6488' },
  { label: 'Еда',       color: '#C23A24' },
  { label: 'Шоппинг',   color: '#B04070' },
  { label: 'Здоровье',  color: '#C23A24' },
  { label: 'Счета',     color: '#A07A12' },
  { label: 'Прочее',    color: '#6B6356' },
];

const NUMPAD = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

function AddExpenseTheme() {
  const [amount, setAmount] = useState('340');
  const [selectedCat, setSelectedCat] = useState('Продукты');
  const selectedColor = CATEGORIES_GRID.find(c => c.label === selectedCat)?.color ?? '#0A0A0A';

  function handleKey(k: string) {
    if (k === '⌫') { setAmount(a => a.length > 1 ? a.slice(0, -1) : '0'); return; }
    if (k === '.' && amount.includes('.')) return;
    setAmount(a => a === '0' ? k : a + k);
  }

  return (
    <div style={{ background: '#FAFAFA', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Amount hero */}
      <div style={{
        padding: '32px 24px 24px',
        borderBottom: `4px solid ${selectedColor}`,
        background: '#FFFFFF',
      }}>
        <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>
          Shufersal · {selectedCat}
        </p>
        <div style={{
          fontSize: 64, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1,
          color: '#0A0A0A', display: 'flex', alignItems: 'baseline', gap: 4,
        }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: '#888' }}>₪</span>
          <span>{amount}</span>
        </div>
      </div>

      {/* Category selector */}
      <div style={{ padding: '12px 16px', background: '#FFFFFF', borderBottom: '1px solid #E8E8E8' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {CATEGORIES_GRID.map((cat) => {
            const sel = cat.label === selectedCat;
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCat(cat.label)}
                style={{
                  padding: '7px 4px',
                  border: sel ? `2px solid ${cat.color}` : '1.5px solid #E0E0E0',
                  background: sel ? `${cat.color}14` : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
                <span style={{
                  fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontWeight: 800, color: sel ? cat.color : '#888',
                }}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Numpad */}
      <div style={{ flex: 1, padding: '12px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {NUMPAD.map((k) => (
          <button
            key={k}
            onClick={() => handleKey(k)}
            style={{
              height: 56, background: k === '⌫' ? '#F0F0F0' : '#FFFFFF',
              border: '1.5px solid #E0E0E0',
              fontSize: k === '⌫' ? 18 : 22,
              fontWeight: 700, color: '#0A0A0A',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Action row */}
      <div style={{ padding: '12px 16px 24px', display: 'flex', gap: 8 }}>
        <button style={{
          flex: 1, height: 52, border: '1.5px solid #E0E0E0', background: '#F8F8F8',
          fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: '#555', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Разделить
        </button>
        <button style={{
          flex: 2, height: 52, border: 'none',
          background: selectedColor,
          fontSize: 14, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: '#FFF', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Сохранить ₪{amount}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Page shell
───────────────────────────────────────────────────────── */
const TABS = [
  { id: 'list', label: 'Список',    desc: 'Страница расходов' },
  { id: 'chat', label: 'Чат',       desc: 'Главный экран' },
  { id: 'add',  label: 'Добавить',  desc: 'Ввод затраты' },
] as const;
type TabId = typeof TABS[number]['id'];

export default function ThemeExamplesPage() {
  const [active, setActive] = useState<TabId>('list');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100dvh', background: '#111' }}>
      {/* Tab bar */}
      <div style={{ padding: '14px 16px 10px', background: '#111', flexShrink: 0 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
          Предпросмотр дизайна
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                flex: 1, padding: '9px 6px',
                border: 'none', cursor: 'pointer',
                background: active === t.id ? '#FFFFFF' : 'rgba(255,255,255,0.08)',
                color: active === t.id ? '#0A0A0A' : 'rgba(255,255,255,0.45)',
                fontSize: 12, fontWeight: 800,
                letterSpacing: '0.04em',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {TABS.find(t => t.id === active)?.desc}
        </p>
      </div>

      {/* Preview area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {active === 'list' && <ListTheme />}
        {active === 'chat' && <ChatTheme />}
        {active === 'add'  && <AddExpenseTheme />}
      </div>
    </div>
  );
}
