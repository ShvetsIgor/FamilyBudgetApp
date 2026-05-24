/* Category Constructor — Variant 1: Catalog (grid + toggles + expandable subs) */

function CCV1({ initialData }) {
  const [data, setData] = React.useState(() => initialData);
  const [tab, setTab] = React.useState('expense'); // expense | income
  const [preset, setPreset] = React.useState('basic'); // basic | full | empty
  const [openId, setOpenId] = React.useState('groceries'); // which parent is expanded

  const enabledCount = data.parents.filter((p) => p.enabled).length;
  const totalSubs = data.parents.reduce((s, p) => s + (p.enabled ? p.subs.filter((x) => x.enabled).length : 0), 0);

  function toggleParent(id) {
    setData((d) => ({
      ...d,
      parents: d.parents.map((p) =>
        p.id === id
          ? { ...p, enabled: !p.enabled, subs: p.subs.map((s) => ({ ...s, enabled: !p.enabled })) }
          : p
      ),
    }));
  }
  function toggleSub(parentId, subId) {
    setData((d) => ({
      ...d,
      parents: d.parents.map((p) =>
        p.id === parentId
          ? { ...p, subs: p.subs.map((s) => (s.id === subId ? { ...s, enabled: !s.enabled } : s)) }
          : p
      ),
    }));
  }
  function applyPreset(key) {
    setPreset(key);
    setData((d) => ({
      ...d,
      parents: d.parents.map((p, i) => {
        let on = false;
        if (key === 'full') on = true;
        else if (key === 'empty') on = false;
        else on = ['groceries', 'dining', 'home', 'transport', 'shopping'].includes(p.id);
        return { ...p, enabled: on, subs: p.subs.map((s) => ({ ...s, enabled: on })) };
      }),
    }));
  }

  return (
    <div style={{
      width: '100%', height: '100%', background: CC_C.bg,
      fontFamily: 'Nunito, sans-serif', color: CC_C.fg,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <CCHeader
        title="Категории"
        subtitle={`${enabledCount} из 12 · ${totalSubs} подкатегорий`}
        leading={<CCIconBtn>{G.close}</CCIconBtn>}
        trailing={<CCIconBtn>{G.search}</CCIconBtn>}
      />

      {/* Presets */}
      <div style={{ padding: '12px 14px 8px', background: CC_C.bg, flexShrink: 0 }}>
        <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 900, letterSpacing: 0.8, color: CC_C.subLight, textTransform: 'uppercase' }}>
          Шаблон
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { k: 'basic', label: 'Базовый', sub: '5' },
            { k: 'full',  label: 'Полный',  sub: '12' },
            { k: 'empty', label: 'С нуля',  sub: '0' },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => applyPreset(p.k)}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: preset === p.k ? CC_C.primary : CC_C.card,
                color: preset === p.k ? '#fff' : CC_C.fg,
                fontWeight: 800, fontFamily: 'inherit',
                boxShadow: preset === p.k ? CC_SHADOW.primary : `inset 0 0 0 1.5px ${CC_C.hairline}`,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 900, letterSpacing: -0.1 }}>{p.label}</span>
              <span style={{ fontSize: 10.5, opacity: 0.7, fontWeight: 700 }}>
                {p.sub} категорий
              </span>
            </button>
          ))}
        </div>

        {/* Type tabs */}
        <div style={{
          display: 'flex', gap: 2, marginTop: 12, padding: 3,
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

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 110px' }}>
        {data.parents.map((p) => {
          const open = openId === p.id;
          const subOn = p.subs.filter((s) => s.enabled).length;
          return (
            <div key={p.id} style={{ marginTop: 8 }}>
              {/* Parent row */}
              <div
                onClick={() => setOpenId(open ? null : p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: CC_C.card,
                  borderRadius: open ? `${CC_RAD.card}px ${CC_RAD.card}px 4px 4px` : CC_RAD.card,
                  padding: '12px 14px',
                  boxShadow: CC_SHADOW.card,
                  border: `1.5px solid ${p.enabled ? p.color + '30' : 'transparent'}`,
                  cursor: 'pointer',
                  opacity: p.enabled ? 1 : 0.55,
                  transition: 'opacity .15s',
                }}
              >
                <IconTile icon={p.icon} color={p.color} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>
                    {p.name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, fontWeight: 700, color: CC_C.sub }}>
                    {p.enabled ? `${subOn} из ${p.subs.length}` : 'выключено'}
                    {p.enabled && p.budget != null && <span> · ₪{p.budget.toLocaleString()}/мес</span>}
                  </p>
                </div>
                <span style={{ color: CC_C.subLight, marginRight: 2 }}>
                  {open ? G.chevronUp : G.chevronDown}
                </span>
                <span onClick={(e) => { e.stopPropagation(); toggleParent(p.id); }}>
                  <CCSwitch on={p.enabled} accent={p.color} />
                </span>
              </div>

              {/* Expanded subs */}
              {open && p.enabled && (
                <div style={{
                  background: CC_C.cardTint,
                  borderRadius: `4px 4px ${CC_RAD.card}px ${CC_RAD.card}px`,
                  padding: '12px 12px 10px',
                  border: `1.5px solid ${p.color}30`, borderTop: 'none',
                  marginTop: -1,
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                }}>
                  {p.subs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleSub(p.id, s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 12,
                        background: s.enabled ? p.color + '15' : CC_C.bg,
                        border: `1.5px solid ${s.enabled ? p.color + '60' : CC_C.hairline}`,
                        color: CC_C.fg, fontFamily: 'inherit', fontWeight: 800, fontSize: 12,
                        cursor: 'pointer', textAlign: 'left', minWidth: 0,
                      }}
                    >
                      <StickerIcon icon={s.icon} color={p.color} size={20} />
                      <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: s.enabled ? 800 : 700,
                      }}>
                        {s.name}
                      </span>
                      {s.enabled && (
                        <span style={{
                          width: 16, height: 16, borderRadius: 999,
                          background: p.color, color: '#fff',
                          display: 'grid', placeItems: 'center',
                        }}>{G.check}</span>
                      )}
                    </button>
                  ))}
                  <button style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 10px', borderRadius: 12,
                    background: 'transparent',
                    border: `1.5px dashed ${CC_C.subLight}`,
                    color: CC_C.sub, fontFamily: 'inherit', fontWeight: 800, fontSize: 12,
                    cursor: 'pointer', justifyContent: 'center',
                  }}>
                    {G.plus} Добавить
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Custom category row */}
        <button style={{
          width: '100%', marginTop: 14, padding: '14px',
          background: 'transparent', border: `1.5px dashed ${CC_C.subLight}`,
          borderRadius: CC_RAD.card, color: CC_C.sub, fontFamily: 'inherit',
          fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {G.sparkle} Создать свою категорию
        </button>
      </div>

      {/* Sticky bottom CTA */}
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
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          Сохранить
          <span style={{
            background: 'rgba(255,255,255,.22)', borderRadius: 999,
            padding: '2px 9px', fontSize: 12, fontWeight: 900,
          }}>{enabledCount}</span>
        </button>
      </div>
    </div>
  );
}

window.CCV1 = CCV1;
