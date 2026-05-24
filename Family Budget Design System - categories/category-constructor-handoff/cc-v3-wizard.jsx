/* Category Constructor — Variant 3: Wizard (full 4-step flow)
   - Stateful: Back / Next navigate steps inside the artboard
   - `startStep` prop pins the initial step (for showing every step side-by-side on the canvas)
*/

const STEPS = [
  { key: 'pick',    title: 'Категории',  helper: 'Какие траты ты отслеживаешь?' },
  { key: 'refine',  title: 'Уточни',     helper: 'Какие конкретные траты внутри?' },
  { key: 'budget',  title: 'Бюджет',     helper: 'Сколько готов тратить в месяц?' },
  { key: 'done',    title: 'Готово',     helper: 'Можно начинать.' },
];

function CCV3({ initialData, startStep = 0 }) {
  const [data, setData] = React.useState(() => initialData);
  const [step, setStep] = React.useState(startStep);

  const total = STEPS.length;
  const enabledParents = data.parents.filter((p) => p.enabled);
  const enabledCount = enabledParents.length;
  const totalSubsOn = enabledParents.reduce((s, p) => s + p.subs.filter((x) => x.enabled).length, 0);
  const totalBudget = enabledParents.reduce((s, p) => s + (p.budget || 0), 0);

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
  function setBudget(id, value) {
    setData((d) => ({
      ...d,
      parents: d.parents.map((p) => (p.id === id ? { ...p, budget: value } : p)),
    }));
  }

  const canNext =
    step === 0 ? enabledCount > 0 :
    step === 1 ? enabledCount > 0 :
    true;

  return (
    <div style={{
      width: '100%', height: '100%', background: CC_C.bg,
      fontFamily: 'Nunito, sans-serif', color: CC_C.fg,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      {/* Stepper header */}
      <div style={{
        background: CC_C.bg, padding: '14px 14px 12px',
        borderBottom: `1px solid ${CC_C.hairline}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {step > 0 && step < total - 1 ? (
            <CCIconBtn onClick={() => setStep(step - 1)}>{G.chevronLeft}</CCIconBtn>
          ) : <div style={{ width: 36 }} />}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 900, letterSpacing: 0.7, color: CC_C.subLight, textTransform: 'uppercase' }}>
              Шаг {step + 1} из {total}
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 17, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.3 }}>
              {STEPS[step].title}
            </p>
          </div>
          {step < total - 1 ? (
            <CCIconBtn>{G.close}</CCIconBtn>
          ) : <div style={{ width: 36 }} />}
        </div>

        {/* Segmented progress */}
        <div style={{ display: 'flex', gap: 4 }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{
              flex: 1, height: 4, borderRadius: 999,
              background: i <= step ? CC_C.primary : CC_C.hairline,
              transition: 'background .2s',
            }} />
          ))}
        </div>
      </div>

      {/* Step body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 130px' }}>
        {step === 0 && <PickStep data={data} onToggle={toggleParent} />}
        {step === 1 && <RefineStep parents={enabledParents} onToggleSub={toggleSub} />}
        {step === 2 && <BudgetStep parents={enabledParents} onChange={setBudget} totalBudget={totalBudget} />}
        {step === 3 && (
          <DoneStep
            enabledCount={enabledCount}
            totalSubsOn={totalSubsOn}
            totalBudget={totalBudget}
            parents={enabledParents}
          />
        )}
      </div>

      {/* Sticky bottom */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '10px 14px 30px', background: CC_C.bg,
        borderTop: `1px solid ${CC_C.hairline}`,
        display: 'flex', gap: 8,
      }}>
        {step > 0 && step < total - 1 && (
          <button onClick={() => setStep(step - 1)} style={{
            flex: '0 0 auto', width: 54, padding: '14px',
            background: CC_C.card, color: CC_C.fg,
            border: `1.5px solid ${CC_C.hairline}`, borderRadius: 16,
            fontFamily: 'inherit', fontWeight: 900, fontSize: 14,
            cursor: 'pointer', display: 'grid', placeItems: 'center',
          }}>{G.chevronLeft}</button>
        )}

        {step === 2 && (
          <button onClick={() => setStep(step + 1)} style={{
            flex: '0 0 auto', padding: '14px 16px',
            background: 'transparent', color: CC_C.sub,
            border: `1.5px solid ${CC_C.hairline}`, borderRadius: 16,
            fontFamily: 'inherit', fontWeight: 800, fontSize: 13,
            cursor: 'pointer',
          }}>Пропустить</button>
        )}

        <button
          onClick={() => canNext && setStep(Math.min(step + 1, total - 1))}
          disabled={!canNext}
          style={{
            flex: 1, padding: '14px',
            background: canNext
              ? `linear-gradient(160deg, ${CC_C.primary}, ${CC_C.primaryDeep})`
              : CC_C.hairline,
            color: '#fff', border: 'none', borderRadius: 16,
            fontFamily: 'inherit', fontWeight: 900, fontSize: 14.5,
            cursor: canNext ? 'pointer' : 'not-allowed',
            boxShadow: canNext ? CC_SHADOW.primary : 'none',
            letterSpacing: -0.1, opacity: canNext ? 1 : 0.6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {step === 0 && (enabledCount > 0 ? `Дальше · ${enabledCount}` : 'Выбери хотя бы одну')}
          {step === 1 && 'Бюджеты'}
          {step === 2 && 'Готово'}
          {step === 3 && 'Начать пользоваться'}
          {step < 3 && G.arrowRight}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Step 1: Pick parent categories — 3-col grid of large tiles
   ───────────────────────────────────────────── */
function PickStep({ data, onToggle }) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: CC_C.fg }}>
        Какие траты ты отслеживаешь?
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, fontWeight: 700, color: CC_C.sub, lineHeight: 1.4 }}>
        Выбери всё, что относится к тебе. Можно изменить позже.
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
      }}>
        {data.parents.map((p) => {
          const on = p.enabled;
          return (
            <button key={p.id} onClick={() => onToggle(p.id)} style={{
              position: 'relative',
              background: on ? CC_C.card : CC_C.cardTint,
              border: `2px solid ${on ? p.color : CC_C.hairline}`,
              borderRadius: 16, padding: '12px 6px 10px',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              boxShadow: on ? `0 4px 10px ${p.color}28` : 'none',
              transition: 'all .15s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: on ? p.color + '20' : CC_C.bgSoft,
                display: 'grid', placeItems: 'center',
              }}>
                <StickerIcon icon={p.icon} color={on ? p.color : CC_C.subLight} size={30} />
              </div>
              <span style={{
                fontSize: 11.5, fontWeight: 800,
                color: on ? CC_C.fg : CC_C.sub,
                textAlign: 'center', lineHeight: 1.15,
              }}>{p.name}</span>
              {on && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 18, height: 18, borderRadius: 999,
                  background: p.color, color: '#fff',
                  display: 'grid', placeItems: 'center',
                  boxShadow: `0 2px 4px ${p.color}55`,
                }}>{G.check}</span>
              )}
            </button>
          );
        })}

        {/* Custom */}
        <button style={{
          background: 'transparent',
          border: `2px dashed ${CC_C.subLight}`,
          borderRadius: 16, padding: '12px 6px',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          color: CC_C.sub,
        }}>
          <div style={{ width: 44, height: 44, display: 'grid', placeItems: 'center' }}>
            {G.plusBig}
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 800 }}>Своя</span>
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Step 2: Refine subs — chip cloud per parent
   ───────────────────────────────────────────── */
function RefineStep({ parents, onToggleSub }) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: CC_C.fg }}>
        Уточни внутри каждой
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, fontWeight: 700, color: CC_C.sub, lineHeight: 1.4 }}>
        Чем больше — тем точнее статистика. Лишнее можно убрать.
      </p>

      {parents.map((p) => {
        const subOn = p.subs.filter((s) => s.enabled).length;
        return (
          <div key={p.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 2px' }}>
              <IconTile icon={p.icon} color={p.color} size={32} radius={10} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>{p.name}</p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 900, color: p.color,
                background: p.color + '18', padding: '3px 9px', borderRadius: 999,
                fontVariantNumeric: 'tabular-nums',
              }}>{subOn}/{p.subs.length}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {p.subs.map((s) => (
                <button key={s.id} onClick={() => onToggleSub(p.id, s.id)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 11px 7px 7px', borderRadius: 999,
                  background: s.enabled ? p.color + '15' : CC_C.card,
                  border: `1.5px solid ${s.enabled ? p.color + '55' : CC_C.hairline}`,
                  color: CC_C.fg, fontFamily: 'inherit',
                  fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                }}>
                  <StickerIcon icon={s.icon} color={s.enabled ? p.color : CC_C.subLight} size={18} />
                  {s.name}
                  {s.enabled && (
                    <span style={{
                      width: 14, height: 14, borderRadius: 999,
                      background: p.color, color: '#fff', marginLeft: 1,
                      display: 'grid', placeItems: 'center',
                    }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12l5 5L20 6"/>
                      </svg>
                    </span>
                  )}
                </button>
              ))}
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '7px 11px', borderRadius: 999,
                background: 'transparent',
                border: `1.5px dashed ${CC_C.subLight}`,
                color: CC_C.sub, fontFamily: 'inherit',
                fontWeight: 800, fontSize: 12.5,
                cursor: 'pointer',
              }}>{G.plus} Своя</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Step 3: Budgets — list with quick presets and total summary
   ───────────────────────────────────────────── */
function BudgetStep({ parents, onChange, totalBudget }) {
  const presets = [500, 1000, 2000, 5000];

  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: CC_C.fg }}>
        Сколько в месяц?
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, fontWeight: 700, color: CC_C.sub, lineHeight: 1.4 }}>
        Можно оставить пустым — установишь позже из чата или статистики.
      </p>

      {/* Total hero */}
      <div style={{
        background: `linear-gradient(150deg, ${CC_C.primary}, ${CC_C.primaryDeep})`,
        borderRadius: 18, padding: '14px 16px', marginBottom: 16,
        color: '#fff', boxShadow: CC_SHADOW.primary,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(255,255,255,.18)',
          display: 'grid', placeItems: 'center',
        }}>
          <StickerIcon icon="coin" color="#fff" size={28} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, opacity: 0.82, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Общий бюджет
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.6 }}>
            ₪{totalBudget.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>/мес</span>
          </p>
        </div>
      </div>

      {/* Per-category rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {parents.map((p) => (
          <div key={p.id} style={{
            background: CC_C.card,
            border: `1.5px solid ${CC_C.hairline}`,
            borderRadius: 16, padding: '11px 12px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconTile icon={p.icon} color={p.color} size={34} />
              <p style={{ margin: 0, flex: 1, fontSize: 13.5, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>{p.name}</p>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                background: CC_C.bg, border: `1.5px solid ${p.color}33`,
                borderRadius: 12, padding: '4px 4px 4px 10px', minWidth: 110,
              }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: p.color }}>₪</span>
                <input
                  type="text"
                  value={p.budget || ''}
                  onChange={(e) => onChange(p.id, parseInt(e.target.value.replace(/[^0-9]/g, '') || 0, 10))}
                  placeholder="—"
                  style={{
                    flex: 1, minWidth: 0, padding: '4px 6px',
                    background: 'transparent', border: 'none',
                    fontFamily: 'inherit', fontWeight: 900,
                    fontSize: 14, color: CC_C.fg, outline: 'none',
                    fontVariantNumeric: 'tabular-nums', textAlign: 'right',
                  }}
                />
              </div>
            </div>

            {/* Quick presets */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {presets.map((v) => {
                const sel = p.budget === v;
                return (
                  <button key={v} onClick={() => onChange(p.id, v)} style={{
                    padding: '4px 9px', borderRadius: 999,
                    background: sel ? p.color + '22' : 'transparent',
                    border: `1px solid ${sel ? p.color + '66' : CC_C.hairline}`,
                    color: sel ? p.color : CC_C.sub,
                    fontFamily: 'inherit', fontWeight: 800, fontSize: 11,
                    cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
                  }}>₪{v >= 1000 ? `${v/1000}k` : v}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Step 4: Done / Celebrate
   ───────────────────────────────────────────── */
function DoneStep({ enabledCount, totalSubsOn, totalBudget, parents }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 12 }}>
      {/* Big sticker mark */}
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 18 }}>
        <div style={{
          width: 124, height: 124, borderRadius: 999,
          background: `radial-gradient(circle at 30% 25%, ${CC_C.primaryTint}, ${CC_C.primary}33 70%)`,
          display: 'grid', placeItems: 'center',
          boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,.6), 0 14px 30px ${CC_C.primary}30`,
        }}>
          <StickerIcon icon="piggy" color={CC_C.primary} size={90} />
        </div>
        {/* Decorative sparkles */}
        <span style={{ position: 'absolute', top: -2, right: -4, color: CC_C.yellow }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2z"/></svg>
        </span>
        <span style={{ position: 'absolute', bottom: 6, left: -8, color: CC_C.sage }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2z"/></svg>
        </span>
      </div>

      <p style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.6 }}>
        Всё готово!
      </p>
      <p style={{ margin: '0 0 22px', fontSize: 13.5, fontWeight: 700, color: CC_C.sub, lineHeight: 1.4, padding: '0 16px' }}>
        Можно начинать вести бюджет. В любой момент можно поменять категории в настройках.
      </p>

      {/* Summary stat row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8, marginBottom: 18,
      }}>
        <SummaryStat color={CC_C.primary} num={enabledCount}  label="категорий" />
        <SummaryStat color={CC_C.sage}    num={totalSubsOn}   label="подкатегорий" />
        <SummaryStat
          color={CC_C.caramel}
          num={`₪${(totalBudget/1000).toFixed(1)}k`}
          label="в месяц"
        />
      </div>

      {/* Final parent stack (proof) */}
      <div style={{
        background: CC_C.card, border: `1.5px solid ${CC_C.hairline}`,
        borderRadius: 16, padding: '6px', textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {parents.map((p) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 8px', borderRadius: 12,
          }}>
            <IconTile icon={p.icon} color={p.color} size={28} radius={9} />
            <p style={{ margin: 0, flex: 1, fontSize: 13, fontWeight: 800, color: CC_C.fg }}>{p.name}</p>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 800,
              color: p.budget ? p.color : CC_C.subLight,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {p.budget ? `₪${p.budget.toLocaleString()}` : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryStat({ color, num, label }) {
  return (
    <div style={{
      background: color + '14', border: `1.5px solid ${color}30`,
      borderRadius: 14, padding: '12px 8px',
    }}>
      <p style={{
        margin: 0, fontSize: 22, fontWeight: 900,
        color, letterSpacing: -0.5,
        fontVariantNumeric: 'tabular-nums',
      }}>{num}</p>
      <p style={{ margin: '2px 0 0', fontSize: 10.5, fontWeight: 800, color: CC_C.sub }}>
        {label}
      </p>
    </div>
  );
}

window.CCV3 = CCV3;
