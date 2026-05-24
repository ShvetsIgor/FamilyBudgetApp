/* V1 (Classic Messenger) — additional states and right-panel variations. */

const {
  C: SVC, T: SVT, SHADOW: SVS, RAD: SVR, Sk: SVSk,
  BotBubble, BotCardBubble, UserBubble, SavedRow, Envelope, QuickReplies, Typing,
  useTheme, ThemeProvider,
  DesktopSidebar, DesktopChatHeader, DesktopComposer,
  SystemMessage, RightPanel,
  RPCard, RPToday, RPEnvelopes, RPGoals, RPBills, RPRecent,
} = window;

/* Reusable shared frame */
function V1Frame({ children, dark, density, width = 1440, height = 900 }) {
  return (
    <ThemeProvider dark={dark} density={density}>
      <V1FrameInner width={width} height={height}>{children}</V1FrameInner>
    </ThemeProvider>
  );
}
function V1FrameInner({ children, width, height }) {
  const { C } = useTheme();
  return (
    <div style={{
      width, height,
      background: C.chromeBg2,
      display: 'flex', fontFamily: 'Nunito, sans-serif', color: C.fg,
      overflow: 'hidden', borderRadius: 18,
      boxShadow: '0 30px 80px rgba(61,44,31,.18), 0 8px 24px rgba(61,44,31,.08)',
    }}>{children}</div>
  );
}

/* Date chip */
function DateChipV({ children }) {
  const { C } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 24px 8px' }}>
      <div style={{ flex: 1, height: 1, background: C.hairline }}/>
      <span style={{ fontSize: 10, fontWeight: 800, color: C.sub, letterSpacing: '.08em', textTransform: 'uppercase' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: C.hairline }}/>
    </div>
  );
}

/* ─── State A · CLARIFY ─── */
function StateClarify({ dark, density }) {
  return (
    <V1Frame dark={dark} density={density}>
      <DesktopSidebar activeKey="чат"/>
      <ClarifyCenter/>
      <RightPanel width={340}>
        <RPToday spent={75} total={200}/>
        <ClarifyHint/>
        <RPEnvelopes/>
      </RightPanel>
    </V1Frame>
  );
}
function ClarifyCenter() {
  const { C } = useTheme();
  const chips = [
    { icon: 'cart',  color: '#E07A5F', label: 'Продукты',  hint: 'хлеб · супермаркет' },
    { icon: 'plate', color: '#D4A574', label: 'Кафе',      hint: 'кофе · обед' },
    { icon: 'bus',   color: '#F2CC8F', label: 'Транспорт', hint: 'такси · автобус' },
    { icon: 'pill',  color: '#C97B84', label: 'Аптека',    hint: 'лекарства' },
    { icon: 'house', color: '#81B29A', label: 'Дом',       hint: 'счета · бытовое' },
    { icon: 'gift',  color: '#A48BC9', label: 'Подарки',   hint: 'для близких' },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, minWidth: 0 }}>
      <DesktopChatHeader/>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 720 }}>
          <DateChipV>Среда · 17 мая</DateChipV>

          <BotBubble time="07:00">
            Доброе утро ✨ На сегодня свободно <b style={{ color: C.primary }}>₪140</b>.
          </BotBubble>

          <UserBubble time="11:42" status="saved">65 кофе</UserBubble>
          <BotBubble time="11:42">✅ <b>₪65</b> → Кафе · неделя 140/200 ⚠️</BotBubble>

          <UserBubble time="14:30" status="sent">150</UserBubble>

          <BotBubble time="14:30">
            Не понял, <b>₪150</b> куда? 🤔
          </BotBubble>

          {/* Clarify panel — bigger on desktop */}
          <div style={{ margin: '4px 24px 8px 56px', maxWidth: 600 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.06em', margin: '6px 0 8px' }}>
              ✨ часто выбираешь
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {chips.map((c) => (
                <button key={c.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 14,
                  background: C.card, border: `1.5px solid ${C.hairline}`,
                  cursor: 'pointer', textAlign: 'left',
                  boxShadow: SVS.bubble,
                }}>
                  <div style={{ width: 34, height: 34, borderRadius: 11, background: c.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <SVSk icon={c.icon} color={c.color} size={24}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: C.fg, margin: 0 }}>{c.label}</p>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: C.sub, margin: '1px 0 0' }}>{c.hint}</p>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={{
                padding: '9px 14px', borderRadius: 12,
                background: 'transparent', border: `1.5px dashed ${C.sub}77`, color: C.sub,
                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                Все 12 категорий
              </button>
              <button style={{
                padding: '9px 14px', borderRadius: 12,
                background: 'transparent', border: `1.5px solid ${C.hairline}`, color: C.fg,
                fontSize: 12, fontWeight: 800, cursor: 'pointer',
              }}>＋ новая категория</button>
              <div style={{ flex: 1 }}/>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, alignSelf: 'center' }}>
                подскажешь — запомню это слово навсегда
              </span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 720 }}>
          <DesktopComposer/>
        </div>
      </div>
    </div>
  );
}
function ClarifyHint() {
  const { C } = useTheme();
  return (
    <RPCard title="БОТ УЧИТСЯ" accent={C.primary}>
      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontSize: 12.5, fontWeight: 800, color: C.chromeFg, margin: 0 }}>
          Уже знает 142 слова
        </p>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: C.chromeSub, margin: '4px 0 10px', lineHeight: 1.5 }}>
          Чем больше подсказываешь — тем точнее парсит.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {['хлеб', 'кофе', 'sonol', 'aroma', '🍕', 'продукты', 'обед', 'такси', 'бензин', 'аптека'].map((w) => (
            <span key={w} style={{ padding: '3px 8px', borderRadius: 999, background: C.chromeBg, fontSize: 10.5, fontWeight: 800, color: C.chromeSub, fontFamily: 'ui-monospace, monospace' }}>{w}</span>
          ))}
          <span style={{ padding: '3px 8px', borderRadius: 999, background: C.chromeBg, fontSize: 10.5, fontWeight: 800, color: C.chromeSub }}>+132</span>
        </div>
      </div>
    </RPCard>
  );
}

/* ─── State B · WEEKLY RECAP ─── */
function StateWeeklyRecap({ dark, density }) {
  return (
    <V1Frame dark={dark} density={density}>
      <DesktopSidebar activeKey="чат"/>
      <WeeklyCenter/>
      <RightPanel width={340}>
        <RPGoals/>
        <RPBills/>
      </RightPanel>
    </V1Frame>
  );
}
function WeeklyCenter() {
  const { C } = useTheme();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, minWidth: 0 }}>
      <DesktopChatHeader/>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 720 }}>
          <DateChipV>Воскресенье · 19 мая · 21:00</DateChipV>

          <BotBubble>Неделя закрыта 💫</BotBubble>

          {/* The big weekly card */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, margin: '8px 24px 2px' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.primaryTint}, ${C.primary}22)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              alignSelf: 'flex-end',
            }}>
              <SVSk icon="piggy" color={C.primary} size={20}/>
            </div>
            <div style={{
              flex: 1, maxWidth: 560,
              background: C.card, borderRadius: 22, borderBottomLeftRadius: 8,
              boxShadow: SVS.card, overflow: 'hidden',
            }}>
              {/* Hero */}
              <div style={{ padding: '18px 22px 14px', color: '#fff', position: 'relative', overflow: 'hidden',
                background: `linear-gradient(135deg, ${C.primary} 0%, ${C.rose} 100%)` }}>
                <svg style={{ position: 'absolute', top: -40, right: -40, opacity: .22 }} width="180" height="180" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none"/>
                  <circle cx="60" cy="60" r="42" stroke="white" strokeWidth="1" fill="none" opacity=".7"/>
                </svg>
                <p style={{ ...SVT.caption, opacity: .82, margin: 0 }}>Неделя 20 · 13–19 мая</p>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ ...SVT.display, fontSize: 32 }}>₪1 840</span>
                  <span style={{ fontSize: 13, fontWeight: 800, opacity: .85 }}>из ₪2 200</span>
                </div>
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,.18)', padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                  <SVSk icon="piggy" color={C.yellow} size={16}/>
                  Сэкономил ₪360 — переведём в Отпуск?
                </div>
              </div>

              {/* Envelopes */}
              <div style={{ padding: '10px 0 6px' }}>
                <p style={{ ...SVT.caption, color: C.sub, margin: '4px 22px 8px' }}>Конверты</p>
                {[
                  { name: 'Продукты',    icon: 'cart',   color: '#E07A5F', spent: 580, limit: 600 },
                  { name: 'Кафе',        icon: 'plate',  color: '#D4A574', spent: 205, limit: 200 },
                  { name: 'Машина',      icon: 'car',    color: '#8AA9D6', spent: 240, limit: 400 },
                  { name: 'Дом и счета', icon: 'house',  color: '#81B29A', spent: 520, limit: 600 },
                  { name: 'Развлечения', icon: 'cinema', color: '#A8B89C', spent: 95,  limit: 200 },
                ].map((e) => <Envelope key={e.name} {...e}/>)}
              </div>

              {/* Stats strip */}
              <div style={{ borderTop: `1px solid ${C.hairline}`, padding: '12px 10px', display: 'flex', gap: 4 }}>
                {[
                  { lab: 'Лучший день',   val: 'Вс · ₪80',  color: '#81B29A' },
                  { lab: 'Тяжёлый день',  val: 'Ср · ₪420', color: C.primary },
                  { lab: 'Чаще всего',    val: '☕ Кофе ×6', color: C.fg },
                  { lab: 'Семья',         val: 'Аня 38%',  color: '#A48BC9' },
                ].map((s, i, arr) => (
                  <React.Fragment key={s.lab}>
                    <div style={{ flex: 1, padding: '0 8px' }}>
                      <p style={{ fontSize: 9.5, fontWeight: 800, color: C.sub, margin: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.lab}</p>
                      <p style={{ fontSize: 12.5, fontWeight: 800, color: s.color, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{s.val}</p>
                    </div>
                    {i < arr.length - 1 && <div style={{ width: 1, background: C.hairline }}/>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <QuickReplies items={[
            { label: 'Отложить ₪360', icon: 'piggy', primary: true },
            { label: 'Поделиться 👨‍👩‍👦' },
            { label: 'Полный отчёт →' },
          ]}/>

          <BotBubble>
            План на следующую неделю прежний? Или поправим конверт <b>Кафе</b> — он перебран на ₪5.
          </BotBubble>
          <QuickReplies items={[
            { label: 'Прежний' },
            { label: '+₪20 на Кафе' },
            { label: 'Перепланировать' },
          ]}/>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 720 }}>
          <DesktopComposer/>
        </div>
      </div>
    </div>
  );
}

/* ─── State C · EMPTY ─── */
function StateEmpty({ dark, density }) {
  return (
    <V1Frame dark={dark} density={density}>
      <DesktopSidebar activeKey="чат"/>
      <EmptyCenter/>
      <RightPanel width={340}>
        <EmptySetupCard/>
      </RightPanel>
    </V1Frame>
  );
}
function EmptyCenter() {
  const { C } = useTheme();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, minWidth: 0 }}>
      <DesktopChatHeader title="Семейный чат" subtitle="бот считает локально · готов учиться"/>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ width: 640, paddingTop: 60 }}>
          {/* Big greeting tile */}
          <div style={{
            textAlign: 'center',
            padding: '40px 40px 32px',
            background: C.card, borderRadius: 26,
            boxShadow: SVS.card, border: `1px solid ${C.hairline}`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              width: 84, height: 84, borderRadius: 28, margin: '0 auto 16px',
              background: `radial-gradient(circle at 30% 30%, ${C.primaryTint}, ${C.primary}33)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: SVS.bubble,
            }}>
              <SVSk icon="piggy" color={C.primary} size={60}/>
            </div>
            <h1 style={{ ...SVT.h1, fontSize: 26, color: C.fg, margin: '0 0 8px' }}>
              Привет, Игорь 👋
            </h1>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.sub, margin: 0, lineHeight: 1.5 }}>
              Я бот в твоём кармане. Просто пиши что потратил —<br/>
              «хлеб 12», «65 кофе», «sonol 200» — и я запишу.
            </p>

            {/* Example bubble */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 12,
                padding: '10px 14px 10px 14px', borderRadius: 18,
                background: C.bgSoft, border: `1px dashed ${C.hairline}`,
              }}>
                <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 800, color: C.fg }}>хлеб 12</code>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: C.fg }}>
                  <SVSk icon="cart" color={C.primary} size={20}/>
                  ₪12 → Продукты
                </span>
              </div>
            </div>
          </div>

          {/* Quick start chips */}
          <p style={{ ...SVT.caption, color: C.sub, margin: '28px 0 10px', textAlign: 'center' }}>попробуй прямо сейчас</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { icon: 'cart',  color: '#E07A5F', label: 'хлеб 12' },
              { icon: 'plate', color: '#D4A574', label: '65 кофе' },
              { icon: 'fuel',  color: '#8AA9D6', label: 'sonol 200' },
              { icon: 'pill',  color: '#C97B84', label: 'аптека 45' },
              { icon: 'bus',   color: '#F2CC8F', label: 'такси 60' },
            ].map((s) => (
              <button key={s.label} style={{
                padding: '10px 14px 10px 10px', borderRadius: 999,
                background: C.card, border: `1.5px solid ${C.hairline}`,
                fontSize: 13, fontWeight: 800, color: C.fg, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontFamily: 'ui-monospace, monospace',
                boxShadow: SVS.bubble,
              }}>
                <SVSk icon={s.icon} color={s.color} size={22}/>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 720 }}>
          <DesktopComposer placeholder="напиши первую трату — «хлеб 12»" focused/>
        </div>
      </div>
    </div>
  );
}
function EmptySetupCard() {
  const { C } = useTheme();
  return (
    <>
      <RPCard title="ПЕРВЫЕ ШАГИ" accent={C.primary}>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { n: 1, done: true,  title: 'Зарегистрировался', sub: 'email подтверждён' },
            { n: 2, done: false, title: 'Установи бюджет на месяц', sub: 'мы предложим разбивку', action: 'Открыть' },
            { n: 3, done: false, title: 'Пригласи семью', sub: 'делиться тратами', action: 'Пригласить' },
            { n: 4, done: false, title: 'Сделай первую запись', sub: 'просто напиши в чат →' },
          ].map((s) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: s.done ? '#81B29A' : 'transparent',
                border: s.done ? 'none' : `1.5px solid ${C.chromeBorder}`,
                color: s.done ? '#fff' : C.chromeSub,
                fontSize: 11, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.done ? (
                  <svg width="11" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                ) : s.n}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12.5, fontWeight: 800, color: s.done ? C.chromeSub : C.chromeFg, margin: 0, textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0' }}>{s.sub}</p>
                {s.action && (
                  <button style={{
                    marginTop: 6, padding: '4px 10px', borderRadius: 8,
                    background: C.primary, border: 0, color: '#fff',
                    fontSize: 11, fontWeight: 900, cursor: 'pointer',
                  }}>{s.action} →</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </RPCard>

      <RPCard title="ШПАРГАЛКА · КАК ПИСАТЬ" accent="#A48BC9">
        <div style={{ padding: '4px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['хлеб 12',     '₪12 → Продукты'],
            ['65 кофе',     '₪65 → Кафе'],
            ['sonol 200',   '₪200 → Бензин'],
            ['🍕 65',       '₪65 → Фастфуд'],
            ['+зарплата 12к', '+₪12 000 (доход)'],
          ].map(([inp, out]) => (
            <div key={inp} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ flex: 1, fontFamily: 'ui-monospace, monospace', fontSize: 11.5, fontWeight: 800, color: C.chromeFg, background: C.chromeBg, padding: '4px 8px', borderRadius: 8 }}>{inp}</code>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.chromeSub} strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 800, color: C.primary }}>{out}</span>
            </div>
          ))}
        </div>
      </RPCard>
    </>
  );
}

/* ─── State D · SEARCH OVERLAY (Cmd+K) ─── */
function StateSearch({ dark, density }) {
  return (
    <V1Frame dark={dark} density={density}>
      <DesktopSidebar activeKey="чат"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
        <DimmedChatBg/>
        <SearchPalette/>
      </div>
      <RightPanel width={340}>
        <RPToday spent={75} total={200}/>
        <RPEnvelopes/>
      </RightPanel>
    </V1Frame>
  );
}
function DimmedChatBg() {
  const { C } = useTheme();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, filter: 'saturate(.5) brightness(.94)', opacity: .42 }}>
      <DesktopChatHeader/>
      <div style={{ flex: 1, overflowY: 'hidden' }}>
        <div style={{ width: 720, margin: '0 auto' }}>
          <DateChipV>Среда · 17 мая</DateChipV>
          <BotBubble time="07:00">Доброе утро ✨</BotBubble>
          <UserBubble time="09:14" status="saved">хлеб 12</UserBubble>
          <UserBubble time="11:42" status="saved">65 кофе</UserBubble>
        </div>
      </div>
      <DesktopComposer/>
    </div>
  );
}
function SearchPalette() {
  const { C } = useTheme();
  const results = [
    { kind: 'tx',  icon: 'plate',  color: '#D4A574', title: 'Кофе · Aroma',     hint: 'Кафе · 17 мая',     amt: 65, when: 'сегодня' },
    { kind: 'tx',  icon: 'plate',  color: '#D4A574', title: 'Кофе · Cup Coffee', hint: 'Кафе · 15 мая',    amt: 28, when: 'пн' },
    { kind: 'tx',  icon: 'plate',  color: '#D4A574', title: 'Обед · кофе',       hint: 'Кафе · 14 мая',    amt: 92, when: 'вс' },
    { kind: 'env', icon: 'coffee', color: '#D4A574', title: 'Конверт «Кафе»',    hint: 'неделя 140/200 ⚠', tag: 'конверт' },
    { kind: 'cmd', icon: 'chart_up', color: C.primary, title: 'Статистика по «Кафе»', hint: 'за май · 6 операций', tag: 'переход' },
  ];
  return (
    <div style={{
      position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
      width: 640, maxWidth: '90%',
      background: C.card, borderRadius: 18,
      boxShadow: '0 30px 80px rgba(61,44,31,.25), 0 12px 32px rgba(61,44,31,.12)',
      overflow: 'hidden', border: `1px solid ${C.hairline}`,
    }}>
      {/* Input */}
      <div style={{ padding: '14px 18px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.hairline}` }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <span style={{ ...SVT.body, fontSize: 17, color: C.fg, flex: 1 }}>
          кофе
          <span style={{ display: 'inline-block', width: 2, height: 18, background: C.primary, marginLeft: 2, verticalAlign: 'middle' }}/>
        </span>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.sub, padding: '3px 7px', border: `1px solid ${C.hairline}`, borderRadius: 6 }}>ESC</span>
      </div>

      {/* Filter chips */}
      <div style={{ padding: '8px 18px', display: 'flex', gap: 6, borderBottom: `1px solid ${C.hairline}`, background: C.bgSoft }}>
        {[
          { label: 'Все · 12',     active: true },
          { label: 'Траты · 8' },
          { label: 'Конверты · 1' },
          { label: 'Команды · 3' },
          { label: 'этот месяц' },
        ].map((f) => (
          <button key={f.label} style={{
            padding: '4px 11px', borderRadius: 999,
            background: f.active ? C.primary : 'transparent',
            color: f.active ? '#fff' : C.sub,
            border: f.active ? 'none' : `1px solid ${C.hairline}`,
            fontSize: 11, fontWeight: 800, cursor: 'pointer',
          }}>{f.label}</button>
        ))}
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, alignSelf: 'center' }}>↑↓ навигация · ↵ открыть</span>
      </div>

      {/* Results */}
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {/* Section header — TRANSACTIONS */}
        <p style={{ ...SVT.caption, color: C.sub, margin: '12px 18px 6px' }}>транзакции</p>
        {results.filter(r => r.kind === 'tx').map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 18px',
            background: i === 0 ? `${C.primary}10` : 'transparent',
            cursor: 'pointer',
          }}>
            {i === 0 && <div style={{ width: 3, height: 28, marginLeft: -18, marginRight: 11, background: C.primary, borderRadius: 3 }}/>}
            <SVSk icon={r.icon} color={r.color} size={26}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: C.fg, margin: 0 }}>
                <Highlight text={r.title} q="кофе"/>
              </p>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.sub, margin: '1px 0 0' }}>{r.hint}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: C.fg, fontVariantNumeric: 'tabular-nums' }}>−₪{r.amt}</span>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: C.sub, margin: '1px 0 0' }}>{r.when}</p>
            </div>
            {i === 0 && <span style={{ fontSize: 10, fontWeight: 800, color: C.sub, padding: '3px 7px', border: `1px solid ${C.hairline}`, borderRadius: 6, marginLeft: 8 }}>↵</span>}
          </div>
        ))}

        <p style={{ ...SVT.caption, color: C.sub, margin: '12px 18px 6px' }}>конверты и переходы</p>
        {results.filter(r => r.kind !== 'tx').map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', cursor: 'pointer' }}>
            <SVSk icon={r.icon} color={r.color} size={26}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: C.fg, margin: 0 }}>
                <Highlight text={r.title} q="кофе"/>
              </p>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.sub, margin: '1px 0 0' }}>{r.hint}</p>
            </div>
            {r.tag && (
              <span style={{ fontSize: 10, fontWeight: 800, color: C.sub, padding: '3px 7px', background: C.bgSoft, borderRadius: 6 }}>{r.tag}</span>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 18px', borderTop: `1px solid ${C.hairline}`, background: C.bgSoft, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: C.sub, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ padding: '2px 5px', border: `1px solid ${C.hairline}`, borderRadius: 4, background: C.card }}>⌘</span>
          <span style={{ padding: '2px 5px', border: `1px solid ${C.hairline}`, borderRadius: 4, background: C.card }}>K</span>
          вызов
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: C.sub }}>↑↓ выбор · ↵ открыть · ESC закрыть</span>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: C.sub }}>искать локально · без сети</span>
      </div>
    </div>
  );
}
function Highlight({ text, q }) {
  const { C } = useTheme();
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span style={{ background: C.yellow + '99', color: C.fg, fontWeight: 900, padding: '0 1px', borderRadius: 2 }}>{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

/* ─── Right Panel variations ─── */

function PanelVariant({ children, label, width = 380, dark, density }) {
  return (
    <ThemeProvider dark={dark} density={density}>
      <PanelVariantInner width={width} label={label}>{children}</PanelVariantInner>
    </ThemeProvider>
  );
}
function PanelVariantInner({ children, width, label }) {
  const { C } = useTheme();
  return (
    <div style={{ width: width + 28, padding: 14, background: 'transparent', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ ...SVT.caption, color: C.sub, margin: '0 4px 4px', fontSize: 9.5 }}>{label}</p>
      <div style={{
        background: C.chromeBg2,
        borderLeft: `1px solid ${C.chromeBorder}`,
        borderRight: `1px solid ${C.chromeBorder}`,
        borderRadius: 8,
        padding: 14,
        display: 'flex', flexDirection: 'column', gap: 14,
        height: 740, overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

function PanelBudgetFirst({ dark, density }) {
  return (
    <PanelVariant label="A · ПРИВЫЧНЫЙ — конверты сверху" dark={dark} density={density}>
      <RPToday spent={75} total={200}/>
      <RPEnvelopes/>
      <RPBills/>
    </PanelVariant>
  );
}
function PanelActivityFirst({ dark, density }) {
  return (
    <PanelVariant label="B · ХРОНИКА — активность сверху" dark={dark} density={density}>
      <RPToday spent={75} total={200}/>
      <RPRecent/>
      <RPBills/>
    </PanelVariant>
  );
}
function PanelGoalsFirst({ dark, density }) {
  return (
    <PanelVariant label="C · ЦЕЛИ — копилки сверху" dark={dark} density={density}>
      <RPToday spent={75} total={200}/>
      <RPGoals/>
      <RPBills/>
    </PanelVariant>
  );
}
function PanelCollapsed({ dark, density }) {
  return (
    <ThemeProvider dark={dark} density={density}>
      <PanelCollapsedInner/>
    </ThemeProvider>
  );
}
function PanelCollapsedInner() {
  const { C } = useTheme();
  return (
    <div style={{ width: 96, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ ...SVT.caption, color: C.sub, margin: '0 4px 4px', fontSize: 9.5 }}>D · СВЁРНУТО — только статус</p>
      <div style={{
        background: C.chromeBg2,
        borderLeft: `1px solid ${C.chromeBorder}`,
        borderRight: `1px solid ${C.chromeBorder}`,
        borderRadius: 8,
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', gap: 10,
        height: 740, alignItems: 'center',
      }}>
        {/* Today small */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`,
          color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: SVS.pinned,
          position: 'relative',
        }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, opacity: .8 }}>СЕГ</span>
          <span style={{ fontSize: 17, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>₪125</span>
          <span style={{
            position: 'absolute', bottom: -3, right: -3,
            background: '#fff', color: C.primary,
            fontSize: 8.5, fontWeight: 900,
            padding: '2px 5px', borderRadius: 8,
            border: `1.5px solid ${C.primary}`,
            fontVariantNumeric: 'tabular-nums',
          }}>62%</span>
        </div>

        {/* Pinned icons */}
        {[
          { icon: 'box',      color: '#81B29A', badge: '5',   label: 'конверты' },
          { icon: 'piggy',    color: '#A48BC9', badge: '+',   label: 'копилки', tone: 'ahead' },
          { icon: 'refund',   color: '#F2CC8F', badge: '!',   label: '3д', tone: 'attention' },
          { icon: 'chart_up', color: '#E07A5F', badge: '83%', label: 'неделя' },
          { icon: 'cart',     color: '#E07A5F', badge: '12',  label: 'операций' },
        ].map((it) => (
          <button key={it.label} style={{
            width: 56, height: 56, borderRadius: 14,
            background: C.chromeCard, border: `1px solid ${C.chromeBorder}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative',
            gap: 2,
          }}>
            <SVSk icon={it.icon} color={it.color} size={28}/>
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 18, height: 18, borderRadius: 9,
              background: it.tone === 'attention' ? C.primary : it.tone === 'ahead' ? '#81B29A' : it.color + '22',
              color: it.tone === 'attention' || it.tone === 'ahead' ? '#fff' : it.color,
              fontSize: 9.5, fontWeight: 900, padding: '0 5px', lineHeight: '18px', textAlign: 'center',
              border: `2px solid ${C.chromeBg2}`,
            }}>{it.badge}</span>
          </button>
        ))}

        <div style={{ flex: 1 }}/>

        <button style={{
          width: 36, height: 36, borderRadius: '50%', border: `1px solid ${C.chromeBorder}`,
          background: C.chromeCard, color: C.chromeSub, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  StateClarify, StateWeeklyRecap, StateEmpty, StateSearch,
  PanelBudgetFirst, PanelActivityFirst, PanelGoalsFirst, PanelCollapsed,
});
