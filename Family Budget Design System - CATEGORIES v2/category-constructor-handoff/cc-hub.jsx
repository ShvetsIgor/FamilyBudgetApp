/* Category Constructor — Categories Hub (folders + flat categories)
   Layout:
   - Header with summary
   - Tabs (expense / income)
   - Constructor entry card
   - List of folder sections (each: header + categories + "+ Добавить")
   - "Без папки" section
   - Archived (collapsed) section
*/

function CCHub({ initialData, startArchiveOpen = false }) {
  const [data, setData] = React.useState(() => initialData);
  const [tab, setTab] = React.useState('expense');
  const [archiveOpen, setArchiveOpen] = React.useState(startArchiveOpen);
  const [collapsedFolders, setCollapsedFolders] = React.useState({});

  const enabledFolders = data.folders.filter((f) => f.enabled);
  const loose = looseCategoriesOf(data).filter((c) => c.enabled);
  const archived = archivedCategoriesOf(data);
  const totalCats = (data.categories || []).filter((c) => c.enabled && !c.archived).length;
  const totalBudget = (data.categories || []).filter((c) => c.enabled && !c.archived)
    .reduce((s, c) => s + (c.budget || 0), 0);

  function toggleFolder(id) {
    setCollapsedFolders((m) => ({ ...m, [id]: !m[id] }));
  }

  return (
    <div style={{
      width: '100%', height: '100%', background: CC_C.bg,
      fontFamily: 'Nunito, sans-serif', color: CC_C.fg,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <CCHeader
        title="Категории"
        subtitle={`${totalCats} ${pluralizeCat(totalCats)} · ₪${totalBudget.toLocaleString()}/мес`}
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
            ['expense', 'Расходы', totalCats],
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
        {/* Constructor CTA */}
        <button style={{
          width: '100%', padding: '14px 14px 14px 14px',
          background: `linear-gradient(135deg, ${CC_C.primary} 0%, ${CC_C.primaryDeep} 100%)`,
          color: '#fff', border: 'none', borderRadius: 22, cursor: 'pointer',
          boxShadow: CC_SHADOW.primary,
          display: 'flex', alignItems: 'center', gap: 12,
          fontFamily: 'inherit', textAlign: 'left',
          position: 'relative', overflow: 'hidden',
        }}>
          <svg style={{ position: 'absolute', top: -20, right: -10, opacity: 0.16 }} width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" stroke="white" strokeWidth="1.5" fill="none"/>
            <circle cx="50" cy="50" r="32" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: 'rgba(255,255,255,.22)',
            display: 'grid', placeItems: 'center',
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.5)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
              <path d="M12 11v6M9 14h6"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 900, letterSpacing: -0.2 }}>
              Конструктор папок
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, fontWeight: 700, opacity: 0.85, lineHeight: 1.3 }}>
              Папки, категории и бюджеты — пошагово
            </p>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: 999, flexShrink: 0,
            background: 'rgba(255,255,255,.22)',
            display: 'grid', placeItems: 'center', position: 'relative',
          }}>{G.arrowRight}</div>
        </button>

        {/* Folder sections */}
        {enabledFolders.map((f) => {
          const cats = categoriesIn(data, f.id).filter((c) => c.enabled);
          const folderBudget = cats.reduce((s, c) => s + (c.budget || 0), 0);
          const collapsed = collapsedFolders[f.id];

          return (
            <FolderSection
              key={f.id}
              folder={f}
              categories={cats}
              folderBudget={folderBudget}
              collapsed={collapsed}
              onToggle={() => toggleFolder(f.id)}
            />
          );
        })}

        {/* Loose (Без папки) */}
        {loose.length > 0 && (
          <LooseSection categories={loose} />
        )}

        {/* + Add manually */}
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button style={{
            flex: 1, padding: '12px',
            background: 'transparent', border: `1.5px dashed ${CC_C.subLight}`,
            borderRadius: 14, color: CC_C.sub, fontFamily: 'inherit',
            fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="15" rx="2"/>
              <path d="M9 3l3 3 3-3"/>
            </svg>
            Создать папку
          </button>
          <button style={{
            flex: 1, padding: '12px',
            background: 'transparent', border: `1.5px dashed ${CC_C.subLight}`,
            borderRadius: 14, color: CC_C.sub, fontFamily: 'inherit',
            fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {G.plus} Категорию
          </button>
        </div>

        {/* Archived */}
        {archived.length > 0 && (
          <>
            <button
              onClick={() => setArchiveOpen(!archiveOpen)}
              style={{
                width: '100%', marginTop: 18, padding: '10px 14px',
                background: CC_C.bgSoft, border: `1.5px solid ${CC_C.hairline}`,
                borderRadius: 14, color: CC_C.sub, fontFamily: 'inherit',
                fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8v13H3V8M1 3h22v5H1z"/><path d="M10 12h4"/>
                </svg>
                Архив · {archived.length}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {archiveOpen ? 'Скрыть' : 'Показать'}
                {archiveOpen ? G.chevronUp : G.chevronDown}
              </span>
            </button>
            {archiveOpen && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {archived.map((c) => (
                  <ArchivedRow key={c.id} c={c} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Folder section (header + nested category rows) ── */
function FolderSection({ folder, categories, folderBudget, collapsed, onToggle }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '4px 4px 6px', cursor: 'pointer',
        }}>
        <IconTile icon={folder.icon} color={folder.color} size={28} radius={8} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>
            {folder.name}
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 10.5, fontWeight: 800, color: CC_C.sub }}>
            {categories.length} · ₪{folderBudget.toLocaleString()}/мес
          </p>
        </div>
        <button style={{
          width: 26, height: 26, borderRadius: 8, border: 'none',
          background: 'transparent', color: CC_C.subLight,
          cursor: 'pointer', display: 'grid', placeItems: 'center',
        }} onClick={(e) => { e.stopPropagation(); }}>{G.pencil}</button>
        <span style={{ color: CC_C.subLight, marginRight: 2 }}>
          {collapsed ? G.chevronRight : G.chevronDown}
        </span>
      </div>

      {!collapsed && (
        <div style={{
          background: CC_C.card,
          border: `1.5px solid ${folder.color}1F`,
          borderRadius: 18,
          padding: 4,
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {categories.map((c) => <CategoryRow key={c.id} c={c} accent={folder.color} />)}
          <button style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 13,
            background: 'transparent', border: 'none',
            color: folder.color, fontFamily: 'inherit',
            fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
            textAlign: 'left',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: folder.color + '15',
              display: 'grid', placeItems: 'center',
            }}>{G.plus}</div>
            Добавить категорию
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Loose section ── */
function LooseSection({ categories }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '4px 4px 6px',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: CC_C.subLight + '24',
          color: CC_C.sub,
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="14" rx="2"/>
            <path d="M3 10h18"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>
            Без папки
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 10.5, fontWeight: 800, color: CC_C.sub }}>
            {categories.length} {pluralizeCat(categories.length)}
          </p>
        </div>
      </div>
      <div style={{
        background: CC_C.card,
        border: `1.5px solid ${CC_C.hairline}`,
        borderRadius: 18, padding: 4,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {categories.map((c) => <CategoryRow key={c.id} c={c} accent={c.color} />)}
      </div>
    </div>
  );
}

/* ── Single category row inside a folder section ── */
function CategoryRow({ c, accent }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px 8px 8px', borderRadius: 13,
      background: 'transparent', border: 'none', cursor: 'pointer',
      textAlign: 'left',
    }}>
      <IconTile icon={c.icon} color={accent} size={34} radius={10} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: CC_C.fg, letterSpacing: -0.1 }}>
          {c.name}
        </p>
        {c.budget != null && c.budget > 0 && (
          <p style={{ margin: '1px 0 0', fontSize: 10.5, fontWeight: 800, color: CC_C.sub, fontVariantNumeric: 'tabular-nums' }}>
            ₪{c.budget.toLocaleString()}/мес
          </p>
        )}
      </div>
      <span style={{ color: CC_C.subLight }}>{G.chevronRight}</span>
    </button>
  );
}

/* ── Archived row ── */
function ArchivedRow({ c }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '10px 12px',
      background: CC_C.card, border: `1.5px solid ${CC_C.hairline}`,
      borderRadius: 14, opacity: 0.78,
    }}>
      <IconTile icon={c.icon} color={c.color} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: CC_C.fg, letterSpacing: -0.1 }}>
          {c.name}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 10.5, fontWeight: 700, color: CC_C.sub }}>
          в архиве · {c.txCount || 0} {pluralize(c.txCount || 0, ['трата','траты','трат'])}
        </p>
      </div>
      <button style={{
        padding: '5px 10px', borderRadius: 999,
        background: 'transparent', border: `1.5px solid ${CC_C.hairline}`,
        color: CC_C.sub, fontFamily: 'inherit',
        fontWeight: 800, fontSize: 11, cursor: 'pointer',
      }}>Восстановить</button>
    </div>
  );
}

function pluralize(n, forms) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
function pluralizeCat(n) { return pluralize(n, ['категория','категории','категорий']); }

window.CCHub = CCHub;
