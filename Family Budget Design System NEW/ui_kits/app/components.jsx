/* Components for the Family Budget UI kit.
   Exposes to window: Header, BottomNav, MonthHero, ExpenseRow, QuickActions,
   CategoryChip, SegTabs, BudgetBar, SavingsGoal, EmptyState, AmountInput,
   TextInput, PrimaryButton, SecondaryButton, ListCard, Group, DayHeading,
   useApp (state hook). */

const { useState, useMemo, createContext, useContext } = React;

// ---------- icons (inline lucide paths) ----------
const Ico = ({ d, size = 20, stroke = 2, fill = 'none', children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
       stroke="currentColor" strokeWidth={stroke}
       strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d ? <path d={d} /> : children}
  </svg>
);
const IPlus     = (p) => <Ico {...p}>{<><path d="M12 5v14"/><path d="M5 12h14"/></>}</Ico>;
const IList     = (p) => <Ico {...p}>{<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>}</Ico>;
const IBar      = (p) => <Ico {...p}>{<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6"  y1="20" x2="6"  y2="14"/></>}</Ico>;
const IBulb     = (p) => <Ico {...p}>{<><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/></>}</Ico>;
const IUser     = (p) => <Ico {...p}>{<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.66a9 9 0 0 1 10 0"/></>}</Ico>;
const IRepeat   = (p) => <Ico {...p}>{<><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></>}</Ico>;
const ICog      = (p) => <Ico {...p}>{<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>}</Ico>;
const ITrendUp  = (p) => <Ico {...p}>{<><path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></>}</Ico>;
const IPiggy    = (p) => <Ico {...p}>{<><path d="M19 5c-1.5 0-2.8 .4-4 1 -1.2-.6-2.5-1-4-1a7 7 0 0 0-7 7c0 4 3.5 6.5 6 8l1 1 1-1c2.5-1.5 6-4 6-8a7 7 0 0 0 1-7Z"/></>}</Ico>;
const IBack     = (p) => <Ico {...p}>{<><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></>}</Ico>;
const IChev     = (p) => <Ico {...p}><polyline points="9 18 15 12 9 6"/></Ico>;

// ---------- shared UI primitives ----------
const PrimaryButton = ({ children, onClick, large, style }) => (
  <button onClick={onClick}
    style={{
      background: 'hsl(var(--primary))', color: 'white',
      border: 0, borderRadius: 12,
      padding: large ? '14px 18px' : '12px 16px',
      fontSize: large ? 15 : 14, fontWeight: 600,
      width: '100%', cursor: 'pointer', transition: 'transform .1s',
      boxShadow: large ? '0 10px 24px hsl(221 83% 53% / .22)' : 'none',
      ...style,
    }}
    onMouseDown={e => e.currentTarget.style.transform = 'scale(.98)'}
    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
  >{children}</button>
);
const SecondaryButton = ({ children, onClick, style }) => (
  <button onClick={onClick}
    style={{
      background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 12, padding: '12px 16px',
      fontSize: 14, fontWeight: 500, width: '100%', cursor: 'pointer',
      ...style,
    }}
  >{children}</button>
);
const TextInput = ({ value, onChange, placeholder, type = 'text', style }) => {
  const [focused, setFocused] = useState(false);
  return (
    <input value={value} onChange={e => onChange?.(e.target.value)}
      type={type} placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
        border: '1px solid ' + (focused ? 'hsl(var(--primary))' : 'hsl(var(--border))'),
        borderRadius: 12, padding: '12px 14px',
        fontSize: 16, fontFamily: 'inherit', outline: 'none',
        boxShadow: focused ? '0 0 0 3px hsl(var(--primary) / .2)' : 'none',
        ...style,
      }}
    />
  );
};
const AmountInput = ({ value, currency = '₪', onChange }) => (
  <div style={{
    border: '1px solid hsl(var(--primary) / .25)',
    background: 'hsl(var(--primary) / .05)',
    borderRadius: 16, padding: '16px',
  }}>
    <div style={{fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase'}}>Amount</div>
    <div style={{display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6}}>
      <span style={{fontSize: 28, fontWeight: 700, color: 'hsl(var(--muted-foreground))'}}>{currency}</span>
      <input value={value} onChange={e => onChange?.(e.target.value)}
        placeholder="0.00"
        style={{
          border: 0, background: 'transparent', outline: 'none',
          fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: 'hsl(var(--foreground))', width: '100%', fontFamily: 'inherit',
        }}/>
    </div>
  </div>
);

// ---------- nav ----------
const Header = ({ family = true, title, back, onBack }) => (
  <div style={{
    position: 'sticky', top: 0, zIndex: 40,
    background: 'hsla(var(--background) / 0.85)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid hsl(var(--border))',
    padding: '0 16px', height: 56,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }}>
    {title ? (
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        {back && <button onClick={onBack} style={{border:0,background:'transparent',padding:6,marginLeft:-6,color:'hsl(var(--muted-foreground))',cursor:'pointer'}}><IBack size={20}/></button>}
        <span style={{fontSize: 17, fontWeight: 600}}>{title}</span>
      </div>
    ) : (
      <div style={{display:'flex',alignItems:'baseline',gap:8}}>
        <span style={{fontSize:18, fontWeight:700, color:'hsl(var(--primary))'}}>Budget</span>
        {family && <span style={{fontSize:12, color:'hsl(var(--muted-foreground))', fontWeight:500}}>Family</span>}
      </div>
    )}
    <div style={{display:'flex', gap: 2}}>
      {['user','repeat','cog'].map(k => (
        <div key={k} style={{
          width: 36, height: 36, borderRadius: 999, color: 'hsl(var(--muted-foreground))',
          display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'
        }}>
          {k==='user' ? <IUser size={20}/> : k==='repeat' ? <IRepeat size={20}/> : <ICog size={20}/>}
        </div>
      ))}
    </div>
  </div>
);

const BottomNav = ({ tab, setTab }) => {
  const items = [
    { id: 'expenses',  icon: IList, label: 'Expenses' },
    { id: 'stats',     icon: IBar,  label: 'Statistics' },
    { id: 'analytics', icon: IBulb, label: 'Analytics' },
  ];
  return (
    <div style={{
      position: 'sticky', bottom: 0,
      background: 'hsl(var(--background))',
      borderTop: '1px solid hsl(var(--border))',
      height: 70,
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
    }}>
      <button onClick={() => setTab('add')}
        style={{
          width: 56, height: 56, borderRadius: 9999, border: 0,
          background: 'hsl(var(--primary))', color: 'white',
          display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:'0 10px 24px hsl(221 83% 53% / .35)',
          cursor: 'pointer',
        }}>
        <IPlus size={26} stroke={2.5}/>
      </button>
      {items.map(({id, icon: I, label}) => (
        <button key={id} onClick={() => setTab(id)} style={{
          display:'flex', flexDirection:'column', alignItems:'center', gap:3,
          color: tab===id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
          border:0, background: 'transparent', padding: '4px 12px', cursor: 'pointer',
        }}>
          <I size={22}/>
          <span style={{fontSize:10, fontWeight:500}}>{label}</span>
        </button>
      ))}
    </div>
  );
};

// ---------- content blocks ----------
const MonthHero = ({ month, balance, income, expenses }) => (
  <div style={{
    background: 'hsl(var(--primary))', color: 'white',
    borderRadius: 16, padding: 20,
    boxShadow: '0 10px 28px hsl(221 83% 53% / .22)',
  }}>
    <div style={{fontSize: 13, opacity: .8, fontWeight: 500}}>{month}</div>
    <div style={{display:'flex', alignItems:'baseline', gap: 8, marginTop: 4}}>
      <span style={{fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums'}}>{balance >= 0 ? '+' : '−'}₪{Math.abs(balance).toLocaleString()}</span>
      <span style={{fontSize: 13, opacity: .7}}>balance</span>
    </div>
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16, marginTop: 16}}>
      <div><div style={{fontSize:12, opacity:.7}}>Income</div><div style={{fontSize:14, fontWeight:600, fontVariantNumeric:'tabular-nums', color:'#6EE7B7'}}>+₪{income.toLocaleString()}</div></div>
      <div style={{textAlign:'right'}}><div style={{fontSize:12, opacity:.7}}>Expenses</div><div style={{fontSize:14, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>−₪{expenses.toLocaleString()}</div></div>
    </div>
  </div>
);

const QuickActions = ({ onAddIncome, onAddExpense, onAddSavings }) => {
  const Btn = ({ bg, icon, label, onClick }) => (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection:'column', alignItems:'center', gap: 8,
      background:'transparent', border: 0, padding: 8, cursor:'pointer',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 9999,
        background: bg, color: 'white',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow: '0 6px 14px rgba(0,0,0,.08)',
      }}>{icon}</div>
      <span style={{fontSize: 11, fontWeight: 500, color: 'hsl(var(--muted-foreground))'}}>{label}</span>
    </button>
  );
  return (
    <div style={{display: 'flex', gap: 8}}>
      <Btn bg="hsl(160 84% 39%)" icon={<ITrendUp size={24} stroke={2.5}/>} label="Income" onClick={onAddIncome}/>
      <Btn bg="hsl(var(--primary))" icon={<IPlus size={24} stroke={2.5}/>} label="Expense" onClick={onAddExpense}/>
      <Btn bg="hsl(38 92% 50%)" icon={<IPiggy size={24} stroke={2.5}/>} label="Savings" onClick={onAddSavings}/>
    </div>
  );
};

const ListCard = ({ children, style }) => (
  <div style={{
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 16, overflow: 'hidden',
    ...style,
  }}>{children}</div>
);

const Group = ({ title, total, children }) => (
  <div>
    <div style={{
      display:'flex', justifyContent:'space-between',
      padding: '6px 4px',
      fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))',
      textTransform: 'uppercase', letterSpacing: '.04em',
    }}>
      <span>{title}</span>
      {total != null && <span style={{fontVariantNumeric:'tabular-nums'}}>−₪{total.toLocaleString()}</span>}
    </div>
    <ListCard>{children}</ListCard>
  </div>
);

const ExpenseRow = ({ emoji, color, title, meta, amount, sign='-', last }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px',
    borderTop: '1px solid hsl(var(--border))',
  }} className="row-borderless">
    <div style={{
      width: 40, height: 40, borderRadius: 12,
      background: color + '20', color: color,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: 18, flexShrink: 0,
    }}>{emoji}</div>
    <div style={{flex: 1, minWidth: 0}}>
      <div style={{fontSize: 14, fontWeight: 500, color: 'hsl(var(--foreground))'}}>{title}</div>
      {meta && <div style={{fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 2}}>{meta}</div>}
    </div>
    <div style={{
      fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
      color: sign === '+' ? 'hsl(160 84% 39%)' : 'hsl(var(--foreground))',
    }}>{sign}₪{Number(amount).toLocaleString()}</div>
  </div>
);

const CategoryChip = ({ emoji, label, color, on, onClick }) => (
  <button onClick={onClick} style={{
    border: 0, borderRadius: 999,
    padding: '6px 12px', fontSize: 12, fontWeight: 500,
    display:'inline-flex', alignItems:'center', gap: 6,
    background: on ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
    color: on ? 'white' : 'hsl(var(--muted-foreground))',
    whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
  }}>
    {emoji && <span>{emoji}</span>}{label}
  </button>
);

const SegTabs = ({ options, value, onChange }) => (
  <div style={{
    display:'flex', gap: 4, padding: 4,
    background: 'hsl(var(--muted))', borderRadius: 12,
  }}>
    {options.map(o => (
      <button key={o.value} onClick={() => onChange(o.value)} style={{
        flex: 1, padding: '8px 0', borderRadius: 8, border: 0,
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        background: value === o.value ? 'hsl(var(--card))' : 'transparent',
        color: value === o.value ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
        boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
      }}>{o.label}</button>
    ))}
  </div>
);

const BudgetBar = ({ emoji, color, name, spent, limit }) => {
  const pct = Math.min(100, (spent / limit) * 100);
  const over = spent > limit;
  const fillColor = over ? 'hsl(0 84% 60%)' : pct > 80 ? 'hsl(38 92% 50%)' : 'hsl(160 84% 39%)';
  return (
    <div style={{padding:'12px 14px', background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius: 16}}>
      <div style={{display:'flex', alignItems:'center', gap: 10, marginBottom: 8}}>
        <div style={{width:24, height:24, borderRadius:6, background: color+'20', color, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 12}}>{emoji}</div>
        <span style={{flex:1, fontSize: 14}}>{name}</span>
        <span style={{fontSize: 14, fontWeight: 600, fontVariantNumeric:'tabular-nums'}}>₪{spent.toLocaleString()}</span>
        {over && <span style={{background:'hsl(0 84% 60% / .12)', color:'hsl(0 84% 60%)', borderRadius:999, fontSize:11, padding:'2px 8px', fontWeight:600}}>⚠ Over</span>}
      </div>
      <div style={{height: 6, borderRadius: 999, background: 'hsl(var(--muted))', overflow: 'hidden'}}>
        <div style={{height:'100%', width: pct + '%', background: fillColor, borderRadius: 999}}></div>
      </div>
      <div style={{fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 6}}>Limit ₪{limit.toLocaleString()} · {Math.round((spent/limit)*100)} %</div>
    </div>
  );
};

const SavingsGoal = ({ emoji, name, saved, target }) => (
  <div style={{padding:'12px 14px', background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius: 16}}>
    <div style={{display:'flex', alignItems:'center', gap: 10, marginBottom: 8}}>
      <span style={{fontSize:18}}>{emoji}</span>
      <span style={{flex:1, fontSize: 14, fontWeight: 500}}>{name}</span>
      <span style={{fontSize: 12, color:'hsl(var(--muted-foreground))', fontVariantNumeric:'tabular-nums'}}>₪{saved.toLocaleString()} / ₪{target.toLocaleString()}</span>
    </div>
    <div style={{height: 6, borderRadius: 999, background: 'hsl(var(--muted))', overflow: 'hidden'}}>
      <div style={{height:'100%', width: Math.min(100, (saved/target)*100) + '%', background:'hsl(38 92% 50%)', borderRadius: 999}}></div>
    </div>
  </div>
);

const EmptyState = ({ emoji, title, hint }) => (
  <div style={{
    textAlign:'center', padding: '40px 16px',
    background:'hsl(var(--card))', border:'1px solid hsl(var(--border))',
    borderRadius: 16,
  }}>
    <div style={{fontSize: 32}}>{emoji}</div>
    <div style={{fontSize: 15, fontWeight: 500, marginTop: 8}}>{title}</div>
    {hint && <div style={{fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4}}>{hint}</div>}
  </div>
);

Object.assign(window, {
  Header, BottomNav, MonthHero, QuickActions, ListCard, Group, ExpenseRow,
  CategoryChip, SegTabs, BudgetBar, SavingsGoal, EmptyState,
  PrimaryButton, SecondaryButton, TextInput, AmountInput,
  IPlus, IList, IBar, IBulb, IUser, IRepeat, ICog, ITrendUp, IPiggy, IBack, IChev,
});
