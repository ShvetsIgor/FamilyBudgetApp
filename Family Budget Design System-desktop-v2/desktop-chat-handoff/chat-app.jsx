/* Chat concept · refined component library
   ----------------------------------------------------------
   Palette, type tokens, bot/user bubbles, rich cards, composer, menu.
   No state — pure presentational. Children pass content. */

const { I: STICKER, TAXONOMY: TAX, INCOME: INC } = window.ICON_LIB;

/* ─────────── 1. Design tokens ─────────── */

const C = {
  primary:      '#E07A5F',
  primaryDeep:  '#C9684E',   // gradients, pressed
  primaryTint:  '#FAEAE2',   // halo
  sage:         '#81B29A',
  sageDeep:     '#6B9683',
  lavender:     '#A48BC9',
  yellow:       '#F2CC8F',
  rose:         '#C97B84',
  caramel:      '#D4A574',
  blueSoft:     '#8AA9D6',
  olive:        '#A8B89C',
  apricot:      '#E9B384',

  bg:           '#FBF6EE',   // page cream
  bgSoft:       '#F4ECDE',   // subtle bg (chips inactive)
  card:         '#FFFFFF',
  cardTint:     '#FEFAF3',   // bot bubble bg (warmer than pure white)
  fg:           '#3D2C1F',
  fgSoft:       '#5B4633',
  sub:          '#8E7A66',
  hairline:     '#EDE0CC',
};

const T = {
  display:  { fontFamily: 'Nunito,sans-serif', fontSize: 32, fontWeight: 900, letterSpacing: -.8, lineHeight: 1,    fontVariantNumeric: 'tabular-nums' },
  h1:       { fontFamily: 'Nunito,sans-serif', fontSize: 22, fontWeight: 900, letterSpacing: -.4, lineHeight: 1.1,  fontVariantNumeric: 'tabular-nums' },
  h2:       { fontFamily: 'Nunito,sans-serif', fontSize: 17, fontWeight: 800, letterSpacing: -.2, lineHeight: 1.2 },
  amount:   { fontFamily: 'Nunito,sans-serif', fontSize: 17, fontWeight: 900, letterSpacing: -.3, fontVariantNumeric: 'tabular-nums' },
  body:     { fontFamily: 'Nunito,sans-serif', fontSize: 14.5, fontWeight: 700, lineHeight: 1.4 },
  bodySoft: { fontFamily: 'Nunito,sans-serif', fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: C.sub },
  caption:  { fontFamily: 'Nunito,sans-serif', fontSize: 11, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase' },
  time:     { fontFamily: 'Nunito,sans-serif', fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
};

const SHADOW = {
  bubble: '0 1px 2px rgba(61,44,31,.05), 0 4px 14px rgba(61,44,31,.04)',
  card:   '0 1px 2px rgba(61,44,31,.06), 0 8px 22px rgba(61,44,31,.07)',
  user:   `0 4px 14px ${C.primaryDeep}30`,
  pinned: `0 14px 28px ${C.primaryDeep}38`,
  menu:   '14px 0 40px rgba(61,44,31,.25)',
};

const RAD = { chip: 999, bubble: 18, card: 22, hero: 26 };

/* ─────────── 2. Sticker helper ─────────── */
let _skId = 0;
function Sk({ icon, color, size = 24 }) {
  const Comp = STICKER[icon] || STICKER.box;
  const id = React.useMemo(() => `sk-${++_skId}`, []);
  return <span style={{ display: 'inline-flex', width: size, height: size, lineHeight: 0, flexShrink: 0 }}><Comp c={color} id={id}/></span>;
}

/* ─────────── 3. Chat header ─────────── */
function ChatHeader({ onMenu, unread = true }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 5,
      background: C.bg, padding: '54px 14px 12px',
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: '1px solid ' + C.hairline,
    }}>
      <button onClick={onMenu} style={iconBtn(36, C.fg)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M3 7h18M3 12h13M3 17h18"/>
        </svg>
      </button>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${C.primaryTint}, ${C.primary}22)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.7)',
        }}>
          <Sk icon="piggy" color={C.primary} size={30}/>
        </div>
        <span style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 11, height: 11, borderRadius: '50%',
          background: C.sage, border: '2.5px solid ' + C.bg,
        }}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...T.h2, color: C.fg, margin: 0, letterSpacing: -.3 }}>
          <span style={{ color: C.primary }}>family</span>
          <span style={{ color: C.sub, fontWeight: 700 }}>.</span>
          budget
        </p>
        <p style={{ ...T.caption, color: C.sage, margin: '1px 0 0', letterSpacing: '.04em', textTransform: 'none', fontSize: 11, fontWeight: 700 }}>
          онлайн · считает локально
        </p>
      </div>
      <button style={{ ...iconBtn(36, C.fg), position: 'relative' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>
        </svg>
        {unread && <span style={{
          position: 'absolute', top: 7, right: 7,
          minWidth: 16, height: 16, borderRadius: 8,
          background: C.primary, color: 'white',
          fontSize: 10, fontWeight: 900, lineHeight: '16px', textAlign: 'center',
          border: '2px solid ' + C.bg, padding: '0 4px',
        }}>2</span>}
      </button>
    </div>
  );
}

function iconBtn(size, color) {
  return {
    width: size, height: size, borderRadius: 12, border: 0,
    background: 'transparent', color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  };
}

/* ─────────── 4. Pinned "today" card ─────────── */
function PinnedToday({ spent = 60, total = 200, day = 'среда' }) {
  const left = total - spent;
  const pct = (left / total) * 100;
  return (
    <div style={{
      margin: '12px 14px 0', padding: '14px 18px 14px 16px',
      borderRadius: RAD.hero,
      background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDeep} 110%)`,
      color: 'white', position: 'relative', overflow: 'hidden',
      boxShadow: SHADOW.pinned,
    }}>
      {/* decorative ring */}
      <svg style={{ position: 'absolute', top: -20, right: -28, opacity: .25 }} width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none"/>
        <circle cx="60" cy="60" r="44" stroke="white" strokeWidth="1" fill="none" opacity=".7"/>
      </svg>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Sk icon="coin" color={C.yellow} size={32}/>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ ...T.caption, opacity: .8, margin: 0 }}>На сегодня · {day}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ ...T.display, fontSize: 30 }}>₪{left}</span>
            <span style={{ fontSize: 13, fontWeight: 800, opacity: .8 }}>из ₪{total}</span>
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, opacity: .85, margin: '2px 0 0' }}>
            потрачено ₪{spent} · уже {Math.round((spent/total)*100)}%
          </p>
        </div>
        <button style={{
          width: 28, height: 28, borderRadius: '50%', border: 0,
          background: 'rgba(255,255,255,.16)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
      {/* progress */}
      <div style={{ marginTop: 12, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.22)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: 'rgba(255,255,255,.95)', borderRadius: 3 }}/>
      </div>
    </div>
  );
}

/* ─────────── 5. Date separator ─────────── */
function DateChip({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 6px' }}>
      <span style={{
        padding: '5px 14px', borderRadius: 999,
        background: 'rgba(142, 122, 102, .12)', color: C.sub,
        fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
      }}>{children}</span>
    </div>
  );
}

/* ─────────── 6. Bot avatar slot ─────────── */
function BotAvatar({ visible = true }) {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      background: `linear-gradient(135deg, ${C.primaryTint}, ${C.primary}22)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, alignSelf: 'flex-end',
      visibility: visible ? 'visible' : 'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.6)',
    }}>
      <Sk icon="piggy" color={C.primary} size={18}/>
    </div>
  );
}

/* ─────────── 7. Bot bubble (plain text) ─────────── */
function BotBubble({ children, time, tail = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, margin: tail ? '8px 14px 2px' : '2px 14px', maxWidth: '85%' }}>
      <BotAvatar visible={tail}/>
      <div style={{
        background: C.cardTint,
        padding: '9px 13px',
        borderRadius: RAD.bubble,
        borderBottomLeftRadius: tail ? 6 : RAD.bubble,
        boxShadow: SHADOW.bubble,
        color: C.fg, ...T.body,
        position: 'relative',
      }}>
        {children}
        {time && <span style={{ ...T.time, color: C.sub, marginLeft: 8, opacity: .8 }}>{time}</span>}
      </div>
    </div>
  );
}

/* ─────────── 8. Bot card bubble (rich) ─────────── */
function BotCardBubble({ children, tail = true, wide = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, margin: tail ? '8px 14px 2px' : '2px 14px' }}>
      <BotAvatar visible={tail}/>
      <div style={{
        background: C.card, borderRadius: RAD.card,
        borderBottomLeftRadius: tail ? 6 : RAD.card,
        boxShadow: SHADOW.card,
        overflow: 'hidden',
        maxWidth: wide ? 320 : 296,
        width: '100%',
      }}>
        {children}
      </div>
    </div>
  );
}

/* ─────────── 9. Quick replies (chip row under bot) ─────────── */
function QuickReplies({ items }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 14px 6px 48px', maxWidth: '82%' }}>
      {items.map((it, i) => (
        <button key={i} style={{
          padding: '7px 13px', borderRadius: 999,
          background: it.primary ? C.primary : C.card,
          border: '1.5px solid ' + (it.primary ? C.primary : C.hairline),
          color: it.primary ? 'white' : C.fg,
          fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          boxShadow: it.primary ? `0 4px 10px ${C.primaryDeep}30` : 'none',
        }}>
          {it.icon && <Sk icon={it.icon} color={it.primary ? '#fff' : C.sub} size={14}/>}
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────── 10. User bubble ─────────── */
function UserBubble({ children, time, tail = true, status = 'sent' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: tail ? '6px 14px 2px' : '2px 14px' }}>
      <div style={{
        background: `linear-gradient(160deg, ${C.primary} 0%, ${C.primaryDeep} 100%)`,
        color: 'white',
        padding: '9px 14px',
        borderRadius: RAD.bubble,
        borderBottomRightRadius: tail ? 6 : RAD.bubble,
        ...T.body,
        boxShadow: SHADOW.user,
        maxWidth: '78%',
        display: 'inline-flex', alignItems: 'baseline', gap: 8,
      }}>
        <span>{children}</span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, opacity: .8 }}>
          {time && <span style={T.time}>{time}</span>}
          {status === 'saved' && (
            <svg width="13" height="9" viewBox="0 0 13 9" fill="none">
              <path d="M1 4.5L4.5 8L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.5 4.5L7 8L12 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
      </div>
    </div>
  );
}

/* ─────────── 11. Saved row (inside bot card) ─────────── */
function SavedRow({ icon, color, title, hint, amount, currency = '₪' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px 12px 12px', borderLeft: `4px solid ${color}` }}>
      <div style={{
        position: 'relative',
        width: 40, height: 40, borderRadius: 12,
        background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sk icon={icon} color={color} size={28}/>
        <span style={{
          position: 'absolute', bottom: -2, right: -3,
          width: 16, height: 16, borderRadius: '50%',
          background: C.sage, border: '2px solid ' + C.card,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...T.h2, fontSize: 14.5, margin: 0, color: C.fg }}>{title}</p>
        {hint && <p style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, margin: '2px 0 0' }}>{hint}</p>}
      </div>
      <span style={{ ...T.amount, color: C.fg }}>{currency}{amount}</span>
    </div>
  );
}

/* ─────────── 12. Envelope mini-bar ─────────── */
function Envelope({ name, icon, color, spent, limit }) {
  const pct = Math.min(100, (spent / limit) * 100);
  const over = spent > limit;
  const remain = limit - spent;
  return (
    <div style={{ padding: '6px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Sk icon={icon} color={color} size={20}/>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: C.fg }}>{name}</span>
        <span style={{ ...T.caption, color: over ? C.primary : C.sub, fontSize: 10.5 }}>
          {over ? `+₪${-remain}` : `₪${remain} ост.`}
        </span>
      </div>
      <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'rgba(142,122,102,.16)', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: pct + '%', height: '100%',
          background: over ? `linear-gradient(90deg, ${C.primary}, ${C.primaryDeep})` : color,
          borderRadius: 3,
        }}/>
      </div>
      <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700, color: C.sub, fontVariantNumeric: 'tabular-nums' }}>
        ₪{spent} / {limit}
      </div>
    </div>
  );
}

/* ─────────── 13. Typing indicator ─────────── */
function Typing() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, margin: '8px 14px 2px' }}>
      <BotAvatar/>
      <div style={{
        background: C.cardTint, padding: '12px 14px',
        borderRadius: RAD.bubble, borderBottomLeftRadius: 6,
        boxShadow: SHADOW.bubble, display: 'inline-flex', gap: 4,
      }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.sub, opacity: .4 + i * .15 }}/>
        ))}
      </div>
    </div>
  );
}

/* ─────────── 14. Composer ─────────── */
function Composer({ value = '', placeholder = 'Запиши быстро…', showSuggest = false, focused = false }) {
  return (
    <>
      {showSuggest && (
        <div style={{ padding: '8px 14px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
          {[
            { icon: 'cart',  color: C.primary, label: 'Продукты'  },
            { icon: 'plate', color: C.caramel, label: 'Кафе'      },
            { icon: 'fuel',  color: C.blueSoft,label: 'Бензин'    },
            { icon: 'taxi',  color: C.yellow,  label: 'Такси'     },
            { icon: 'pill',  color: C.rose,    label: 'Аптека'    },
          ].map((s) => (
            <button key={s.label} style={{
              padding: '6px 10px 6px 6px', borderRadius: 999,
              background: C.card, border: '1px solid ' + C.hairline,
              fontSize: 12, fontWeight: 800, color: C.fg, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              boxShadow: SHADOW.bubble,
            }}>
              <Sk icon={s.icon} color={s.color} size={18}/>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div style={{
        padding: '10px 12px 12px', display: 'flex', alignItems: 'center', gap: 8,
        borderTop: '1px solid ' + C.hairline, background: C.bg,
      }}>
        <button style={iconBtn(38, C.sub)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10"/>
          </svg>
        </button>
        <div style={{
          flex: 1, background: C.card, borderRadius: 22,
          padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8,
          border: '1.5px solid ' + (focused ? C.primary : C.hairline),
          minHeight: 40, boxSizing: 'border-box',
          boxShadow: focused ? `0 0 0 4px ${C.primary}18` : 'none',
          transition: 'all .15s',
        }}>
          {value ? (
            <span style={{ ...T.body, color: C.fg }}>
              {value}
              <span style={{ display: 'inline-block', width: 1.5, height: 16, background: C.primary, marginLeft: 2, verticalAlign: 'middle' }}/>
            </span>
          ) : (
            <span style={{ ...T.bodySoft, color: C.sub }}>{placeholder}</span>
          )}
        </div>
        {value ? (
          <button style={{
            width: 40, height: 40, borderRadius: '50%', border: 0,
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 6px 14px ${C.primaryDeep}55`, cursor: 'pointer',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        ) : (
          <button style={iconBtn(38, C.sub)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/></svg>
          </button>
        )}
      </div>
    </>
  );
}

/* ─────────── 15. Menu overlay ─────────── */
function MenuOverlay({ onClose }) {
  const items = [
    { icon: 'chart_up', color: C.primary,  label: 'Статистика',  sub: 'Май · 12 категорий' },
    { icon: 'box',      color: C.sage,     label: 'Конверты',    sub: '5 активных · 68% расход', badge: '5' },
    { icon: 'piggy',    color: C.lavender, label: 'Копилки',     sub: '3 цели · ₪18 100 отложено' },
    { icon: 'refund',   color: C.yellow,   label: 'Регулярные',  sub: '4 платежа в этом месяце', badge: '2' },
    { icon: 'gift',     color: C.rose,     label: 'Семья',       sub: 'Игорь + 2 участника' },
    { icon: 'cog',      color: C.sub,      label: 'Настройки' },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(61,44,31,.42)', zIndex: 10, backdropFilter: 'blur(2px)' }}/>
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: '83%',
        background: C.bg, zIndex: 11,
        boxShadow: SHADOW.menu,
        display: 'flex', flexDirection: 'column',
        paddingTop: 54,
      }}>
        {/* profile + balance hero */}
        <div style={{
          margin: '0 14px', padding: '14px 16px',
          borderRadius: RAD.hero,
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDeep} 100%)`,
          color: 'white', position: 'relative', overflow: 'hidden',
          boxShadow: SHADOW.pinned,
        }}>
          <svg style={{ position: 'absolute', top: -30, right: -30, opacity: .25 }} width="140" height="140" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 16,
              background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(8px)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 900,
            }}>И</div>
            <div style={{ flex: 1 }}>
              <p style={{ ...T.h2, color: 'white', margin: 0 }}>Игорь Шевц</p>
              <p style={{ fontSize: 12, fontWeight: 700, opacity: .85, margin: '1px 0 0' }}>семья.budget · с мая 2026</p>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8, position: 'relative' }}>
            <span style={{ ...T.display, fontSize: 28 }}>₪140</span>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: .8 }}>на сегодня</span>
          </div>
          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
            <div style={{ width: '70%', height: '100%', background: 'rgba(255,255,255,.95)' }}/>
          </div>
        </div>

        {/* nav items */}
        <div style={{ flex: 1, padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {items.map((it) => (
            <a key={it.label} href="#" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 12px', borderRadius: 14,
              textDecoration: 'none', color: C.fg,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: it.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sk icon={it.icon} color={it.color} size={24}/>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ ...T.h2, fontSize: 14.5, margin: 0 }}>{it.label}</p>
                {it.sub && <p style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, margin: '1px 0 0' }}>{it.sub}</p>}
              </div>
              {it.badge && (
                <span style={{
                  minWidth: 22, height: 22, borderRadius: 11,
                  background: it.color + '22', color: it.color,
                  fontSize: 11, fontWeight: 900, lineHeight: '22px', textAlign: 'center', padding: '0 6px',
                }}>{it.badge}</span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
            </a>
          ))}
        </div>

        {/* Family avatars footer */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid ' + C.hairline, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex' }}>
            {['#E07A5F', '#81B29A', '#A48BC9'].map((bg, i) => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: '50%', background: bg, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 900,
                border: '2.5px solid ' + C.bg, marginLeft: i ? -8 : 0,
              }}>{['И','А','М'][i]}</div>
            ))}
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.sub, margin: 0, flex: 1 }}>Семья онлайн · 3</p>
          <button style={{ ...iconBtn(28, C.sub), background: 'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  C, T, SHADOW, RAD,
  Sk,
  ChatHeader, PinnedToday, DateChip,
  BotAvatar, BotBubble, BotCardBubble, QuickReplies,
  UserBubble, SavedRow, Envelope, Typing,
  Composer, MenuOverlay,
});
