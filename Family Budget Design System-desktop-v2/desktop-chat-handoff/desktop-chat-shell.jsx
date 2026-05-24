/* Desktop chat — shared shell, sidebar, right panel, system messages, composer.
   Reuses tokens/bubbles from chat-app.jsx. Adds theme + density via context. */

const { C: BASE_C, T, SHADOW, RAD, Sk,
  BotBubble, BotCardBubble, UserBubble, SavedRow, Envelope, QuickReplies, Typing } = window;

/* ─── Theme ─── */
const DARK = {
  bg:       '#231811',
  bgSoft:   '#2D1F16',
  card:     '#FFFFFF',     // bot card bubbles stay light (iMessage on dark)
  cardTint: '#FEFAF3',
  fg:       '#FBF6EE',
  fgSoft:   '#E9DDCB',
  sub:      '#A8927A',
  hairline: '#3D2A1E',
  // chrome (sidebar/right panel) tokens — distinct so the chrome looks dark too
  chromeBg:    '#1A110A',
  chromeBg2:   '#231811',
  chromeCard:  '#2D1F16',
  chromeBorder:'#3D2A1E',
  chromeFg:    '#FBF6EE',
  chromeSub:   '#A8927A',
};
const LIGHT = {
  ...BASE_C,
  chromeBg:    BASE_C.bg,
  chromeBg2:   BASE_C.bgSoft,
  chromeCard:  BASE_C.card,
  chromeBorder:BASE_C.hairline,
  chromeFg:    BASE_C.fg,
  chromeSub:   BASE_C.sub,
};

const ThemeCtx = React.createContext({ C: LIGHT, dark: false, density: 'cozy' });
const useTheme = () => React.useContext(ThemeCtx);

function ThemeProvider({ dark, density, children }) {
  const value = React.useMemo(() => ({
    C: dark ? { ...BASE_C, ...DARK } : LIGHT,
    dark,
    density: density || 'cozy',
  }), [dark, density]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

const DENSITY = {
  compact:     { pad: 14,  gap: 4,  bubbleY: 4,  cardPad: 10 },
  cozy:        { pad: 20,  gap: 8,  bubbleY: 8,  cardPad: 14 },
  comfortable: { pad: 28,  gap: 12, bubbleY: 12, cardPad: 18 },
};

/* ─── Desktop sidebar ─── */
const SIDEBAR_SECTIONS = [
  {
    label: 'budget',
    items: [
      { icon: 'chart_up', color: '#E07A5F', label: 'Чат',          href: 'chat', active: true },
      { icon: 'box',      color: '#81B29A', label: 'Конверты',     count: 5 },
      { icon: 'cart',     color: '#D4A574', label: 'Транзакции',   sub: 'май · 47 операций' },
      { icon: 'piggy',    color: '#A48BC9', label: 'Копилки',      sub: '3 цели · ₪18 100' },
    ],
  },
  {
    label: 'planning',
    items: [
      { icon: 'refund', color: '#F2CC8F', label: 'Регулярные', count: 2 },
      { icon: 'gift',   color: '#C97B84', label: 'Семья',      sub: '3 участника' },
    ],
  },
  {
    label: 'system',
    items: [
      { icon: 'cog', color: '#8E7A66', label: 'Настройки' },
    ],
  },
];

function DesktopSidebar({ activeKey = 'chat', collapsed = false, onClick }) {
  const { C, dark } = useTheme();
  return (
    <aside style={{
      width: collapsed ? 76 : 260,
      flexShrink: 0,
      background: C.chromeBg,
      borderRight: `1px solid ${C.chromeBorder}`,
      display: 'flex', flexDirection: 'column',
      transition: 'width .2s',
      overflow: 'hidden',
    }}>
      {/* Brand */}
      <div style={{
        height: 64, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${C.chromeBorder}`,
        flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: `radial-gradient(circle at 30% 30%, ${C.primaryTint}, ${C.primary}33)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.5)',
        }}>
          <Sk icon="piggy" color={C.primary} size={26}/>
        </div>
        {!collapsed && (
          <p style={{ ...T.h2, color: C.chromeFg, margin: 0, fontSize: 15, letterSpacing: -.3 }}>
            <span style={{ color: C.primary }}>family</span>
            <span style={{ color: C.chromeSub, fontWeight: 700 }}>.</span>
            <span>budget</span>
          </p>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>
        {SIDEBAR_SECTIONS.map((s) => (
          <div key={s.label}>
            {!collapsed && (
              <p style={{ ...T.caption, color: C.chromeSub, opacity: .65, margin: '0 10px 6px', fontSize: 9.5 }}>{s.label}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {s.items.map((it) => {
                const active = it.active || it.label.toLowerCase() === activeKey;
                return (
                  <button key={it.label} onClick={() => onClick && onClick(it.label)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: collapsed ? '10px' : '9px 10px',
                    borderRadius: 12, border: 0, cursor: 'pointer',
                    background: active ? C.primary : 'transparent',
                    color: active ? '#fff' : C.chromeFg,
                    textAlign: 'left',
                    boxShadow: active ? `0 4px 12px ${C.primary}44` : 'none',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                      background: active ? 'rgba(255,255,255,.16)' : (dark ? it.color + '22' : it.color + '20'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Sk icon={it.icon} color={active ? '#fff' : it.color} size={20}/>
                    </div>
                    {!collapsed && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>{it.label}</p>
                        {it.sub && <p style={{ fontSize: 10.5, fontWeight: 700, opacity: .65, margin: '2px 0 0' }}>{it.sub}</p>}
                      </div>
                    )}
                    {!collapsed && it.count != null && (
                      <span style={{
                        minWidth: 20, height: 20, borderRadius: 10,
                        background: active ? 'rgba(255,255,255,.22)' : it.color + '22',
                        color: active ? '#fff' : it.color,
                        fontSize: 10.5, fontWeight: 900, lineHeight: '20px', textAlign: 'center', padding: '0 6px',
                      }}>{it.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div style={{
        flexShrink: 0, padding: '10px 12px',
        borderTop: `1px solid ${C.chromeBorder}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 900, flexShrink: 0,
        }}>И</div>
        {!collapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: C.chromeFg, margin: 0 }}>Игорь Шевц</p>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0' }}>с мая 2026</p>
            </div>
            <button style={{
              width: 28, height: 28, borderRadius: 8, border: 0,
              background: 'transparent', color: C.chromeSub, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

/* ─── Desktop chat header (slim) ─── */
function DesktopChatHeader({ title = 'Семейный чат', subtitle = '3 участника · бот считает локально' }) {
  const { C } = useTheme();
  return (
    <div style={{
      height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14,
      borderBottom: `1px solid ${C.chromeBorder}`, background: C.bg, flexShrink: 0,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: `radial-gradient(circle at 30% 30%, ${C.primaryTint}, ${C.primary}33)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sk icon="piggy" color={C.primary} size={30}/>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ ...T.h2, color: C.fg, margin: 0, fontSize: 16 }}>{title}</p>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: C.sage, margin: '1px 0 0' }}>● {subtitle}</p>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { svg: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></> },
          { svg: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></> },
          { svg: <><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></> },
        ].map((b, i) => (
          <button key={i} style={{
            width: 36, height: 36, borderRadius: 10, border: 0, background: 'transparent', color: C.sub, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{b.svg}</svg>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Family system message (centered chip) ─── */
function SystemMessage({ who = 'Аня', whoColor = '#A48BC9', icon = 'cart', iconColor = '#E07A5F',
                        amount, category, hint, time }) {
  const { C } = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 14px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '6px 12px 6px 6px', borderRadius: 999,
        background: C.cardTint, border: `1px dashed ${C.hairline}`,
        boxShadow: '0 1px 2px rgba(61,44,31,.04)',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%', background: whoColor,
          color: '#fff', fontSize: 10, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{who[0]}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.fg }}>{who}</span>
        <Sk icon={icon} color={iconColor} size={16}/>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.fg, fontVariantNumeric: 'tabular-nums' }}>₪{amount}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.sub }}>→ {category}</span>
        {hint && <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, opacity: .8 }}>· {hint}</span>}
        {time && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.sub, opacity: .7, fontVariantNumeric: 'tabular-nums' }}>{time}</span>}
      </div>
    </div>
  );
}

/* ─── Desktop composer ─── */
function DesktopComposer({ value = '', placeholder = 'Запиши быстро — «хлеб 12», «65 кофе», «sonol 200»…', focused = false, hint }) {
  const { C } = useTheme();
  return (
    <div style={{
      padding: '12px 24px 18px', borderTop: `1px solid ${C.hairline}`,
      background: C.bg, flexShrink: 0,
    }}>
      {hint && (
        <div style={{ marginBottom: 8, fontSize: 11.5, fontWeight: 700, color: C.sub, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sk icon="coin" color={C.primary} size={14}/> {hint}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{
          width: 42, height: 42, borderRadius: 12, border: `1.5px solid ${C.hairline}`, background: C.card, color: C.sub, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10"/>
          </svg>
        </button>
        <div style={{
          flex: 1, background: C.card, borderRadius: 14,
          padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 10,
          border: `1.5px solid ${focused || value ? C.primary : C.hairline}`,
          minHeight: 42, boxSizing: 'border-box',
          boxShadow: focused ? `0 0 0 4px ${C.primary}1a` : SHADOW.bubble,
        }}>
          {value ? (
            <span style={{ ...T.body, color: C.fg, flex: 1 }}>
              {value}
              <span style={{ display: 'inline-block', width: 1.5, height: 16, background: C.primary, marginLeft: 2, verticalAlign: 'middle' }}/>
            </span>
          ) : (
            <span style={{ ...T.bodySoft, color: C.sub, flex: 1 }}>{placeholder}</span>
          )}
          <span style={{ fontSize: 10.5, fontWeight: 800, color: C.sub, opacity: .7, padding: '2px 6px', border: `1px solid ${C.hairline}`, borderRadius: 6 }}>↵</span>
        </div>
        <button style={{
          width: 46, height: 46, borderRadius: 14, border: 0,
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 6px 14px ${C.primaryDeep}44`, cursor: 'pointer', flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Right panel cards ─── */

function RPCard({ title, action, children, accent }) {
  const { C } = useTheme();
  return (
    <div style={{
      background: C.chromeCard, borderRadius: 16,
      border: `1px solid ${C.chromeBorder}`,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(61,44,31,.04)',
    }}>
      <div style={{
        padding: '11px 14px 8px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: accent ? `2px solid ${accent}` : 'none',
      }}>
        <p style={{ ...T.caption, color: C.chromeSub, margin: 0, fontSize: 10, flex: 1 }}>{title}</p>
        {action && <span style={{ fontSize: 10.5, fontWeight: 800, color: accent || C.primary, cursor: 'pointer' }}>{action}</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* Pinned today (sized for right panel) */
function RPToday({ spent = 75, total = 200 }) {
  const { C } = useTheme();
  const left = total - spent;
  const pct = (left / total) * 100;
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 20,
      background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDeep} 100%)`,
      color: '#fff', position: 'relative', overflow: 'hidden',
      boxShadow: SHADOW.pinned,
    }}>
      <svg style={{ position: 'absolute', top: -24, right: -28, opacity: .22 }} width="130" height="130" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none"/>
        <circle cx="60" cy="60" r="44" stroke="white" strokeWidth="1" fill="none" opacity=".7"/>
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        <Sk icon="coin" color={C.yellow} size={26}/>
        <p style={{ ...T.caption, opacity: .82, margin: 0 }}>На сегодня · ср</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6, position: 'relative' }}>
        <span style={{ ...T.display, fontSize: 30 }}>₪{left}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, opacity: .82 }}>из ₪{total}</span>
      </div>
      <p style={{ fontSize: 11.5, fontWeight: 700, opacity: .85, margin: '2px 0 0', position: 'relative' }}>
        потрачено ₪{spent} · {Math.round((spent/total)*100)}% дня
      </p>
      <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.22)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: pct + '%', height: '100%', background: '#fff', borderRadius: 3 }}/>
      </div>
    </div>
  );
}

/* Envelopes mini-list for right panel */
function RPEnvelopes() {
  return (
    <RPCard title="КОНВЕРТЫ · НЕДЕЛЯ" action="всё →" accent="#81B29A">
      {[
        { name: 'Продукты',    icon: 'cart',   color: '#E07A5F', spent: 320, limit: 600 },
        { name: 'Кафе',        icon: 'plate',  color: '#D4A574', spent: 140, limit: 200, warn: true },
        { name: 'Машина',      icon: 'car',    color: '#8AA9D6', spent: 240, limit: 400 },
        { name: 'Дом и счета', icon: 'house',  color: '#81B29A', spent: 380, limit: 600 },
      ].map((e, i, arr) => (
        <div key={e.name} style={{ borderTop: i > 0 ? '1px solid #EDE0CC' : 'none' }}>
          <Envelope name={e.name} icon={e.icon} color={e.color} spent={e.spent} limit={e.limit}/>
        </div>
      ))}
    </RPCard>
  );
}

/* Goals */
function RPGoals() {
  const { C } = useTheme();
  const goals = [
    { name: 'Отпуск Грузия',  icon: 'piggy', color: '#A48BC9', saved: 8400, target: 14000, ahead: true },
    { name: 'Новый ноутбук',  icon: 'gift',  color: '#E9B384', saved: 6200, target: 12000 },
    { name: 'Подушка 3 мес',  icon: 'box',   color: '#81B29A', saved: 3500, target: 24000 },
  ];
  return (
    <RPCard title="КОПИЛКИ" action="+ цель" accent="#A48BC9">
      <div style={{ padding: '6px 14px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {goals.map((g) => {
          const pct = (g.saved / g.target) * 100;
          return (
            <div key={g.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: g.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sk icon={g.icon} color={g.color} size={22}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: C.chromeFg }}>{g.name}</span>
                    {g.ahead && (
                      <span style={{ fontSize: 9.5, fontWeight: 900, color: '#81B29A', textTransform: 'uppercase', letterSpacing: '.04em' }}>+опережение</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                    ₪{g.saved.toLocaleString('ru')} / {g.target.toLocaleString('ru')}
                  </p>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 900, color: g.color, fontVariantNumeric: 'tabular-nums' }}>{Math.round(pct)}%</span>
              </div>
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(142,122,102,.18)', overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: g.color, borderRadius: 2 }}/>
              </div>
            </div>
          );
        })}
      </div>
    </RPCard>
  );
}

/* Upcoming bills — featured panel */
function RPBills({ featured = false }) {
  const { C } = useTheme();
  const bills = [
    { name: 'Аренда квартиры', icon: 'house',  color: '#81B29A', amount: 4600, when: 'через 3 дня', date: '20 мая', auto: true },
    { name: 'Интернет Bezeq',  icon: 'phone',  color: '#8AA9D6', amount: 145,  when: 'через 5 дней', date: '22 мая', auto: true },
    { name: 'Спортзал',        icon: 'box',    color: '#E07A5F', amount: 199,  when: 'через 12 дней', date: '29 мая' },
    { name: 'Cellcom',         icon: 'phone',  color: '#A48BC9', amount: 89,   when: 'через 14 дней', date: '31 мая', auto: true },
  ];
  const total = bills.reduce((s, b) => s + b.amount, 0);
  return (
    <RPCard
      title={featured ? 'РЕГУЛЯРНЫЕ · БЛИЖАЙШИЕ 14 ДНЕЙ' : 'РЕГУЛЯРНЫЕ · 14 ДНЕЙ'}
      action="всё →"
      accent="#F2CC8F"
    >
      <div style={{ padding: '8px 14px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ ...T.display, fontSize: 22, color: C.chromeFg }}>₪{total.toLocaleString('ru')}</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.chromeSub }}>· {bills.length} платежа</span>
        </div>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0' }}>учтено в плане месяца</p>
      </div>
      <div style={{ padding: '4px 0 10px' }}>
        {bills.map((b, i) => (
          <div key={b.name} style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '8px 14px',
            borderTop: i > 0 ? `1px solid ${C.chromeBorder}` : 'none',
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: b.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sk icon={b.icon} color={b.color} size={22}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 800, color: C.chromeFg, margin: 0 }}>{b.name}</p>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                {b.date} · {b.when}
                {b.auto && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#81B29A' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    авто
                  </span>
                )}
              </p>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 900, color: C.chromeFg, fontVariantNumeric: 'tabular-nums' }}>₪{b.amount.toLocaleString('ru')}</span>
          </div>
        ))}
      </div>
    </RPCard>
  );
}

/* Recent transactions list */
function RPRecent() {
  const { C } = useTheme();
  const tx = [
    { icon: 'cart',  color: '#E07A5F', who: 'я',   title: 'Хлеб', cat: 'Продукты', amt: 12,  time: '09:14' },
    { icon: 'plate', color: '#D4A574', who: 'я',   title: 'Кофе', cat: 'Кафе',     amt: 65,  time: '11:42' },
    { icon: 'cart',  color: '#E07A5F', who: 'Аня', title: 'Молоко·яйца', cat: 'Продукты', amt: 50, time: '09:32' },
    { icon: 'fuel',  color: '#8AA9D6', who: 'я',   title: 'Sonol', cat: 'Бензин',   amt: 200, time: '14:08' },
  ];
  return (
    <RPCard title="СЕГОДНЯ · ПОСЛЕДНИЕ ОПЕРАЦИИ" action="всё →" accent="#E07A5F">
      <div style={{ padding: '2px 0 6px' }}>
        {tx.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderTop: i > 0 ? `1px solid ${C.chromeBorder}` : 'none' }}>
            <Sk icon={t.icon} color={t.color} size={22}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: C.chromeFg, margin: 0 }}>{t.title} · <span style={{ color: C.chromeSub, fontWeight: 700 }}>{t.cat}</span></p>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0' }}>{t.who} · {t.time}</p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 900, color: C.chromeFg, fontVariantNumeric: 'tabular-nums' }}>−₪{t.amt}</span>
          </div>
        ))}
      </div>
    </RPCard>
  );
}

/* Right panel container */
function RightPanel({ children, width = 340 }) {
  const { C } = useTheme();
  return (
    <aside style={{
      width, flexShrink: 0,
      background: C.chromeBg2,
      borderLeft: `1px solid ${C.chromeBorder}`,
      overflowY: 'auto',
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {children}
    </aside>
  );
}

Object.assign(window, {
  ThemeProvider, useTheme, DENSITY,
  DesktopSidebar, DesktopChatHeader, DesktopComposer,
  SystemMessage, RightPanel,
  RPCard, RPToday, RPEnvelopes, RPGoals, RPBills, RPRecent,
});
