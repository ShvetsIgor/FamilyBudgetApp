/* Three desktop chat variants. All share DesktopSidebar + DesktopChatHeader + DesktopComposer,
   diverge in (1) what's around the chat, (2) how bot rich-cards render, (3) how density feels. */

const {
  C: SC, T: ST, SHADOW: SS, RAD: SR, Sk: SSk,
  BotBubble, BotCardBubble, UserBubble, SavedRow, Envelope, QuickReplies,
  ThemeProvider, useTheme, DENSITY,
  DesktopSidebar, DesktopChatHeader, DesktopComposer,
  SystemMessage, RightPanel,
  RPToday, RPEnvelopes, RPGoals, RPBills, RPRecent, RPCard,
} = window;

/* ─── DateChip (desktop variant) ─── */
function DateChipD({ children }) {
  const { C } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 24px 8px' }}>
      <div style={{ flex: 1, height: 1, background: C.hairline }}/>
      <span style={{ fontSize: 10, fontWeight: 800, color: C.sub, letterSpacing: '.08em', textTransform: 'uppercase' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: C.hairline }}/>
    </div>
  );
}

/* ─── Mini chart helpers (V2) ─── */
function Sparkline({ data, color, width = 120, height = 28 }) {
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - (v / max) * (height - 4) - 2]);
  const path = pts.reduce((a, [x, y], i) => a + (i === 0 ? `M${x},${y}` : ` L${x},${y}`), '');
  const area = path + ` L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={area} fill={color} opacity=".15"/>
      <path d={path} stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      {pts.map(([x, y], i) => i === pts.length - 1 && <circle key={i} cx={x} cy={y} r="3" fill={color}/>)}
    </svg>
  );
}
function MiniBars({ data, color, width = 130, height = 32 }) {
  const max = Math.max(...data, 1);
  const bw = (width - (data.length - 1) * 3) / data.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((v, i) => {
        const h = (v / max) * (height - 2);
        return <rect key={i} x={i * (bw + 3)} y={height - h} width={bw} height={h} rx="2" fill={color} opacity={i === data.length - 1 ? 1 : .45}/>;
      })}
    </svg>
  );
}
function Donut({ size = 64, segments, label, sub }) {
  const r = size / 2 - 6;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.v, 0);
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EDE0CC" strokeWidth="5"/>
      {segments.map((s, i) => {
        const len = (s.v / total) * circ;
        const off = (acc / total) * circ;
        acc += s.v;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="5"
            strokeDasharray={`${len} ${circ}`} strokeDashoffset={-off}
            transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt"/>
        );
      })}
      {label && <text x={cx} y={cy + 1} textAnchor="middle" fontSize="13" fontWeight="900" fill="#3D2C1F">{label}</text>}
      {sub && <text x={cx} y={cy + 11} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#8E7A66">{sub}</text>}
    </svg>
  );
}

/* ─── Bot saved-card content for each variant ─── */

/* V1 — close to mobile: row + (optional) envelope strip */
function V1SavedCard({ icon, color, title, hint, amount, envelope }) {
  const { C } = useTheme();
  return (
    <BotCardBubble wide>
      <SavedRow icon={icon} color={color} title={title} hint={hint} amount={amount}/>
      {envelope && (
        <div style={{ padding: '0 0 8px', borderTop: `1px solid ${C.hairline}` }}>
          <Envelope name={envelope.name} icon={envelope.icon} color={envelope.color} spent={envelope.spent} limit={envelope.limit}/>
        </div>
      )}
    </BotCardBubble>
  );
}

/* V2 — Live dashboard bubble: row + sparkline + envelope + trend tag */
function V2SavedCard({ icon, color, title, hint, amount, envelope, week7, trend }) {
  const { C } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, margin: '8px 24px 2px' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${C.primaryTint}, ${C.primary}22)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        alignSelf: 'flex-end',
      }}>
        <Sk icon="piggy" color={C.primary} size={20}/>
      </div>
      <div style={{
        flex: 1, maxWidth: 480,
        background: C.card, borderRadius: 22, borderBottomLeftRadius: 8,
        boxShadow: SS.card, overflow: 'hidden',
        borderLeft: `4px solid ${color}`,
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
          <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sk icon={icon} color={color} size={30}/>
            <span style={{
              position: 'absolute', bottom: -2, right: -3,
              width: 18, height: 18, borderRadius: '50%',
              background: C.sage, border: `2px solid ${C.card}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="9" height="7" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...ST.h2, fontSize: 15, margin: 0, color: C.fg }}>{title}</p>
            {hint && <p style={{ fontSize: 12, fontWeight: 700, color: C.sub, margin: '2px 0 0' }}>{hint}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ ...ST.amount, fontSize: 20, color: C.fg }}>₪{amount}</span>
            {trend != null && (
              <p style={{ fontSize: 10.5, fontWeight: 800, color: trend > 0 ? C.primary : C.sage, margin: '2px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  {trend > 0 ? <path d="M7 17l10-10M7 7h10v10"/> : <path d="M7 7l10 10M7 17h10V7"/>}
                </svg>
                {trend > 0 ? '+' : ''}{trend}% к среднему
              </p>
            )}
          </div>
        </div>
        {/* Inline mini-dashboard: sparkline of last 7 days */}
        {week7 && (
          <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>
                {title} · последние 7 дней
              </p>
              <MiniBars data={week7} color={color} width={220} height={28}/>
            </div>
            <div style={{ width: 1, height: 30, background: C.hairline }}/>
            <div style={{ width: 80, textAlign: 'right' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>средн./день</p>
              <p style={{ fontSize: 14, fontWeight: 900, color: C.fg, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                ₪{Math.round(week7.reduce((s,v)=>s+v,0) / week7.length)}
              </p>
            </div>
          </div>
        )}
        {envelope && (
          <div style={{ borderTop: `1px solid ${C.hairline}`, padding: '6px 0 10px' }}>
            <Envelope name={envelope.name} icon={envelope.icon} color={envelope.color} spent={envelope.spent} limit={envelope.limit}/>
          </div>
        )}
      </div>
    </div>
  );
}

/* V3 — saved card with explicit "Закрепить" pin button */
function V3SavedCard({ icon, color, title, hint, amount, envelope, pinHint }) {
  const { C } = useTheme();
  return (
    <BotCardBubble wide>
      <SavedRow icon={icon} color={color} title={title} hint={hint} amount={amount}/>
      {envelope && (
        <div style={{ padding: '0 0 6px', borderTop: `1px solid ${C.hairline}` }}>
          <Envelope name={envelope.name} icon={envelope.icon} color={envelope.color} spent={envelope.spent} limit={envelope.limit}/>
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px 10px', borderTop: `1px solid ${C.hairline}`,
        background: C.bgSoft,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5M5 12V7a7 7 0 0 1 14 0v5l2 5H3l2-5z"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, flex: 1 }}>{pinHint || 'перетащи на доску →'}</span>
        <button style={{
          padding: '4px 10px', borderRadius: 999, border: `1.5px solid ${C.primary}`,
          background: 'transparent', color: C.primary, fontSize: 11, fontWeight: 900, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          ЗАКРЕПИТЬ
        </button>
      </div>
    </BotCardBubble>
  );
}

/* ─── Common chat narrative (today, Wed) ───
   Each variant renders the same story with its own SavedCard renderer. */
function MorningChatScene({ Card }) {
  const { C } = useTheme();
  return (
    <>
      <DateChipD>Среда · 17 мая</DateChipD>

      <BotBubble time="07:00">
        Доброе утро ✨<br/>
        Вчера потратил <b>₪265</b> — кофе и бензин.<br/>
        На сегодня свободно <b style={{ color: C.primary }}>₪140</b>.
      </BotBubble>
      <QuickReplies items={[
        { label: 'Конверты', icon: 'box' },
        { label: 'Неделя',   icon: 'chart_up' },
      ]}/>

      <UserBubble time="09:14" status="saved">хлеб 12</UserBubble>
      <Card
        icon="cart" color={C.primary} title="Продукты" hint="Супермаркет · общий магазин"
        amount={12}
        week7={[28, 45, 50, 18, 60, 32, 12]}
      />

      <SystemMessage who="Аня" whoColor="#A48BC9" icon="cart" iconColor={C.primary}
        amount={50} category="Продукты" hint="Молоко · яйца" time="09:32"/>

      <UserBubble time="11:42" status="saved">65 кофе</UserBubble>
      <Card
        icon="coffee" color={C.caramel} title="Кафе · Кофе" hint="Кафе и рестораны"
        amount={65}
        trend={14}
        week7={[8, 0, 12, 20, 15, 28, 65]}
        envelope={{ name: 'Кафе на неделю', icon: 'coffee', color: C.caramel, spent: 140, limit: 200 }}
        pinHint="закрепить «Кафе» на доске — будет видно лимит"
      />

      <SystemMessage who="Мама" whoColor="#81B29A" icon="gift" iconColor="#C97B84"
        amount={120} category="Подарок · Семья" hint="Цветы для бабушки" time="12:18"/>

      <UserBubble time="14:08" status="saved">sonol 200</UserBubble>
      <Card
        icon="fuel" color={C.blueSoft} title="Бензин · Sonol" hint="Машина"
        amount={200}
        week7={[0, 0, 180, 0, 0, 0, 200]}
        envelope={{ name: 'Машина в мае', icon: 'car', color: C.blueSoft, spent: 240, limit: 400 }}
      />
    </>
  );
}

/* ─── Frame: shared wrapper around the variant ─── */
function DesktopFrame({ children, dark, density, width = 1440, height = 900 }) {
  return (
    <ThemeProvider dark={dark} density={density}>
      <FrameInner width={width} height={height}>{children}</FrameInner>
    </ThemeProvider>
  );
}
function FrameInner({ children, width, height }) {
  const { C } = useTheme();
  return (
    <div style={{
      width, height,
      background: C.chromeBg2,
      display: 'flex',
      fontFamily: 'Nunito, sans-serif', color: C.fg,
      overflow: 'hidden',
      borderRadius: 18,
      boxShadow: '0 30px 80px rgba(61,44,31,.18), 0 8px 24px rgba(61,44,31,.08)',
    }}>{children}</div>
  );
}

/* ─── V1 · Classic Messenger ─── */
function VariantClassic({ dark, density, chatWidth = 720, showRight = true }) {
  return (
    <DesktopFrame dark={dark} density={density}>
      <DesktopSidebar activeKey="чат"/>
      <ClassicCenter chatWidth={chatWidth}/>
      {showRight && (
        <RightPanel width={340}>
          <RPToday spent={75} total={200}/>
          <RPEnvelopes/>
          <RPGoals/>
          <RPBills/>
        </RightPanel>
      )}
    </DesktopFrame>
  );
}
function ClassicCenter({ chatWidth }) {
  const { C } = useTheme();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, minWidth: 0 }}>
      <DesktopChatHeader/>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: chatWidth, maxWidth: '100%' }}>
          <MorningChatScene Card={V1SavedCard}/>
          <div style={{ height: 12 }}/>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: chatWidth, maxWidth: '100%' }}>
          <DesktopComposer/>
        </div>
      </div>
    </div>
  );
}

/* ─── V2 · Live Dashboard Bubbles ─── */
function VariantDashboard({ dark, density, chatWidth = 760, showRight = true }) {
  return (
    <DesktopFrame dark={dark} density={density}>
      <DesktopSidebar activeKey="чат"/>
      <DashCenter chatWidth={chatWidth}/>
      {showRight && (
        <RightPanel width={340}>
          <RPToday spent={75} total={200}/>
          <GlanceWidgets/>
          <RPEnvelopes/>
          <RPBills/>
        </RightPanel>
      )}
    </DesktopFrame>
  );
}
function GlanceWidgets() {
  const { C } = useTheme();
  return (
    <RPCard title="ВЗГЛЯД · НЕДЕЛЯ 20" accent={C.primary}>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Donut size={72} segments={[
          { v: 580, color: '#E07A5F' }, { v: 205, color: '#D4A574' },
          { v: 240, color: '#8AA9D6' }, { v: 520, color: '#81B29A' },
          { v: 95,  color: '#A8B89C' },
        ]} label="83%" sub="плана"/>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: C.chromeSub, margin: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>потратили</p>
          <p style={{ ...ST.display, fontSize: 22, color: C.chromeFg, margin: '2px 0 0' }}>₪1 840</p>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0' }}>из ₪2 200 · ост. ₪360</p>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${C.chromeBorder}`, padding: '10px 14px', display: 'flex', gap: 10 }}>
        {[
          { lab: 'тяжёлый', val: 'Ср·₪420', color: '#E07A5F' },
          { lab: 'лёгкий',  val: 'Вс·₪80',  color: '#81B29A' },
          { lab: 'часто',   val: '☕×6',     color: C.chromeFg },
        ].map((s, i, arr) => (
          <React.Fragment key={s.lab}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9.5, fontWeight: 800, color: C.chromeSub, margin: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.lab}</p>
              <p style={{ fontSize: 12, fontWeight: 900, color: s.color, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{s.val}</p>
            </div>
            {i < arr.length - 1 && <div style={{ width: 1, background: C.chromeBorder }}/>}
          </React.Fragment>
        ))}
      </div>
    </RPCard>
  );
}
function DashCenter({ chatWidth }) {
  const { C } = useTheme();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, minWidth: 0 }}>
      <DesktopChatHeader/>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: chatWidth, margin: '0 auto' }}>
          <MorningChatScene Card={V2SavedCard}/>
          <div style={{ height: 12 }}/>
        </div>
      </div>
      <div style={{ maxWidth: chatWidth, margin: '0 auto', width: '100%' }}>
        <DesktopComposer hint="бот умеет считать на лету: «500 пицца /4» → ₪125 на каждого"/>
      </div>
    </div>
  );
}

/* ─── V3 · Workspace / Pinboard ─── */
function VariantPinboard({ dark, density, chatWidth = 560 }) {
  return (
    <DesktopFrame dark={dark} density={density}>
      <DesktopSidebar activeKey="чат"/>
      <PinCenter chatWidth={chatWidth}/>
      <PinBoard/>
    </DesktopFrame>
  );
}
function PinCenter({ chatWidth }) {
  const { C } = useTheme();
  return (
    <div style={{ flex: '0 0 auto', width: chatWidth, display: 'flex', flexDirection: 'column', background: C.bg, borderRight: `1px solid ${C.hairline}` }}>
      <DesktopChatHeader/>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <MorningChatScene Card={V3SavedCard}/>
        <div style={{ height: 12 }}/>
      </div>
      <DesktopComposer placeholder="запиши быстро · ctrl+P → закрепить ответ"/>
    </div>
  );
}
function PinBoard() {
  const { C } = useTheme();
  return (
    <div style={{ flex: 1, minWidth: 0, background: C.chromeBg2, display: 'flex', flexDirection: 'column' }}>
      {/* Board header */}
      <div style={{
        height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${C.chromeBorder}`, flexShrink: 0,
      }}>
        <Sk icon="box" color={C.primary} size={26}/>
        <div style={{ flex: 1 }}>
          <p style={{ ...ST.h2, color: C.chromeFg, margin: 0, fontSize: 15 }}>Моя доска</p>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0' }}>5 карточек закреплены · из чата</p>
        </div>
        <button style={{
          padding: '8px 14px', borderRadius: 10, border: `1.5px dashed ${C.chromeSub}77`,
          background: 'transparent', color: C.chromeSub, fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Добавить виджет
        </button>
      </div>
      {/* Board grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 16,
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
        gridAutoRows: 'min-content',
      }}>
        {/* Today (large) */}
        <div style={{ gridColumn: 'span 2' }}><RPToday spent={75} total={200}/></div>

        {/* Envelope card (just-pinned, glowing) */}
        <PinnedWidget glow={C.primary} pinnedFrom="13:02" title="КАФЕ" accent="#D4A574">
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sk icon="coffee" color="#D4A574" size={28}/>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: C.chromeFg, margin: 0 }}>Кафе на неделю</p>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0' }}>сброс в воскресенье</p>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ ...ST.display, fontSize: 22, color: C.chromeFg }}>₪140</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#C9684E' }}>⚠ ₪60 до лимита</span>
            </div>
            <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(142,122,102,.18)', overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', background: '#D4A574' }}/>
            </div>
          </div>
        </PinnedWidget>

        {/* Goal */}
        <PinnedWidget title="ОТПУСК ГРУЗИЯ" accent="#A48BC9">
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sk icon="piggy" color="#A48BC9" size={28}/>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: C.chromeFg, margin: 0 }}>Цель: ₪14 000</p>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: '#81B29A', margin: '1px 0 0' }}>+опережение на 2 нед</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#A48BC9', fontVariantNumeric: 'tabular-nums' }}>60%</span>
            </div>
            <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: 'rgba(142,122,102,.18)', overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', background: '#A48BC9' }}/>
            </div>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: C.chromeSub, margin: '8px 0 0' }}>отложено ₪8 400 · осталось ₪5 600</p>
          </div>
        </PinnedWidget>

        {/* Custom note widget */}
        <PinnedWidget title="ЗАМЕТКА" accent="#F2CC8F">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: C.chromeFg, margin: 0 }}>В этот раз пробуем</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.chromeSub, margin: 0, lineHeight: 1.5 }}>
              не больше <b style={{ color: C.chromeFg }}>3 кофе</b> в неделю.<br/>
              Бот напомнит после второго.
            </p>
          </div>
        </PinnedWidget>

        {/* Bills compact */}
        <PinnedWidget title="БЛИЖАЙШИЕ" accent="#81B29A">
          <div style={{ padding: '10px 14px 12px' }}>
            <p style={{ ...ST.display, fontSize: 20, color: C.chromeFg, margin: 0 }}>₪5 033</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.chromeSub, margin: '2px 0 6px' }}>4 платежа · 14 дней</p>
            {[
              { name: 'Аренда', day: '20', amt: 4600, color: '#81B29A' },
              { name: 'Bezeq',  day: '22', amt: 145,  color: '#8AA9D6' },
              { name: 'Спортзал', day: '29', amt: 199, color: '#E07A5F' },
            ].map((b) => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.chromeFg }}>{b.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.chromeSub }}>{b.day} мая · <b style={{ color: C.chromeFg }}>₪{b.amt}</b></span>
              </div>
            ))}
          </div>
        </PinnedWidget>

        {/* Empty drop slot */}
        <div style={{
          gridColumn: 'span 2',
          minHeight: 100, borderRadius: 16,
          border: `2px dashed ${C.chromeSub}55`, background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 6,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.chromeSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".6">
            <path d="M12 17v5M5 12V7a7 7 0 0 1 14 0v5l2 5H3l2-5z"/>
          </svg>
          <p style={{ fontSize: 11.5, fontWeight: 800, color: C.chromeSub, margin: 0, opacity: .8 }}>перетащи карточку из чата →</p>
        </div>
      </div>
    </div>
  );
}
function PinnedWidget({ title, accent, glow, pinnedFrom, children }) {
  const { C } = useTheme();
  return (
    <div style={{
      background: C.chromeCard, borderRadius: 16,
      border: `1px solid ${glow ? glow + '66' : C.chromeBorder}`,
      boxShadow: glow ? `0 0 0 3px ${glow}1a, 0 6px 14px rgba(61,44,31,.06)` : '0 1px 2px rgba(61,44,31,.05)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: accent ? `1px solid ${C.chromeBorder}` : 'none',
        background: accent ? `${accent}10` : 'transparent',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }}/>
        <p style={{ ...ST.caption, color: accent, margin: 0, fontSize: 9.5 }}>{title}</p>
        {pinnedFrom && (
          <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 800, color: C.chromeSub, opacity: .7 }}>📌 из чата · {pinnedFrom}</span>
        )}
        <button style={{
          marginLeft: pinnedFrom ? 6 : 'auto', width: 18, height: 18, borderRadius: 6, border: 0,
          background: 'transparent', color: C.chromeSub, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
      </div>
      {children}
    </div>
  );
}

/* ─── Scene: Section overlay over chat ─── */
function SceneSectionOverlay({ dark, density, section = 'envelopes' }) {
  return (
    <DesktopFrame dark={dark} density={density}>
      <DesktopSidebar activeKey="конверты"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
        <DimmedChat/>
        <SectionSheet section={section}/>
      </div>
      <RightPanel width={340}>
        <RPToday spent={75} total={200}/>
        <RPBills/>
      </RightPanel>
    </DesktopFrame>
  );
}
function DimmedChat() {
  const { C } = useTheme();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, filter: 'saturate(.5) brightness(.96)', opacity: .5 }}>
      <DesktopChatHeader/>
      <div style={{ flex: 1, overflowY: 'hidden' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <MorningChatScene Card={V1SavedCard}/>
        </div>
      </div>
      <DesktopComposer/>
    </div>
  );
}
function SectionSheet({ section }) {
  const { C } = useTheme();
  return (
    <div style={{
      position: 'absolute', inset: '24px 24px 24px 24px',
      background: C.card, borderRadius: 22,
      boxShadow: '0 30px 80px rgba(61,44,31,.25), 0 12px 32px rgba(61,44,31,.12)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      border: `1px solid ${C.hairline}`,
    }}>
      {/* Sheet header */}
      <div style={{
        padding: '16px 22px', borderBottom: `1px solid ${C.hairline}`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: '#81B29A22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sk icon="box" color="#81B29A" size={30}/>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ ...ST.h1, color: C.fg, margin: 0, fontSize: 20 }}>Конверты на неделю</p>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.sub, margin: '2px 0 0' }}>Неделя 20 · 13–19 мая · потратили 83% плана</p>
        </div>
        <button style={{
          padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${C.hairline}`, background: 'transparent', color: C.fg,
          fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          вернуться в чат
        </button>
        <button style={{
          padding: '8px 14px', borderRadius: 10, border: 0,
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`, color: '#fff',
          fontSize: 12, fontWeight: 800, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: `0 4px 10px ${C.primaryDeep}44`,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          новый конверт
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: 22, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, overflowY: 'auto', alignContent: 'start' }}>
        {[
          { name: 'Продукты',    icon: 'cart',   color: '#E07A5F', spent: 580, limit: 600, daily: [80, 120, 95, 60, 110, 75, 40] },
          { name: 'Кафе',        icon: 'plate',  color: '#D4A574', spent: 205, limit: 200, over: true, daily: [20, 35, 28, 45, 30, 25, 22] },
          { name: 'Машина',      icon: 'car',    color: '#8AA9D6', spent: 240, limit: 400, daily: [0, 0, 180, 0, 0, 60, 0] },
          { name: 'Дом и счета', icon: 'house',  color: '#81B29A', spent: 520, limit: 600, daily: [0, 0, 0, 520, 0, 0, 0] },
          { name: 'Развлечения', icon: 'cinema', color: '#A8B89C', spent: 95,  limit: 200, daily: [0, 35, 0, 0, 60, 0, 0] },
          { name: 'Дети',        icon: 'kid',    color: '#C97B84', spent: 180, limit: 300, daily: [40, 30, 50, 20, 0, 25, 15] },
        ].map((e) => {
          const pct = Math.min(100, (e.spent / e.limit) * 100);
          return (
            <div key={e.name} style={{ background: C.bgSoft, borderRadius: 16, padding: 16, border: `1px solid ${C.hairline}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: e.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sk icon={e.icon} color={e.color} size={26}/>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: C.fg, margin: 0 }}>{e.name}</p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: e.over ? C.primary : C.sub, margin: '1px 0 0' }}>
                    {e.over ? '⚠ перебор +₪' + (e.spent - e.limit) : 'осталось ₪' + (e.limit - e.spent)}
                  </p>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ ...ST.display, fontSize: 22, color: C.fg }}>₪{e.spent}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.sub }}>из ₪{e.limit}</span>
              </div>
              <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(142,122,102,.18)', overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: e.over ? `linear-gradient(90deg, ${C.primary}, ${C.primaryDeep})` : e.color, borderRadius: 3 }}/>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 9.5, fontWeight: 800, color: C.sub, margin: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>по дням</p>
                  <MiniBars data={e.daily} color={e.color} width={130} height={28}/>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: C.sub }}>пн·вт·ср·чт·пт·сб·вс</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Scene: Bills focus (right panel highlighted) ─── */
function SceneBillsFocus({ dark, density }) {
  return (
    <DesktopFrame dark={dark} density={density}>
      <DesktopSidebar activeKey="чат"/>
      <ClassicCenterBillsBuzz/>
      <RightPanel width={380}>
        <BillsFocusHero/>
        <RPGoals/>
        <RPRecent/>
      </RightPanel>
    </DesktopFrame>
  );
}
function ClassicCenterBillsBuzz() {
  const { C } = useTheme();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, minWidth: 0 }}>
      <DesktopChatHeader/>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 720, maxWidth: '100%' }}>
          <DateChipD>Четверг · 18 мая</DateChipD>
          <BotBubble time="07:00">
            Доброе утро. Сегодня <b style={{ color: C.primary }}>₪160</b> на день.<br/>
            Хочу обратить внимание — <b>20 мая</b> снимется аренда <b>₪4 600</b>.
            Чтобы остаться в плане, добавь в копилку <b>₪450</b> до пятницы.
          </BotBubble>
          <QuickReplies items={[
            { label: 'Отложить ₪450', icon: 'piggy', primary: true },
            { label: 'Все платежи · 14 дн', icon: 'refund' },
            { label: 'Перенести' },
          ]}/>
          <BotBubble>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Sk icon="refund" color="#F2CC8F" size={18}/>
              А вот так выглядит твой месяц по регулярным →
            </span>
          </BotBubble>
        </div>
      </div>
      <DesktopComposer/>
    </div>
  );
}
function BillsFocusHero() {
  const { C } = useTheme();
  return (
    <div style={{
      background: C.chromeCard, borderRadius: 18,
      border: `2px solid ${C.primary}`,
      boxShadow: `0 0 0 4px ${C.primary}1a, 0 14px 30px rgba(61,44,31,.1)`,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px 10px', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <svg style={{ position: 'absolute', top: -30, right: -30, opacity: .22 }} width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>
        <p style={{ ...ST.caption, opacity: .85, margin: 0 }}>РЕГУЛЯРНЫЕ · 14 ДНЕЙ</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ ...ST.display, fontSize: 28 }}>₪5 033</span>
          <span style={{ fontSize: 12, fontWeight: 800, opacity: .85 }}>4 платежа</span>
        </div>
        <p style={{ fontSize: 11.5, fontWeight: 700, opacity: .85, margin: '2px 0 0' }}>учтено в плане месяца · ост. ₪7 200</p>
      </div>

      {/* Timeline */}
      <div style={{ padding: '14px 16px 16px' }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: C.chromeSub, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>таймлайн</p>
        <BillTimeline/>
      </div>

      {/* List */}
      <div style={{ borderTop: `1px solid ${C.chromeBorder}` }}>
        {[
          { name: 'Аренда квартиры', icon: 'house', color: '#81B29A', amount: 4600, day: '20 мая', when: 'через 3 дня', auto: true, status: 'attention' },
          { name: 'Интернет Bezeq',  icon: 'phone', color: '#8AA9D6', amount: 145,  day: '22 мая', when: 'через 5 дней', auto: true },
          { name: 'Спортзал',        icon: 'box',   color: '#E07A5F', amount: 199,  day: '29 мая', when: 'через 12 дн' },
          { name: 'Cellcom',         icon: 'phone', color: '#A48BC9', amount: 89,   day: '31 мая', when: 'через 14 дн', auto: true },
        ].map((b, i, arr) => (
          <div key={b.name} style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px',
            borderTop: i > 0 ? `1px solid ${C.chromeBorder}` : 'none',
            background: b.status === 'attention' ? '#FAEAE233' : 'transparent',
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: b.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sk icon={b.icon} color={b.color} size={24}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: C.chromeFg, margin: 0 }}>{b.name}</p>
                {b.status === 'attention' && (
                  <span style={{ fontSize: 9.5, fontWeight: 900, color: C.primary, textTransform: 'uppercase', letterSpacing: '.04em' }}>! нужна сумма</span>
                )}
              </div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: C.chromeSub, margin: '1px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                {b.day} · {b.when}
                {b.auto && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#81B29A' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    авто
                  </span>
                )}
              </p>
            </div>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.chromeFg, fontVariantNumeric: 'tabular-nums' }}>₪{b.amount.toLocaleString('ru')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function BillTimeline() {
  const { C } = useTheme();
  const days = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  const today = 17;
  const bills = { 20: { amt: 4600, color: '#81B29A' }, 22: { amt: 145, color: '#8AA9D6' }, 29: { amt: 199, color: '#E07A5F' }, 31: { amt: 89, color: '#A48BC9' } };
  return (
    <div>
      <div style={{ position: 'relative', height: 60 }}>
        {/* Axis */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, height: 1, background: C.chromeBorder }}/>
        {days.map((d, i) => {
          const x = (i / (days.length - 1)) * 100;
          const b = bills[d];
          const isToday = d === today;
          return (
            <div key={d} style={{ position: 'absolute', left: x + '%', transform: 'translateX(-50%)', bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {b && (
                <div style={{
                  width: 30, height: Math.max(6, (b.amt / 4600) * 38), marginBottom: 4,
                  borderRadius: 4, background: b.color,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                }}>
                  {b.amt >= 1000 && (
                    <span style={{ fontSize: 8.5, fontWeight: 900, color: '#fff', padding: '2px 0', whiteSpace: 'nowrap', writingMode: 'horizontal-tb' }}>
                      {b.amt >= 1000 ? `${(b.amt/1000).toFixed(1)}k` : '₪'+b.amt}
                    </span>
                  )}
                </div>
              )}
              <span style={{ fontSize: 9, fontWeight: isToday ? 900 : 700, color: isToday ? C.primary : C.chromeSub, marginBottom: 1 }}>{isToday ? 'СЕГ' : d}</span>
              <span style={{ width: isToday ? 5 : 2, height: isToday ? 5 : 2, borderRadius: '50%', background: isToday ? C.primary : C.chromeSub + '88' }}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, {
  VariantClassic, VariantDashboard, VariantPinboard,
  SceneSectionOverlay, SceneBillsFocus,
});
