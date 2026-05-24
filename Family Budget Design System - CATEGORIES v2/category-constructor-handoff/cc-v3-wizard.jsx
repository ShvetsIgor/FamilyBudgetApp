/* Category Constructor — Wizard v2 (folders + flat categories)
   3 steps:
   1. Pick / create folders
   2. Categories in folders  (+ "Без папки" loose section)
   3. Resolve loose categories  OR  success
*/

const WIZ_STEPS = [
  { key: 'folders',    title: 'Папки' },
  { key: 'categories', title: 'Категории' },
  { key: 'loose',      title: 'Без папки' },
];

function CCV3({ initialData, startStep = 0, addPanelFolderId = null }) {
  const [data, setData] = React.useState(() => deepClone(initialData));
  const [step, setStep] = React.useState(startStep);
  // Inline "add category" panel state — keyed by folderId, or 'loose' for the loose section
  const [openAddPanel, setOpenAddPanel] = React.useState(addPanelFolderId);

  const enabledFolders = data.folders.filter((f) => f.enabled);
  const looseCount = looseCategoriesOf(data).filter((c) => c.enabled).length;
  const totalCategories = (data.categories || []).filter((c) => c.enabled && !c.archived).length;

  function toggleFolder(id) {
    setData((d) => ({
      ...d,
      folders: d.folders.map((f) => f.id === id ? { ...f, enabled: !f.enabled } : f),
      // Cascade: when disabling a folder, also disable its categories
      categories: d.categories.map((c) =>
        c.folderId === id ? { ...c, enabled: !d.folders.find((f) => f.id === id).enabled } : c
      ),
    }));
  }
  function addCategoryToFolder(folderId, sub) {
    setData((d) => {
      const exists = d.categories.find((c) => c.id === sub.id);
      if (exists) {
        return { ...d, categories: d.categories.map((c) => c.id === sub.id ? { ...c, enabled: true, folderId } : c) };
      }
      const folder = d.folders.find((f) => f.id === folderId);
      return {
        ...d,
        categories: [...d.categories, {
          id: sub.id, name: sub.name, icon: sub.icon,
          color: folder ? folder.color : CC_C.sub,
          folderId, budget: null, enabled: true, archived: false,
          order: d.categories.length, type: 'expense',
        }],
      };
    });
  }
  function removeCategory(id) {
    setData((d) => ({
      ...d,
      categories: d.categories.map((c) => c.id === id ? { ...c, enabled: false } : c),
    }));
  }
  function assignLoose(catId, action, folderId) {
    setData((d) => ({
      ...d,
      categories: d.categories.map((c) => {
        if (c.id !== catId) return c;
        if (action === 'folder') return { ...c, folderId };
        if (action === 'archive') return { ...c, archived: true, enabled: false };
        if (action === 'delete') return { ...c, enabled: false };
        return c;
      }),
    }));
  }

  // Step 3 is conditional — only shown if loose categories exist after step 2
  const hasLoose = looseCount > 0;
  const total = WIZ_STEPS.length;

  const canNext =
    step === 0 ? enabledFolders.length > 0 :
    step === 1 ? totalCategories > 0 :
    true;

  function goNext() {
    if (step === 1 && !hasLoose) {
      // Skip step 3 entirely if no loose categories
      setStep(99); // sentinel for "exit"
      return;
    }
    setStep(Math.min(step + 1, total - 1));
  }

  return (
    <div style={{
      width: '100%', height: '100%', background: CC_C.bg,
      fontFamily: 'Nunito, sans-serif', color: CC_C.fg,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <WizHeader step={step} total={total} onBack={() => setStep(Math.max(0, step - 1))} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 130px' }}>
        {step === 0 && (
          <FoldersStep data={data} setData={setData} onToggle={toggleFolder} />
        )}
        {step === 1 && (
          <CategoriesStep
            data={data}
            openAddPanel={openAddPanel}
            setOpenAddPanel={setOpenAddPanel}
            onAdd={addCategoryToFolder}
            onRemove={removeCategory}
          />
        )}
        {step === 2 && (
          hasLoose
            ? <LooseStep data={data} onAssign={assignLoose} />
            : <DoneInline totalCategories={totalCategories} enabledFolders={enabledFolders} />
        )}
      </div>

      <WizFooter
        step={step} total={total} canNext={canNext}
        labels={{
          0: enabledFolders.length > 0 ? `Дальше · ${enabledFolders.length}` : 'Выбери папку',
          1: 'Дальше',
          2: 'Готово',
        }}
        onBack={() => setStep(Math.max(0, step - 1))}
        onNext={goNext}
      />
    </div>
  );
}

/* ── Wizard chrome ───────────────────────────────────────── */
function WizHeader({ step, total, onBack }) {
  return (
    <div style={{
      background: CC_C.bg, padding: '14px 14px 12px',
      borderBottom: `1px solid ${CC_C.hairline}`, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {step > 0 ? (
          <CCIconBtn onClick={onBack}>{G.chevronLeft}</CCIconBtn>
        ) : <div style={{ width: 36 }} />}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 900, letterSpacing: 0.7, color: CC_C.subLight, textTransform: 'uppercase' }}>
            Шаг {step + 1} из {total}
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 17, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.3 }}>
            {WIZ_STEPS[step] ? WIZ_STEPS[step].title : 'Готово'}
          </p>
        </div>
        <CCIconBtn>{G.close}</CCIconBtn>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {WIZ_STEPS.map((s, i) => (
          <div key={s.key} style={{
            flex: 1, height: 4, borderRadius: 999,
            background: i <= step ? CC_C.primary : CC_C.hairline,
            transition: 'background .2s',
          }} />
        ))}
      </div>
    </div>
  );
}

function WizFooter({ step, total, canNext, labels, onBack, onNext }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: '10px 14px 30px', background: CC_C.bg,
      borderTop: `1px solid ${CC_C.hairline}`,
      display: 'flex', gap: 8,
    }}>
      {step > 0 && (
        <button onClick={onBack} style={{
          flex: '0 0 auto', width: 54, padding: '14px',
          background: CC_C.card, color: CC_C.fg,
          border: `1.5px solid ${CC_C.hairline}`, borderRadius: 16,
          fontFamily: 'inherit', fontWeight: 900, fontSize: 14,
          cursor: 'pointer', display: 'grid', placeItems: 'center',
        }}>{G.chevronLeft}</button>
      )}
      <button
        onClick={() => canNext && onNext()}
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
        {labels[step]}
        {step < total - 1 && G.arrowRight}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STEP 1 — Folders: grid of folder tiles + custom
   ───────────────────────────────────────────── */
function FoldersStep({ data, setData, onToggle }) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: CC_C.fg }}>
        Какие папки?
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, fontWeight: 700, color: CC_C.sub, lineHeight: 1.4 }}>
        Папки — это просто способ сгруппировать категории. На статистику не влияют.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {data.folders.map((f) => {
          const on = f.enabled;
          return (
            <button key={f.id} onClick={() => onToggle(f.id)} style={{
              position: 'relative',
              background: on ? CC_C.card : CC_C.cardTint,
              border: `2px solid ${on ? f.color : CC_C.hairline}`,
              borderRadius: 16, padding: '12px 6px 10px',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              boxShadow: on ? `0 4px 10px ${f.color}28` : 'none',
              transition: 'all .15s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: on ? f.color + '20' : CC_C.bgSoft,
                display: 'grid', placeItems: 'center',
              }}>
                <StickerIcon icon={f.icon} color={on ? f.color : CC_C.subLight} size={30} />
              </div>
              <span style={{
                fontSize: 11.5, fontWeight: 800,
                color: on ? CC_C.fg : CC_C.sub,
                textAlign: 'center', lineHeight: 1.15,
              }}>{f.name}</span>
              {on && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 18, height: 18, borderRadius: 999,
                  background: f.color, color: '#fff',
                  display: 'grid', placeItems: 'center',
                  boxShadow: `0 2px 4px ${f.color}55`,
                }}>{G.check}</span>
              )}
            </button>
          );
        })}

        <button style={{
          background: 'transparent',
          border: `2px dashed ${CC_C.subLight}`,
          borderRadius: 16, padding: '12px 6px',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          color: CC_C.sub,
        }}>
          <div style={{ width: 44, height: 44, display: 'grid', placeItems: 'center' }}>{G.plusBig}</div>
          <span style={{ fontSize: 11.5, fontWeight: 800 }}>Своя</span>
        </button>
      </div>

      <p style={{
        margin: '20px 4px 0', fontSize: 11, fontWeight: 700,
        color: CC_C.subLight, lineHeight: 1.4,
      }}>
        Совет: папки можно переименовать, переместить или удалить позже — категории внутри не пострадают.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STEP 2 — Categories per folder, with inline add panel
   ───────────────────────────────────────────── */
function CategoriesStep({ data, openAddPanel, setOpenAddPanel, onAdd, onRemove }) {
  const enabledFolders = data.folders.filter((f) => f.enabled);
  const lib = window.ICON_LIB || {};
  const tax = lib.TAXONOMY || [];

  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: CC_C.fg }}>
        Категории в папках
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, fontWeight: 700, color: CC_C.sub, lineHeight: 1.4 }}>
        Можно добавить готовые, создать свои или редактировать.
      </p>

      {enabledFolders.map((f) => (
        <FolderSection
          key={f.id}
          folder={f}
          categories={categoriesIn(data, f.id).filter((c) => c.enabled)}
          addPanelOpen={openAddPanel === f.id}
          allCategories={data.categories}
          taxonomy={tax}
          onOpenAdd={() => setOpenAddPanel(openAddPanel === f.id ? null : f.id)}
          onAdd={(sub) => { onAdd(f.id, sub); }}
          onRemove={onRemove}
        />
      ))}

      {/* "No folder" section */}
      <div style={{ marginTop: 18, marginBottom: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 2px', marginBottom: 8,
        }}>
          <span style={{ color: CC_C.subLight, display: 'inline-flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="14" rx="2"/>
              <path d="M3 10h18"/>
            </svg>
          </span>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: 0.5, color: CC_C.sub, textTransform: 'uppercase' }}>
            Без папки
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {looseCategoriesOf(data).filter((c) => c.enabled).map((c) => (
            <CategoryChip key={c.id} c={c} accent={c.color} onRemove={() => onRemove(c.id)} />
          ))}
          <button
            onClick={() => setOpenAddPanel(openAddPanel === 'loose' ? null : 'loose')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '7px 11px', borderRadius: 999,
              background: 'transparent',
              border: `1.5px dashed ${CC_C.subLight}`,
              color: CC_C.sub, fontFamily: 'inherit',
              fontWeight: 800, fontSize: 12.5,
              cursor: 'pointer',
            }}
          >{G.plus} Добавить</button>
        </div>
      </div>
    </div>
  );
}

function FolderSection({ folder, categories, addPanelOpen, allCategories, taxonomy, onOpenAdd, onAdd, onRemove }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {/* Folder header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px', marginBottom: 10 }}>
        <IconTile icon={folder.icon} color={folder.color} size={30} radius={9} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>
            {folder.name}
          </p>
        </div>
        <span style={{
          fontSize: 10.5, fontWeight: 900, color: folder.color,
          background: folder.color + '18', padding: '3px 9px', borderRadius: 999,
        }}>{categories.length}</span>
        <button style={{
          width: 26, height: 26, borderRadius: 9,
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'grid', placeItems: 'center', color: CC_C.subLight,
        }}>{G.pencil}</button>
      </div>

      {/* Chip row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {categories.map((c) => (
          <CategoryChip key={c.id} c={c} accent={folder.color} onRemove={() => onRemove(c.id)} />
        ))}
        <button
          onClick={onOpenAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '7px 11px', borderRadius: 999,
            background: addPanelOpen ? folder.color + '15' : 'transparent',
            border: `1.5px dashed ${addPanelOpen ? folder.color + '88' : CC_C.subLight}`,
            color: addPanelOpen ? folder.color : CC_C.sub,
            fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          {G.plus} Добавить
        </button>
      </div>

      {/* Inline add panel */}
      {addPanelOpen && (
        <AddCategoryPanel
          folder={folder}
          allCategories={allCategories}
          taxonomy={taxonomy}
          onAdd={onAdd}
        />
      )}
    </div>
  );
}

function CategoryChip({ c, accent, onRemove }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 4px 5px 7px', borderRadius: 999,
      background: accent + '15',
      border: `1.5px solid ${accent}45`,
      color: CC_C.fg, fontFamily: 'inherit',
      fontWeight: 800, fontSize: 12.5,
    }}>
      <StickerIcon icon={c.icon} color={accent} size={18} />
      <span>{c.name}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          width: 18, height: 18, borderRadius: 999,
          background: 'rgba(0,0,0,.08)', border: 'none', color: '#fff',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          marginLeft: 1,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
    </div>
  );
}

function AddCategoryPanel({ folder, allCategories, taxonomy, onAdd }) {
  // Suggestions = same-folder TAXONOMY subs not yet enabled, then all uncategorized
  const enabledIds = new Set(allCategories.filter((c) => c.enabled).map((c) => c.id));
  const sameFolderTax = taxonomy.find((p) => p.id === folder.id);
  const sameFolderSubs = sameFolderTax
    ? sameFolderTax.subs.filter((s) => !s.id.endsWith('_other') && !enabledIds.has(s.id))
    : [];
  const otherSubs = taxonomy.flatMap((p) =>
    p.id === folder.id ? [] : p.subs.filter((s) => !s.id.endsWith('_other') && !enabledIds.has(s.id))
      .map((s) => ({ ...s, _fromFolder: p.ru }))
  );

  return (
    <div style={{
      marginTop: 10, padding: '11px 11px 11px',
      background: CC_C.card, border: `1.5px solid ${folder.color}40`,
      borderRadius: 14, boxShadow: '0 4px 12px rgba(61,44,31,.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 900, letterSpacing: 0.5, color: CC_C.sub, textTransform: 'uppercase' }}>
          Добавить в «{folder.name}»
        </p>
      </div>

      {/* Custom + smart suggestions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: sameFolderSubs.length + otherSubs.length > 0 ? 9 : 0 }}>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 10px 6px 7px', borderRadius: 999,
          background: folder.color, color: '#fff',
          border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontWeight: 800, fontSize: 12,
          boxShadow: `0 2px 6px ${folder.color}55`,
        }}>
          <span style={{ display: 'inline-flex' }}>{G.sparkle}</span>
          Своя категория
        </button>
      </div>

      {sameFolderSubs.length > 0 && (
        <>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 800, color: CC_C.subLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Под этой папкой
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
            {sameFolderSubs.map((s) => (
              <button
                key={s.id}
                onClick={() => onAdd({ id: s.id, name: s.ru, icon: s.icon })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '5px 9px 5px 5px', borderRadius: 999,
                  background: folder.color + '12',
                  border: `1.5px dashed ${folder.color}66`,
                  color: CC_C.fg, fontFamily: 'inherit',
                  fontWeight: 800, fontSize: 11.5,
                  cursor: 'pointer',
                }}
              >
                <StickerIcon icon={s.icon} color={folder.color} size={16} />
                {s.ru}
                <span style={{ color: folder.color, opacity: 0.6 }}>{G.plus}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {otherSubs.length > 0 && (
        <>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 800, color: CC_C.subLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Из других папок
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {otherSubs.slice(0, 6).map((s) => (
              <button
                key={s.id}
                onClick={() => onAdd({ id: s.id, name: s.ru, icon: s.icon })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '5px 9px 5px 5px', borderRadius: 999,
                  background: CC_C.bg,
                  border: `1.5px solid ${CC_C.hairline}`,
                  color: CC_C.sub, fontFamily: 'inherit',
                  fontWeight: 800, fontSize: 11.5,
                  cursor: 'pointer',
                }}
              >
                <StickerIcon icon={s.icon} color={CC_C.sub} size={16} />
                {s.ru}
              </button>
            ))}
            {otherSubs.length > 6 && (
              <button style={{
                padding: '5px 11px', borderRadius: 999,
                background: 'transparent', border: `1.5px solid ${CC_C.hairline}`,
                color: CC_C.sub, fontFamily: 'inherit',
                fontWeight: 800, fontSize: 11.5, cursor: 'pointer',
              }}>+{otherSubs.length - 6} ещё</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   STEP 3 — Loose categories resolution
   ───────────────────────────────────────────── */
function LooseStep({ data, onAssign }) {
  const loose = looseCategoriesOf(data).filter((c) => c.enabled);
  const enabledFolders = data.folders.filter((f) => f.enabled);

  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: CC_C.fg }}>
        Куда эти {loose.length} {pluralizeCat(loose.length)}?
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, fontWeight: 700, color: CC_C.sub, lineHeight: 1.4 }}>
        Без папки тоже норм — папки только для удобства.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loose.map((c, i) => (
          <LooseRow
            key={c.id}
            c={c}
            folders={enabledFolders}
            // For static design: first one with menu open
            menuOpen={i === 0}
            onAssign={onAssign}
          />
        ))}
      </div>

      <div style={{
        marginTop: 16, padding: '12px 14px',
        background: CC_C.primaryTint, border: `1.5px solid ${CC_C.primary}30`,
        borderRadius: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ color: CC_C.primary, marginTop: 1 }}>{G.sparkle}</span>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: CC_C.fg, lineHeight: 1.4 }}>
          Архив скрывает категорию из выбора, но старые траты остаются нетронутыми и видны в статистике.
        </p>
      </div>
    </div>
  );
}

function LooseRow({ c, folders, menuOpen: initialOpen, onAssign }) {
  const [open, setOpen] = React.useState(initialOpen);
  const [choice, setChoice] = React.useState('keep'); // keep | folder | archive | delete

  return (
    <div style={{
      background: CC_C.card,
      border: `1.5px solid ${CC_C.hairline}`,
      borderRadius: 16, padding: '11px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <IconTile icon={c.icon} color={c.color} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.1 }}>{c.name}</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, fontWeight: 700, color: CC_C.sub }}>
            {choice === 'keep' && 'Останется без папки'}
            {choice === 'folder' && 'Будет в папке'}
            {choice === 'archive' && 'Будет архивирована'}
            {choice === 'delete' && 'Будет удалена'}
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          style={{
            padding: '7px 11px', borderRadius: 12,
            background: open ? CC_C.fg : CC_C.bgSoft,
            color: open ? '#fff' : CC_C.fg,
            border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 800, fontSize: 11.5,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          Куда?{open ? G.chevronUp : G.chevronDown}
        </button>
      </div>

      {open && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px dashed ${CC_C.hairline}`,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <ChoiceRow
            selected={choice === 'keep'}
            label="Оставить без папки"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>}
            color={CC_C.sub}
            onClick={() => { setChoice('keep'); }}
          />
          {folders.map((f) => (
            <ChoiceRow
              key={f.id}
              selected={false}
              label={`В «${f.name}»`}
              icon={<StickerIcon icon={f.icon} color={f.color} size={16} />}
              color={f.color}
              onClick={() => { setChoice('folder'); onAssign(c.id, 'folder', f.id); setOpen(false); }}
            />
          ))}
          <div style={{ height: 1, background: CC_C.hairline, margin: '4px 0' }} />
          <ChoiceRow
            selected={choice === 'archive'}
            label="Архивировать"
            sub="оставить статистику, скрыть из выбора"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8M1 3h22v5H1z"/><path d="M10 12h4"/></svg>}
            color={CC_C.caramel}
            onClick={() => { setChoice('archive'); onAssign(c.id, 'archive'); }}
          />
          <ChoiceRow
            selected={choice === 'delete'}
            label="Удалить"
            sub="безопасно только если нет старых трат"
            icon={G.trash}
            color={CC_C.rose}
            onClick={() => { setChoice('delete'); onAssign(c.id, 'delete'); }}
            destructive
          />
        </div>
      )}
    </div>
  );
}

function ChoiceRow({ selected, label, sub, icon, color, onClick, destructive }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 10,
      background: selected ? color + '18' : 'transparent',
      border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8,
        background: color + '18', color, flexShrink: 0,
        display: 'grid', placeItems: 'center',
      }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: destructive ? CC_C.rose : CC_C.fg }}>
          {label}
        </p>
        {sub && (
          <p style={{ margin: '1px 0 0', fontSize: 10.5, fontWeight: 700, color: CC_C.subLight }}>{sub}</p>
        )}
      </div>
      {selected && (
        <span style={{
          width: 18, height: 18, borderRadius: 999,
          background: color, color: '#fff', flexShrink: 0,
          display: 'grid', placeItems: 'center',
        }}>{G.check}</span>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Inline done (shown if step 2 → next with no loose)
   ───────────────────────────────────────────── */
function DoneInline({ totalCategories, enabledFolders }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 18 }}>
        <div style={{
          width: 110, height: 110, borderRadius: 999,
          background: `radial-gradient(circle at 30% 25%, ${CC_C.primaryTint}, ${CC_C.primary}33 70%)`,
          display: 'grid', placeItems: 'center',
          boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,.6), 0 14px 30px ${CC_C.primary}30`,
        }}>
          <StickerIcon icon="piggy" color={CC_C.primary} size={80} />
        </div>
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.5 }}>
        Всё готово!
      </p>
      <p style={{ margin: '0 0 18px', fontSize: 13, fontWeight: 700, color: CC_C.sub, lineHeight: 1.4, padding: '0 20px' }}>
        {enabledFolders.length} {pluralize(enabledFolders.length, ['папка','папки','папок'])} · {totalCategories} {pluralizeCat(totalCategories)}.
      </p>
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
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

window.CCV3 = CCV3;
