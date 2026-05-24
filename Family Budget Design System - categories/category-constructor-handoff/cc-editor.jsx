/* Category Constructor — Editor sheet (per-category edit / create) */

const ICON_GROUPS = [
  { tab: 'Все',       icons: null }, // null = unfiltered
  { tab: 'Еда',       icons: ['cart','plate','coffee','burger','delivery','icecream','wine'] },
  { tab: 'Дом',       icons: ['house','key','bank','lightning','drop','wifi','phone','couch','bag','wrench','spray','broom'] },
  { tab: 'Транспорт', icons: ['car','fuel','bus','taxi','train','plane','bed','compass','shield','parking','carwash'] },
  { tab: 'Развл',     icons: ['cinema','ferris','ticket','brush','controller','music','tv','cloud','headphones'] },
  { tab: 'Дети',      icons: ['teddy','ball','book','backpack','cake','gift','palm','hands','cap'] },
  { tab: 'Здоровье',  icons: ['heart','pill','stethoscope','tooth','dumbbell'] },
  { tab: 'Прочее',    icons: ['box','briefcase','cash','card','coin','piggy','chart_up','star','refund','receipt','lipstick','shirt','laptop','watch','online','building'] },
];

const COLOR_PALETTE = [
  '#E07A5F', '#D4A574', '#A8B89C', '#81B29A', '#8AA9D6',
  '#C97B84', '#A48BC9', '#E9B384', '#F2CC8F', '#5D8F77',
  '#D67F4A', '#8E7A66',
];

function CCEditor({ initialData }) {
  const sample = initialData.parents.find((p) => p.id === 'groceries');

  const [name, setName] = React.useState(sample?.name || 'Продукты');
  const [color, setColor] = React.useState(sample?.color || CC_C.primary);
  const [icon, setIcon] = React.useState(sample?.icon || 'cart');
  const [budget, setBudget] = React.useState(sample?.budget || 1800);
  const [isPrivate, setPrivate] = React.useState(false);
  const [iconTab, setIconTab] = React.useState('Все');

  const lib = window.ICON_LIB || {};
  const allIcons = Object.keys(lib.I || {});
  const visibleIcons = (() => {
    const grp = ICON_GROUPS.find((g) => g.tab === iconTab);
    return grp && grp.icons ? grp.icons.filter((k) => allIcons.includes(k)) : allIcons;
  })();

  return (
    <div style={{
      width: '100%', height: '100%', background: CC_C.bg,
      fontFamily: 'Nunito, sans-serif', color: CC_C.fg,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <CCHeader
        title="Редактирование"
        subtitle="Категория · Продукты"
        leading={<CCIconBtn>{G.chevronLeft}</CCIconBtn>}
        trailing={<button style={{
          padding: '6px 12px', borderRadius: 999, border: 'none',
          background: 'transparent', color: CC_C.rose, fontFamily: 'inherit',
          fontWeight: 800, fontSize: 13, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>{G.trash} Удалить</button>}
      />

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 110px' }}>
        {/* Live preview */}
        <div style={{
          background: `linear-gradient(145deg, ${color}28, ${color}08)`,
          border: `1.5px solid ${color}55`,
          borderRadius: 22, padding: '18px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: CC_SHADOW.card,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: '#fff',
            boxShadow: `0 6px 16px ${color}38, inset 0 0 0 1.5px ${color}30`,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <StickerIcon icon={icon} color={color} size={42} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.2 }}>
              {name || 'Без названия'}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.4 }}>
                ₪{Number(budget).toLocaleString()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: CC_C.sub }}>/мес</span>
            </div>
          </div>
        </div>

        {/* Name */}
        <Field label="Название">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%', padding: '11px 14px',
              background: CC_C.card, border: `1.5px solid ${CC_C.hairline}`,
              borderRadius: 14, fontFamily: 'inherit', fontWeight: 800,
              fontSize: 14, color: CC_C.fg, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </Field>

        {/* Icon picker */}
        <Field label="Иконка" trailing={
          <span style={{ fontSize: 11, fontWeight: 700, color: CC_C.subLight }}>
            {visibleIcons.length}
          </span>
        }>
          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8,
            marginBottom: 4, marginLeft: -2, paddingLeft: 2,
          }}>
            {ICON_GROUPS.map((g) => (
              <button key={g.tab} onClick={() => setIconTab(g.tab)} style={{
                flexShrink: 0, padding: '6px 11px', borderRadius: 999,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 800, fontSize: 11.5,
                background: iconTab === g.tab ? CC_C.fg : CC_C.card,
                color: iconTab === g.tab ? '#fff' : CC_C.sub,
                boxShadow: iconTab === g.tab ? 'none' : `inset 0 0 0 1px ${CC_C.hairline}`,
              }}>{g.tab}</button>
            ))}
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
            padding: 10, background: CC_C.card, borderRadius: 16,
            border: `1.5px solid ${CC_C.hairline}`,
          }}>
            {visibleIcons.map((k) => {
              const sel = icon === k;
              return (
                <button key={k} onClick={() => setIcon(k)} style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 12, cursor: 'pointer',
                  background: sel ? color + '22' : 'transparent',
                  border: sel ? `1.5px solid ${color}` : `1.5px solid transparent`,
                  display: 'grid', placeItems: 'center',
                  padding: 4,
                }}>
                  <StickerIcon icon={k} color={sel ? color : CC_C.fg} size={28} />
                </button>
              );
            })}
          </div>
        </Field>

        {/* Color */}
        <Field label="Цвет">
          <div style={{
            display: 'flex', gap: 8, padding: '4px 0',
            overflowX: 'auto',
          }}>
            {COLOR_PALETTE.map((c) => {
              const sel = color === c;
              return (
                <button key={c} onClick={() => setColor(c)} style={{
                  flexShrink: 0,
                  width: 38, height: 38, borderRadius: 999,
                  background: c, cursor: 'pointer',
                  border: '3px solid #fff',
                  boxShadow: sel
                    ? `0 0 0 2.5px ${c}, 0 4px 10px ${c}66`
                    : `inset 0 0 0 1px ${c}33`,
                  display: 'grid', placeItems: 'center',
                  color: '#fff',
                }}>{sel && G.check}</button>
              );
            })}
          </div>
        </Field>

        {/* Budget */}
        <Field label="Месячный бюджет" trailing={
          <span style={{ fontSize: 11, fontWeight: 700, color: CC_C.subLight }}>опционально</span>
        }>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: CC_C.card, border: `1.5px solid ${CC_C.hairline}`,
            borderRadius: 14, overflow: 'hidden',
          }}>
            <span style={{
              padding: '11px 4px 11px 14px', color: CC_C.sub,
              fontWeight: 900, fontSize: 18, lineHeight: 1,
            }}>₪</span>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ''))}
              style={{
                flex: 1, padding: '11px 8px', background: 'transparent',
                border: 'none', fontFamily: 'inherit', fontWeight: 900,
                fontSize: 18, color: CC_C.fg, outline: 'none',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -0.3,
              }}
            />
            <span style={{ padding: '0 14px', fontSize: 12, fontWeight: 800, color: CC_C.sub }}>/мес</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {[500, 1000, 1500, 2000, 3000].map((v) => (
              <button key={v} onClick={() => setBudget(v)} style={{
                padding: '6px 11px', borderRadius: 999,
                background: budget === v ? color + '22' : CC_C.card,
                border: `1.5px solid ${budget === v ? color + '55' : CC_C.hairline}`,
                color: budget === v ? color : CC_C.sub,
                fontFamily: 'inherit', fontWeight: 800, fontSize: 11.5,
                cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
              }}>₪{v.toLocaleString()}</button>
            ))}
          </div>
        </Field>

        {/* Privacy */}
        <div style={{
          marginTop: 16, padding: '12px 14px',
          background: CC_C.card, border: `1.5px solid ${CC_C.hairline}`,
          borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: isPrivate ? CC_C.lavender + '22' : CC_C.bgSoft,
            display: 'grid', placeItems: 'center',
            color: isPrivate ? CC_C.lavender : CC_C.subLight,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="11" rx="2"/>
              <path d="M8 11V7a4 4 0 018 0v4"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 900, color: CC_C.fg }}>Приватная</p>
            <p style={{ margin: '1px 0 0', fontSize: 11, fontWeight: 700, color: CC_C.sub }}>Скрыть от семьи</p>
          </div>
          <CCSwitch on={isPrivate} onClick={() => setPrivate(!isPrivate)} accent={CC_C.lavender} />
        </div>
      </div>

      {/* Sticky bottom */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '10px 14px 30px', background: CC_C.bg,
        borderTop: `1px solid ${CC_C.hairline}`,
      }}>
        <button style={{
          width: '100%', padding: '14px',
          background: `linear-gradient(160deg, ${color}, ${color}cc)`,
          color: '#fff', border: 'none', borderRadius: 16,
          fontFamily: 'inherit', fontWeight: 900, fontSize: 14.5,
          cursor: 'pointer', boxShadow: `0 6px 14px ${color}55`,
          letterSpacing: -0.1,
        }}>
          Сохранить категорию
        </button>
      </div>
    </div>
  );
}

function Field({ label, trailing, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 8, padding: '0 2px',
      }}>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 900, letterSpacing: 0.7, color: CC_C.subLight, textTransform: 'uppercase' }}>
          {label}
        </p>
        {trailing}
      </div>
      {children}
    </div>
  );
}

window.CCEditor = CCEditor;
