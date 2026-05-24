/* Category Constructor — Categories Hub page
   The main /categories tab: list of current categories (tap to edit) +
   prominent entry to the wizard for bulk reconfigure.
*/

function CCHub({ initialData, startInactiveOpen = false }) {
  const [data, setData] = React.useState(() => initialData);
  const [tab, setTab] = React.useState('expense');
  const [showInactive, setShowInactive] = React.useState(startInactiveOpen);

  const active = data.parents.filter((p) => p.enabled);
  const inactive = data.parents.filter((p) => !p.enabled);
  const totalSubs = active.reduce((s, p) => s + p.subs.filter((x) => x.enabled).length, 0);
  const totalBudget = active.reduce((s, p) => s + (p.budget || 0), 0);

  return (
    <div style={{
      width: '100%', height: '100%', background: CC_C.bg,
      fontFamily: 'Nunito, sans-serif', color: CC_C.fg,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <CCHeader
        title="Категории"
        subtitle={`${active.length} активных · ₪${totalBudget.toLocaleString()}/мес`}
        leading={<CCIconBtn>{G.chevronLeft}</CCIconBtn>}
        trailing={<CCIconBtn>{G.more}</CCIconBtn>}
      />

      {/* Tabs */}
      <div style={{ padding: '10px 14px 4px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', gap: 2, padding: 3,
          background: CC_C.bgSoft, borderRadius: 14,
        }}>
          {[
            ['expense', 'Расходы', active.length],
            ['income',  'Доходы', 2],
          ].map(([k, label, count]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
                background: tab === k ? CC_C.card : 'transparent',
                color: tab === k ? CC_C.fg : CC_C.sub, fontWeight: 800, fontSize: 13,
                fontFamily: 'inherit',
                boxShadow: tab === k ? CC_SHADOW.card : 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {label}
              <span style={{
                fontSize: 10.5, fontWeight: 900,
                background: tab === k ? CC_C.primary + '22' : CC_C.subLight + '20',
                color: tab === k ? CC_C.primary : CC_C.sub,
                padding: '1px 6px', borderRadius: 999,
                fontVariantNumeric: 'tabular-nums',
              }}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scroll */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 30px' }}>
        {/* Constructor entry */}
        <button style={{
          width: '100%', padding: '14px 14px 14px 14px',
          background: `linear-gradient(135deg, ${CC_C.primary} 0%, ${CC_C.primaryDeep} 100%)`,
          color: '#fff', border: 'none', borderRadius: 22, cursor: 'pointer',
          boxShadow: CC_SHADOW.primary,
          display: 'flex', alignItems: 'center', gap: 12,
          fontFamily: 'inherit', textAlign: 'left',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Deco circles */}
          <svg style={{ position: 'absolute', top: -20, right: -10, opacity: 0.16 }} width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" stroke="white" strokeWidth="1.5" fill="none"/>
            <circle cx="50" cy="50" r="32" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>

          <div style={{
            width: 50, height: 50, borderRadius: 14, flexShrink: 0,
            background: 'rgba(255,255,255,.22)',
            display: 'grid', placeItems: 'center',
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.5)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-6 9 6v12H3z"/>
              <path d="M3 9l9 6 9-6"/>
              <path d="M12 15v6"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 900, letterSpacing: -0.2 }}>
              Конструктор
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, fontWeight: 700, opacity: 0.85, lineHeight: 1.3 }}>
              Пошагово настроить весь набор
            </p>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: 999, flexShrink: 0,
            background: 'rgba(255,255,255,.22)',
            display: 'grid', placeItems: 'center',
            position: 'relative',
          }}>
            {G.arrowRight}
          </div>
        </button>

        {/* Active section header */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          margin: '20px 4px 8px',
        }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 900, letterSpacing: 0.7, color: CC_C.subLight, textTransform: 'uppercase' }}>
            Активные · {active.length}
          </p>
          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: CC_C.sub, fontFamily: 'inherit', fontWeight: 800, fontSize: 11.5,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            Сортировка
            {G.chevronDown}
          </button>
        </div>

        {/* Active list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {active.map((p) => (
            <CategoryRow key={p.id} p={p} />
          ))}
        </div>

        {/* Inactive toggle */}
        {inactive.length > 0 && (
          <>
            <button
              onClick={() => setShowInactive(!showInactive)}
              style={{
                width: '100%', marginTop: 16, padding: '10px 14px',
                background: CC_C.bgSoft, border: `1.5px solid ${CC_C.hairline}`,
                borderRadius: 14, color: CC_C.sub, fontFamily: 'inherit',
                fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>В библиотеке · {inactive.length}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {showInactive ? 'Скрыть' : 'Показать'}
                {showInactive ? G.chevronUp : G.chevronDown}
              </span>
            </button>

            {showInactive && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {inactive.map((p) => (
                  <CategoryRow key={p.id} p={p} inactive />
                ))}
              </div>
            )}
          </>
        )}

        {/* Create new manually */}
        <button style={{
          width: '100%', marginTop: 16, padding: '14px',
          background: 'transparent', border: `1.5px dashed ${CC_C.subLight}`,
          borderRadius: 16, color: CC_C.sub, fontFamily: 'inherit',
          fontWeight: 800, fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {G.plus} Создать категорию вручную
        </button>
      </div>
    </div>
  );
}

/* ── A single category row in the hub ── */
function CategoryRow({ p, inactive = false }) {
  const subOn = p.subs.filter((s) => s.enabled).length;
  const subsToShow = p.subs.slice(0, 3);
  const restCount = p.subs.length - subsToShow.length;

  return (
    <div style={{
      background: CC_C.card,
      border: `1.5px solid ${inactive ? CC_C.hairline : p.color + '28'}`,
      borderRadius: 18, padding: '12px 12px 11px',
      opacity: inactive ? 0.7 : 1,
      cursor: 'pointer',
      boxShadow: inactive ? 'none' : '0 1px 2px rgba(61,44,31,.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <IconTile icon={p.icon} color={p.color} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>
            {p.name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: CC_C.sub }}>
            {inactive
              ? `${p.subs.length} подкатегорий · в библиотеке`
              : <>
                  {subOn} {pluralize(subOn, ['подкатегория','подкатегории','подкатегорий'])}
                  {p.budget != null && (
                    <>{' · '}<span style={{ color: p.color, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      ₪{p.budget.toLocaleString()}
                    </span></>
                  )}
                </>
            }
          </p>
        </div>

        {!inactive ? (
          <button style={{
            width: 30, height: 30, borderRadius: 10,
            background: CC_C.bgSoft, border: `1px solid ${CC_C.hairline}`,
            color: CC_C.sub, cursor: 'pointer',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>{G.pencil}</button>
        ) : (
          <button style={{
            width: 30, height: 30, borderRadius: 999,
            background: p.color, border: 'none',
            color: '#fff', cursor: 'pointer',
            display: 'grid', placeItems: 'center', flexShrink: 0,
            boxShadow: `0 3px 8px ${p.color}55`,
          }}>{G.plus}</button>
        )}
      </div>

      {/* Sub chips preview */}
      {!inactive && subOn > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          marginTop: 9, paddingLeft: 53,
        }}>
          {subsToShow.filter((s) => s.enabled).map((s) => (
            <span key={s.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px 3px 6px', borderRadius: 999,
              background: p.color + '14',
              fontSize: 10.5, fontWeight: 800, color: CC_C.fg,
              border: `1px solid ${p.color}22`,
            }}>
              <StickerIcon icon={s.icon} color={p.color} size={13} />
              {s.name}
            </span>
          ))}
          {restCount > 0 && (
            <span style={{
              padding: '3px 9px', borderRadius: 999,
              background: 'transparent',
              fontSize: 10.5, fontWeight: 800, color: CC_C.sub,
              border: `1px dashed ${CC_C.subLight}`,
            }}>+{restCount}</span>
          )}
        </div>
      )}
    </div>
  );
}

function pluralize(n, forms) {
  // ru pluralization: 1 / 2-4 / 5-20
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

window.CCHub = CCHub;
