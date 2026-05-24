/* Category Constructor — shared tokens, sticker icon helper, sample data */

const CC_C = {
  bg:        '#FBF6EE',
  bgSoft:    '#F4ECDE',
  card:      '#FFFFFF',
  cardTint:  '#FEFAF3',
  fg:        '#3D2C1F',
  sub:       '#8E7A66',
  subLight:  '#B6A48E',
  hairline:  '#EDE0CC',
  hairDark:  '#E2D2B6',
  primary:   '#E07A5F',
  primaryDeep:'#C9684E',
  primaryTint:'#FAEAE2',
  sage:      '#81B29A',
  caramel:   '#D4A574',
  rose:      '#C97B84',
  yellow:    '#F2CC8F',
  lavender:  '#A48BC9',
  blueSoft:  '#8AA9D6',
  olive:     '#A8B89C',
  apricot:   '#E9B384',
};

const CC_SHADOW = {
  card:    '0 1px 2px rgba(61,44,31,.05), 0 6px 18px rgba(61,44,31,.06)',
  cardLg:  '0 2px 4px rgba(61,44,31,.06), 0 14px 30px rgba(61,44,31,.10)',
  primary: '0 6px 14px #C9684E40',
  sheet:   '0 -8px 24px rgba(61,44,31,.10)',
};

const CC_RAD = {
  chip: 999,
  pill: 14,
  card: 18,
  hero: 22,
  sheet: 28,
};

/* ── Sticker icon renderer — pulls from window.ICON_LIB.I ── */
function StickerIcon({ icon, color = CC_C.primary, size = 24 }) {
  const lib = window.ICON_LIB || {};
  const Icon = (lib.I && (lib.I[icon] || lib.I.box)) || null;
  const id = React.useId().replace(/[:_]/g, '');
  if (!Icon) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6, background: color + '22',
        display: 'grid', placeItems: 'center', fontSize: size * 0.5, color, fontWeight: 900,
      }}>?</div>
    );
  }
  return (
    <div style={{ width: size, height: size, lineHeight: 0 }}>
      <Icon c={color} id={'cc' + id} />
    </div>
  );
}

/* ── Category tile background — soft tinted square holding the sticker ── */
function IconTile({ icon, color, size = 44, radius = 12 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: color + '20',
      display: 'grid', placeItems: 'center',
      flexShrink: 0,
    }}>
      <StickerIcon icon={icon} color={color} size={size * 0.66} />
    </div>
  );
}

/* ── Switch toggle ── */
function CCSwitch({ on, onClick, accent = CC_C.primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40, height: 24, borderRadius: 999,
        background: on ? accent : '#D9CCB6',
        position: 'relative', border: 'none', cursor: 'pointer', flexShrink: 0,
        transition: 'background .15s',
        boxShadow: on ? 'inset 0 1px 2px rgba(0,0,0,.08)' : 'inset 0 1px 2px rgba(0,0,0,.06)',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 20, height: 20, borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,.18), 0 2px 4px rgba(0,0,0,.10)',
        transition: 'left .15s cubic-bezier(.4,.0,.2,1)',
      }} />
    </button>
  );
}

/* ── Sticky header ── */
function CCHeader({ title, leading, trailing, subtitle }) {
  return (
    <div style={{
      background: CC_C.bg, borderBottom: `1px solid ${CC_C.hairline}`,
      padding: '12px 14px 12px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {leading}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: CC_C.fg, letterSpacing: -0.3, lineHeight: 1.15 }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ margin: '2px 0 0', fontSize: 11.5, fontWeight: 700, color: CC_C.sub }}>{subtitle}</p>
          )}
        </div>
        {trailing}
      </div>
    </div>
  );
}

/* ── Round icon button (header) ── */
function CCIconBtn({ children, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: 12,
        background: accent ? accent + '18' : 'transparent',
        color: accent || CC_C.fg, border: 'none',
        display: 'grid', placeItems: 'center', cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/* ── Glyphs (no external lib needed) ── */
const G = {
  close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>,
  chevronDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>,
  chevronUp: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6"/></svg>,
  chevronRight: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>,
  chevronLeft: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  plusBig: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6"/></svg>,
  pencil: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4l6 6L8 22H2v-6L14 4z"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></svg>,
  more: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>,
  drag: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>,
  sparkle: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2z"/></svg>,
  arrowRight: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
};

/* ── Sample data drawn from TAXONOMY — NEW MODEL (folders + flat categories) ── */
function makeSampleData() {
  const lib = window.ICON_LIB || {};
  const tax = lib.TAXONOMY || [];

  // 5 default folders enabled at first run
  const defaultFolderIds = new Set(['groceries', 'home', 'transport', 'health', 'shopping']);

  // Map TAXONOMY parents → folders
  const folders = tax.map((p, idx) => ({
    id: p.id,
    name: p.ru,
    icon: p.icon,
    color: p.color,
    enabled: defaultFolderIds.has(p.id),
    order: idx,
    type: 'expense',
  }));

  // Deterministic per-category budgets for demo (only for enabled folders' subs)
  const budgetMap = {
    supermarket: 1200, alcohol: 200, household_chem: 150, home_essentials: 250,
    rent: 4500, electricity: 350, water: 120, internet: 100, mobile: 80, arnona: 280, committee: 80,
    public: 200, taxi: 150, train: 100, bus_pass: 250,
    medicine: 200, doctors: 150, dentist: 300, fitness: 180,
    clothes: 400, electronics: 100, online: 200, cosmetics: 150,
  };

  // Map TAXONOMY subs → flat categories with folderId
  const categories = [];
  tax.forEach((parent) => {
    parent.subs.forEach((sub, subIdx) => {
      if (sub.id.endsWith('_other')) return; // skip "Прочее" placeholders
      categories.push({
        id: sub.id,
        name: sub.ru,
        icon: sub.icon,
        color: parent.color,
        folderId: parent.id,
        budget: defaultFolderIds.has(parent.id) ? (budgetMap[sub.id] || 150) : null,
        enabled: defaultFolderIds.has(parent.id),
        archived: false,
        order: subIdx,
        type: 'expense',
      });
    });
  });

  // 2 loose categories (no folder) — for hub & step-3 demo
  categories.push({
    id: 'side_coffee', name: 'Кофе у работы', icon: 'coffee',
    color: '#8E7A66', folderId: null, budget: 180,
    enabled: true, archived: false, order: 0, type: 'expense',
  });
  categories.push({
    id: 'pet', name: 'Питомец', icon: 'teddy',
    color: '#A48BC9', folderId: null, budget: 250,
    enabled: true, archived: false, order: 1, type: 'expense',
  });

  // 1 archived category (used in old expenses, kept for stats)
  categories.push({
    id: 'archived_vacation', name: 'Отпуск 2024', icon: 'plane',
    color: '#C97B84', folderId: null, budget: null,
    enabled: true, archived: true, order: 2, type: 'expense',
    txCount: 18,
  });

  return { folders, categories };
}

/* helpers */
function categoriesIn(data, folderId) {
  return (data.categories || []).filter((c) => !c.archived && c.folderId === folderId);
}
function looseCategoriesOf(data) {
  return (data.categories || []).filter((c) => !c.archived && c.folderId == null);
}
function archivedCategoriesOf(data) {
  return (data.categories || []).filter((c) => c.archived);
}

Object.assign(window, {
  CC_C, CC_SHADOW, CC_RAD,
  StickerIcon, IconTile, CCSwitch, CCHeader, CCIconBtn, G,
  makeSampleData,
  categoriesIn, looseCategoriesOf, archivedCategoriesOf,
});
