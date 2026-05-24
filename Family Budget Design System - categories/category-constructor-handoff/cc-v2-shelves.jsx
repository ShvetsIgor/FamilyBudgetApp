/* Category Constructor — Variant 2: Shelves (My budget zone + Library zone) */

function CCV2({ initialData }) {
  const [data, setData] = React.useState(() => initialData);
  const [tab, setTab] = React.useState('expense');
  const [search, setSearch] = React.useState('');

  const enabled = data.parents.filter((p) => p.enabled);
  const available = data.parents.filter((p) => !p.enabled);
  const filteredLib = !search ? available
    : available.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  function toggle(id, on) {
    setData((d) => ({
      ...d,
      parents: d.parents.map((p) =>
        p.id === id ? { ...p, enabled: on, subs: p.subs.map((s) => ({ ...s, enabled: on })) } : p
      ),
    }));
  }

  return (
    <div style={{
      width: '100%', height: '100%', background: CC_C.bg,
      fontFamily: 'Nunito, sans-serif', color: CC_C.fg,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <CCHeader
        title="Конструктор"
        subtitle={`${enabled.length} активных · ${available.length} в библиотеке`}
        leading={<CCIconBtn>{G.close}</CCIconBtn>}
        trailing={<CCIconBtn>{G.more}</CCIconBtn>}
      />

      {/* Type tabs */}
      <div style={{ padding: '10px 14px 4px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', gap: 2, padding: 3,
          background: CC_C.bgSoft, borderRadius: 14,
        }}>
          {[['expense', 'Расходы'], ['income', 'Доходы']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
                background: tab === k ? CC_C.card : 'transparent',
                color: tab === k ? CC_C.fg : CC_C.sub, fontWeight: 800, fontSize: 13,
                fontFamily: 'inherit',
                boxShadow: tab === k ? CC_SHADOW.card : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scroll */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 110px' }}>
        {/* MY BUDGET zone */}
        <div style={{
          background: `linear-gradient(165deg, ${CC_C.primary}10, ${CC_C.cardTint})`,
          border: `1.5px solid ${CC_C.primary}30`,
          borderRadius: 22, padding: '13px 12px 12px',
          boxShadow: CC_SHADOW.card,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 4px' }}>
            <div style={{
              width: 20, height: 20, borderRadius: 8,
              background: CC_C.primary, color: '#fff',
              display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 11,
            }}>{enabled.length}</div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: 0.6, color: CC_C.primary, textTransform: 'uppercase' }}>
              Мой бюджет
            </p>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: CC_C.sub, fontWeight: 700 }}>
              ₪{enabled.reduce((s, p) => s + (p.budget || 0), 0).toLocaleString()}/мес
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {enabled.map((p) => (
              <div key={p.id}
                style={{
                  background: CC_C.card,
                  borderRadius: 16, padding: '10px 10px 10px 10px',
                  border: `1.5px solid ${p.color}25`,
                  boxShadow: '0 1px 2px rgba(61,44,31,.04)',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  position: 'relative',
                }}>
                <button
                  onClick={() => toggle(p.id, false)}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 22, height: 22, borderRadius: 999,
                    background: CC_C.bg, border: `1px solid ${CC_C.hairline}`,
                    color: CC_C.sub, cursor: 'pointer',
                    display: 'grid', placeItems: 'center',
                  }}
                ><span style={{ transform: 'rotate(45deg)', display: 'inline-flex' }}>{G.plus}</span></button>

                <IconTile icon={p.icon} color={p.color} size={38} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>{p.name}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 10.5, fontWeight: 700, color: CC_C.sub }}>
                    {p.subs.filter((s) => s.enabled).length} подкат.
                  </p>
                </div>
                {p.budget != null && (
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 3,
                    padding: '4px 8px', background: p.color + '15',
                    borderRadius: 999, alignSelf: 'flex-start',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: p.color, fontVariantNumeric: 'tabular-nums' }}>
                      ₪{p.budget.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: p.color, opacity: 0.7 }}>/мес</span>
                  </div>
                )}
              </div>
            ))}

            {/* Add placeholder */}
            <button style={{
              gridColumn: enabled.length % 2 === 0 ? 'span 2' : 'auto',
              minHeight: 70, background: 'transparent',
              border: `1.5px dashed ${CC_C.primary}66`,
              borderRadius: 16, color: CC_C.primary,
              fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: 'pointer',
            }}>
              {G.plus} Добавить
            </button>
          </div>
        </div>

        {/* LIBRARY zone */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 4px' }}>
            <div style={{
              width: 20, height: 20, borderRadius: 8,
              background: CC_C.sub, color: '#fff',
              display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 11,
            }}>{available.length}</div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: 0.6, color: CC_C.sub, textTransform: 'uppercase' }}>
              Библиотека
            </p>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px', background: CC_C.card,
            borderRadius: 14, border: `1.5px solid ${CC_C.hairline}`,
            marginBottom: 10,
          }}>
            <span style={{ color: CC_C.subLight }}>{G.search}</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Найти категорию"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: CC_C.fg,
              }}
            />
          </div>

          {/* Library tiles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredLib.map((p) => (
              <button key={p.id} onClick={() => toggle(p.id, true)} style={{
                display: 'flex', alignItems: 'center', gap: 11,
                background: CC_C.card,
                border: `1.5px solid ${CC_C.hairline}`,
                borderRadius: 16, padding: '9px 10px 9px 10px',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                width: '100%',
              }}>
                <IconTile icon={p.icon} color={p.color} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>{p.name}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, fontWeight: 700, color: CC_C.sub }}>
                    {p.subs.length} подкатегорий
                  </p>
                </div>
                <div style={{
                  width: 30, height: 30, borderRadius: 999,
                  background: p.color, color: '#fff',
                  display: 'grid', placeItems: 'center',
                  boxShadow: `0 3px 8px ${p.color}55`,
                  flexShrink: 0,
                }}>{G.plus}</div>
              </button>
            ))}

            {/* Create own */}
            <button style={{
              marginTop: 4, padding: '12px',
              background: 'transparent', border: `1.5px dashed ${CC_C.subLight}`,
              borderRadius: 16, color: CC_C.sub, fontFamily: 'inherit',
              fontWeight: 800, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {G.sparkle} Создать свою категорию
            </button>
          </div>
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
          background: `linear-gradient(160deg, ${CC_C.primary}, ${CC_C.primaryDeep})`,
          color: '#fff', border: 'none', borderRadius: 16,
          fontFamily: 'inherit', fontWeight: 900, fontSize: 14.5,
          cursor: 'pointer', boxShadow: CC_SHADOW.primary,
          letterSpacing: -0.1,
        }}>
          Готово
        </button>
      </div>
    </div>
  );
}

window.CCV2 = CCV2;
