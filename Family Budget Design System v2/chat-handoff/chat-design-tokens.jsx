/* Design tokens reference artboard.
   One static slide showing: palette, type scale, component library. */

const { C: TC, T: TT, SHADOW: TS, RAD: TR, Sk: TSk,
  BotBubble: TBotBubble, BotCardBubble: TBotCardBubble,
  UserBubble: TUserBubble, SavedRow: TSavedRow, Envelope: TEnvelope,
  Typing: TTyping } = window;

function Swatch({ name, hex, tone = 'light' }) {
  return (
    <div style={{ background: hex, borderRadius: 14, padding: 12, color: tone === 'dark' ? '#fff' : TC.fg, minHeight: 78, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', margin: 0, opacity: .85 }}>{name}</p>
      <p style={{ fontSize: 12, fontWeight: 800, margin: 0, fontFamily: 'ui-monospace, monospace', opacity: .9 }}>{hex}</p>
    </div>
  );
}

function TypeRow({ label, sample, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '10px 0', borderBottom: '1px dashed ' + TC.hairline }}>
      <div style={{ width: 100, flexShrink: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: TC.sub, margin: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</p>
        <p style={{ fontSize: 10, fontWeight: 700, color: TC.sub, margin: '2px 0 0', opacity: .7 }}>{style.fontSize}/{style.fontWeight}</p>
      </div>
      <div style={{ flex: 1, ...style, color: TC.fg }}>{sample}</div>
    </div>
  );
}

function Section({ title, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}`, background: TC.card, borderRadius: 22, padding: '20px 22px', boxShadow: TS.card }}>
      <p style={{ ...TT.caption, color: TC.sub, margin: '0 0 14px' }}>{title}</p>
      {children}
    </div>
  );
}

function DesignTokens() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: TC.bg, padding: 28,
      fontFamily: 'Nunito, sans-serif', color: TC.fg,
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h1 style={{ ...TT.display, fontSize: 32, color: TC.fg, margin: 0 }}>Design tokens</h1>
        <p style={{ ...TT.bodySoft, color: TC.sub, margin: 0 }}>палитра · типографика · радиусы · компоненты</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Palette */}
        <Section title="Палитра">
          <p style={{ ...TT.h2, color: TC.fg, margin: '0 0 10px' }}>Основные</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <Swatch name="Primary"      hex="#E07A5F" tone="dark"/>
            <Swatch name="Primary Deep" hex="#C9684E" tone="dark"/>
            <Swatch name="Primary Tint" hex="#FAEAE2"/>
            <Swatch name="Sage"         hex="#81B29A" tone="dark"/>
          </div>
          <p style={{ ...TT.h2, color: TC.fg, margin: '16px 0 10px' }}>Категорийные</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <Swatch name="Caramel"   hex="#D4A574" tone="dark"/>
            <Swatch name="Rose"      hex="#C97B84" tone="dark"/>
            <Swatch name="Yellow"    hex="#F2CC8F"/>
            <Swatch name="Lavender"  hex="#A48BC9" tone="dark"/>
            <Swatch name="Blue Soft" hex="#8AA9D6" tone="dark"/>
            <Swatch name="Olive"     hex="#A8B89C" tone="dark"/>
            <Swatch name="Apricot"   hex="#E9B384" tone="dark"/>
            <Swatch name="Brown"     hex="#3D2C1F" tone="dark"/>
          </div>
          <p style={{ ...TT.h2, color: TC.fg, margin: '16px 0 10px' }}>Нейтральные</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <Swatch name="BG cream"     hex="#FBF6EE"/>
            <Swatch name="BG soft"      hex="#F4ECDE"/>
            <Swatch name="Card"         hex="#FFFFFF"/>
            <Swatch name="Card tint"    hex="#FEFAF3"/>
            <Swatch name="FG"           hex="#3D2C1F" tone="dark"/>
            <Swatch name="FG soft"      hex="#5B4633" tone="dark"/>
            <Swatch name="Sub"          hex="#8E7A66" tone="dark"/>
            <Swatch name="Hairline"     hex="#EDE0CC"/>
          </div>
        </Section>

        {/* Type scale */}
        <Section title="Типографика · Nunito 400/700/800/900">
          <TypeRow label="Display"  sample="₪ 1 840" style={TT.display}/>
          <TypeRow label="H1"       sample="Неделя 20" style={TT.h1}/>
          <TypeRow label="H2"       sample="Продукты · Супермаркет" style={TT.h2}/>
          <TypeRow label="Amount"   sample="₪65" style={TT.amount}/>
          <TypeRow label="Body"     sample="хлеб 12 — отлично, записал" style={TT.body}/>
          <TypeRow label="Sub"      sample="осталось ₪128 на день" style={TT.bodySoft}/>
          <TypeRow label="Caption"  sample="СРЕДА · 17 МАЯ" style={TT.caption}/>
          <TypeRow label="Time"     sample="14:08" style={TT.time}/>
          <div style={{ marginTop: 16, padding: 12, background: TC.bgSoft, borderRadius: 12, fontSize: 12, fontWeight: 700, color: TC.fg, lineHeight: 1.5 }}>
            🐷 Один шрифт — <b>Nunito</b>. Latin + Cyrillic. <code>font-variant-numeric: tabular-nums</code> на всех суммах.
          </div>
        </Section>

        {/* Radii & shadows */}
        <Section title="Радиусы и тени">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { name: 'chip',   r: 999, sample: 'Сегодня' },
              { name: 'bubble', r: 18,  sample: 'Bot text' },
              { name: 'card',   r: 22,  sample: 'Carrd' },
              { name: 'hero',   r: 26,  sample: 'Hero' },
            ].map((x) => (
              <div key={x.name} style={{
                height: 84, background: TC.card, borderRadius: x.r,
                boxShadow: TS.bubble, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 8, textAlign: 'center',
              }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: TC.sub, margin: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>{x.name}</p>
                <p style={{ fontSize: 11, fontWeight: 800, fontFamily: 'ui-monospace, monospace', margin: '2px 0 0', color: TC.fg }}>{x.r === 999 ? 'pill' : x.r + 'px'}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { name: 'bubble', desc: 'soft',     shadow: TS.bubble },
              { name: 'card',   desc: 'deeper',   shadow: TS.card },
              { name: 'pinned', desc: 'primary',  shadow: TS.pinned, bg: TC.primary, tone: 'dark' },
            ].map((s) => (
              <div key={s.name} style={{
                height: 70, borderRadius: 14, background: s.bg ?? TC.card,
                color: s.tone === 'dark' ? '#fff' : TC.fg,
                boxShadow: s.shadow, padding: 12,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                <p style={{ fontSize: 11, fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '.06em', opacity: .85 }}>{s.name}</p>
                <p style={{ fontSize: 11, fontWeight: 700, margin: 0, opacity: .8 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Components */}
        <Section title="Компоненты чата">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0 8px', background: TC.bg, borderRadius: 16, marginBottom: 12 }}>
            <TBotBubble>Доброе утро ✨ На сегодня <b style={{ color: TC.primary }}>₪140</b>.</TBotBubble>
            <TUserBubble time="11:42" status="saved">65 кофе</TUserBubble>
            <TTyping/>
          </div>
          <p style={{ ...TT.caption, color: TC.sub, margin: '4px 0 8px' }}>Saved row · envelope</p>
          <div style={{ background: TC.card, borderRadius: 18, boxShadow: TS.bubble, overflow: 'hidden', marginBottom: 12 }}>
            <TSavedRow icon="cart" color={TC.primary} title="Продукты" hint="Супермаркет" amount={312}/>
            <TEnvelope name="Продукты на неделю" icon="cart" color={TC.primary} spent={580} limit={600}/>
          </div>
          <p style={{ ...TT.caption, color: TC.sub, margin: '4px 0 8px' }}>Chip / quick reply</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={chipStyle(true)}><TSk icon="piggy" color="#fff" size={14}/> Отложить ₪360</button>
            <button style={chipStyle(false)}><TSk icon="box" color={TC.sub} size={14}/> Конверты</button>
            <button style={chipStyle(false)}>Поделиться 👨‍👩‍👦</button>
          </div>
        </Section>
      </div>

      {/* Parser rules cheat sheet */}
      <div style={{ marginTop: 16, background: TC.card, borderRadius: 22, padding: '20px 22px', boxShadow: TS.card }}>
        <p style={{ ...TT.caption, color: TC.sub, margin: '0 0 14px' }}>Парсер на правилах · без LLM</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { input: '"хлеб 12"',     out: '₪12 → Продукты',     why: 'число + keyword "хлеб"' },
            { input: '"65 кофе"',     out: '₪65 → Кафе · Кофе',  why: 'число + keyword "кофе"' },
            { input: '"sonol 200"',   out: '₪200 → Бензин',      why: 'keyword бренда → Машина · Бензин' },
            { input: '"🍕 65"',       out: '₪65 → Фастфуд',      why: 'emoji-маппинг' },
            { input: '"150"',         out: '❓ clarify',         why: 'число без категории → спросить' },
            { input: '"/баланс"',     out: 'rich-карточка',      why: 'slash-команда' },
          ].map((r) => (
            <div key={r.input} style={{ background: TC.bgSoft, borderRadius: 14, padding: '10px 12px' }}>
              <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: TC.fg, margin: 0 }}>{r.input}</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: TC.primary, margin: '4px 0 2px' }}>→ {r.out}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: TC.sub, margin: 0 }}>{r.why}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function chipStyle(primary) {
  return {
    padding: '7px 13px', borderRadius: 999,
    background: primary ? TC.primary : TC.card,
    border: '1.5px solid ' + (primary ? TC.primary : TC.hairline),
    color: primary ? 'white' : TC.fg,
    fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    boxShadow: primary ? `0 4px 10px ${TC.primaryDeep}30` : 'none',
  };
}

window.DesignTokens = DesignTokens;
