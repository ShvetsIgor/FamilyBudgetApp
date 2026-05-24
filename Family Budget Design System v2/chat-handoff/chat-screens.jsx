/* Chat concept · screens (refined)
   Four mobile screens inside <IOSDevice>. */

const {
  C, T, SHADOW, RAD, Sk,
  ChatHeader, PinnedToday, DateChip,
  BotBubble, BotCardBubble, QuickReplies,
  UserBubble, SavedRow, Envelope, Typing,
  Composer, MenuOverlay,
} = window;

function ChatScreen({ children, composer, showMenu = false, showSuggest = false, composerValue = '' }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Nunito, sans-serif', color: C.fg,
      position: 'relative', overflow: 'hidden',
    }}>
      <ChatHeader/>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {children}
      </div>
      {composer === false ? null : (
        <Composer value={composerValue} showSuggest={showSuggest} focused={!!composerValue}/>
      )}
      {showMenu && <MenuOverlay/>}
    </div>
  );
}

/* ─── 01. Утро среды ─── */
function ScreenMorning() {
  return (
    <ChatScreen>
      <PinnedToday spent={60} total={200}/>

      <DateChip>Среда · 17 мая</DateChip>

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
      <BotCardBubble>
        <SavedRow icon="cart" color={C.primary} title="Продукты" hint="Супермаркет" amount={12}/>
        <div style={{ padding: '0 14px 12px', fontSize: 12, fontWeight: 700, color: C.sub }}>
          осталось <b style={{ color: C.fg }}>₪128</b> на день
        </div>
      </BotCardBubble>

      <UserBubble time="11:42" status="saved">65 кофе</UserBubble>
      <BotCardBubble>
        <SavedRow icon="coffee" color={C.caramel} title="Кафе · Кофе" hint="Кафе и рестораны" amount={65}/>
        <div style={{ padding: '0 0 6px' }}>
          <Envelope name="Кафе на неделю" icon="coffee" color={C.caramel} spent={140} limit={200}/>
        </div>
        <div style={{
          padding: '8px 14px 12px', fontSize: 12, fontWeight: 700,
          color: C.rose, borderTop: '1px solid ' + C.hairline,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ⚠️ Кофе уже на ₪140 из 200 — впритык к лимиту
        </div>
      </BotCardBubble>

      <UserBubble time="14:08" status="saved">sonol 200</UserBubble>
      <BotCardBubble>
        <SavedRow icon="fuel" color={C.blueSoft} title="Бензин · Sonol" hint="Машина" amount={200}/>
        <div style={{ padding: '0 0 8px' }}>
          <Envelope name="Машина в мае" icon="car" color={C.blueSoft} spent={240} limit={400}/>
        </div>
      </BotCardBubble>

      <div style={{ height: 12 }}/>
    </ChatScreen>
  );
}

/* ─── 02. Бот не понял — clarify ─── */
function ScreenClarify() {
  return (
    <ChatScreen composerValue="">
      <PinnedToday spent={75} total={200}/>

      <DateChip>Среда · 17 мая</DateChip>

      <BotBubble time="07:00">
        Доброе утро ✨ На сегодня свободно <b style={{ color: C.primary }}>₪140</b>.
      </BotBubble>

      <UserBubble time="11:42" status="saved">65 кофе</UserBubble>
      <BotBubble time="11:42">
        ✅ <b>₪65</b> → Кафе · неделя 140/200 ⚠️
      </BotBubble>

      <UserBubble time="14:30" status="sent">150</UserBubble>

      <BotBubble time="14:30">
        Не понял, <b>₪150</b> куда? 🤔
      </BotBubble>

      <div style={{ margin: '4px 14px 6px 48px', maxWidth: '82%' }}>
        <p style={{ ...T.caption, color: C.sub, margin: '6px 0 6px 2px', fontSize: 10 }}>Часто выбираешь</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { icon: 'cart',  color: C.primary,  label: 'Продукты'  },
            { icon: 'plate', color: C.caramel,  label: 'Кафе'      },
            { icon: 'bus',   color: C.yellow,   label: 'Транспорт' },
            { icon: 'pill',  color: C.rose,     label: 'Аптека'    },
            { icon: 'house', color: C.sage,     label: 'Дом'       },
          ].map((c) => (
            <button key={c.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px 7px 7px', borderRadius: 999,
              background: C.card, border: '1.5px solid ' + C.hairline,
              fontSize: 12.5, fontWeight: 800, color: C.fg, boxShadow: SHADOW.bubble,
            }}>
              <Sk icon={c.icon} color={c.color} size={20}/>
              {c.label}
            </button>
          ))}
        </div>
        <button style={{
          marginTop: 8, padding: '8px 14px', borderRadius: 999,
          background: 'transparent', border: '1.5px dashed ' + C.sub + '77',
          fontSize: 12, fontWeight: 800, color: C.sub,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          Все категории
        </button>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.sub, margin: '10px 0 0 2px' }}>
          подскажешь — запомню это слово навсегда
        </p>
      </div>

      <div style={{ height: 12 }}/>
    </ChatScreen>
  );
}

/* ─── 03. Воскресный отчёт ─── */
function ScreenWeekly() {
  return (
    <ChatScreen>
      <PinnedToday spent={60} total={200} day="воскресенье"/>

      <DateChip>Воскресенье · 19 мая · 21:00</DateChip>

      <BotBubble>Неделя закрыта 💫</BotBubble>

      <BotCardBubble wide>
        {/* Hero header with gradient + decorative blob */}
        <div style={{
          padding: '16px 18px 12px', color: 'white', position: 'relative', overflow: 'hidden',
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.rose} 100%)`,
        }}>
          <svg style={{ position: 'absolute', top: -40, right: -40, opacity: .25 }} width="160" height="160" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none"/>
            <circle cx="60" cy="60" r="42" stroke="white" strokeWidth="1" fill="none" opacity=".7"/>
          </svg>
          <p style={{ ...T.caption, opacity: .85, margin: 0 }}>Неделя 20 · 13–19 мая</p>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ ...T.display, fontSize: 26 }}>₪1 840</span>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: .85 }}>из ₪2 200</span>
          </div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.18)', padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800 }}>
            <Sk icon="piggy" color={C.yellow} size={16}/>
            Сэкономил ₪360 — переведём в Отпуск?
          </div>
        </div>

        {/* Envelopes */}
        <div style={{ padding: '10px 0 6px' }}>
          <p style={{ ...T.caption, color: C.sub, margin: '4px 14px 6px' }}>Конверты</p>
          <Envelope name="Продукты"    icon="cart"   color={C.primary}  spent={580} limit={600}/>
          <Envelope name="Кафе"        icon="plate"  color={C.caramel}  spent={205} limit={200}/>
          <Envelope name="Машина"      icon="car"    color={C.blueSoft} spent={240} limit={400}/>
          <Envelope name="Дом и счета" icon="house"  color={C.sage}     spent={520} limit={600}/>
          <Envelope name="Развлечения" icon="cinema" color={C.olive}    spent={95}  limit={200}/>
        </div>

        {/* Stat strip */}
        <div style={{ borderTop: '1px solid ' + C.hairline, padding: '10px 4px', display: 'flex', gap: 6 }}>
          {[
            { lab: 'Лучший день', val: 'Вс · ₪80',  color: C.sage },
            { lab: 'Тяжёлый день', val: 'Ср · ₪420', color: C.primary },
            { lab: 'Часто',       val: '☕ Кофе ×6', color: C.fg },
          ].map((s, i, arr) => (
            <React.Fragment key={s.lab}>
              <div style={{ flex: 1, padding: '0 8px' }}>
                <p style={{ ...T.caption, color: C.sub, margin: 0, fontSize: 9.5 }}>{s.lab}</p>
                <p style={{ fontSize: 12.5, fontWeight: 800, color: s.color, margin: '2px 0 0' }}>{s.val}</p>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, background: C.hairline }}/>}
            </React.Fragment>
          ))}
        </div>
      </BotCardBubble>

      <QuickReplies items={[
        { label: 'Отложить ₪360', icon: 'piggy', primary: true },
        { label: 'Поделиться 👨‍👩‍👦' },
      ]}/>

      <BotBubble>
        План на следующую неделю прежний? Или поправим конверт <b>Кафе</b> — он перебран на ₪5.
      </BotBubble>
      <QuickReplies items={[
        { label: 'Прежний' },
        { label: '+₪20 на Кафе' },
      ]}/>

      <div style={{ height: 12 }}/>
    </ChatScreen>
  );
}

/* ─── 04. Меню открыто ─── */
function ScreenMenuOpen() {
  return (
    <ChatScreen showMenu>
      <PinnedToday spent={75} total={200}/>
      <DateChip>Среда · 17 мая</DateChip>
      <BotBubble>Доброе утро ✨ На сегодня <b style={{ color: C.primary }}>₪140</b>.</BotBubble>
      <UserBubble time="11:42" status="saved">65 кофе</UserBubble>
      <BotBubble>✅ <b>₪65</b> → Кафе</BotBubble>
    </ChatScreen>
  );
}

Object.assign(window, { ChatScreen, ScreenMorning, ScreenClarify, ScreenWeekly, ScreenMenuOpen });
