/* Screens for the Family Budget UI kit demo.
   Exposes to window: HomeScreen, ExpensesScreen, AddExpenseScreen,
   StatsScreen, AnalyticsScreen, AccountScreen, AuthScreen */

const { useState } = React;

const CATEGORIES = [
  { id: 'food',      emoji: '🍽️', name: 'Food',          color: '#F97316' },
  { id: 'home',      emoji: '🏠', name: 'Home',          color: '#3B82F6' },
  { id: 'transport', emoji: '🚗', name: 'Transport',     color: '#8B5CF6' },
  { id: 'health',    emoji: '❤️', name: 'Health',        color: '#EC4899' },
  { id: 'shopping',  emoji: '🛍️', name: 'Shopping',      color: '#06B6D4' },
  { id: 'fun',       emoji: '🎬', name: 'Entertainment', color: '#EAB308' },
];

// ------------- AUTH -------------
const AuthScreen = ({ onSignIn }) => {
  const [email, setEmail] = useState('alex@family.app');
  const [pwd,   setPwd]   = useState('correcthorse');
  return (
    <div style={{padding: '60px 24px 40px', display:'flex', flexDirection:'column', gap: 18, minHeight: '100%'}}>
      <div style={{textAlign:'center', marginBottom: 24}}>
        <div style={{width: 64, height: 64, borderRadius: 18, background:'hsl(var(--primary))', margin: '0 auto', display:'flex', alignItems:'center', justifyContent:'center', boxShadow: '0 10px 28px hsl(221 83% 53% / .25)'}}>
          <span style={{color:'white', fontWeight: 800, fontSize: 28}}>B</span>
        </div>
        <div style={{fontSize: 24, fontWeight: 700, marginTop: 16}}>Welcome back</div>
        <div style={{fontSize: 14, color:'hsl(var(--muted-foreground))', marginTop: 4}}>Sign in to your family budget</div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap: 6}}>
        <div style={{fontSize: 13, fontWeight: 500}}>Email</div>
        <TextInput value={email} onChange={setEmail} placeholder="you@example.com"/>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap: 6}}>
        <div style={{fontSize: 13, fontWeight: 500}}>Password</div>
        <TextInput type="password" value={pwd} onChange={setPwd}/>
      </div>
      <PrimaryButton large onClick={onSignIn}>Sign In</PrimaryButton>
      <div style={{display:'flex', alignItems:'center', gap: 8, color:'hsl(var(--muted-foreground))', fontSize: 12, margin: '8px 0'}}>
        <div style={{flex:1, height: 1, background:'hsl(var(--border))'}}/>
        <span>or</span>
        <div style={{flex:1, height: 1, background:'hsl(var(--border))'}}/>
      </div>
      <SecondaryButton onClick={onSignIn}>Continue with Google</SecondaryButton>
      <div style={{textAlign:'center', fontSize: 13, color:'hsl(var(--muted-foreground))', marginTop: 8}}>
        Don't have an account? <span style={{color: 'hsl(var(--primary))', fontWeight: 500}}>Sign Up</span>
      </div>
    </div>
  );
};

// ------------- HOME -------------
const HomeScreen = ({ go }) => (
  <div style={{padding: '16px 16px 24px', display:'flex', flexDirection:'column', gap: 16}}>
    <MonthHero month="November 2026" balance={3420} income={8200} expenses={4780}/>
    <QuickActions onAddIncome={()=>go('add')} onAddExpense={()=>go('add')} onAddSavings={()=>go('add')}/>
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding: '4px 4px 8px'}}>
        <span style={{fontSize: 15, fontWeight: 600}}>Recent</span>
        <span onClick={()=>go('expenses')} style={{fontSize: 13, color:'hsl(var(--primary))', fontWeight: 500, cursor:'pointer'}}>See all</span>
      </div>
      <ListCard>
        <ExpenseRow emoji="🛒" color="#F97316" title="Shufersal" meta="Groceries · 💳" amount={148.50}/>
        <ExpenseRow emoji="☕" color="#D97706" title="Aroma" meta="Coffee · split 2 · 💵" amount={32}/>
        <ExpenseRow emoji="⛽" color="#7C3AED" title="Sonol" meta="Fuel · 💳 · 🔒" amount={120}/>
      </ListCard>
    </div>
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding: '4px 4px 8px'}}>
        <span style={{fontSize: 15, fontWeight: 600}}>🔄 Recurring</span>
        <span style={{fontSize: 12, color:'hsl(var(--muted-foreground))'}}>2 upcoming</span>
      </div>
      <ListCard>
        <ExpenseRow emoji="🏠" color="#3B82F6" title="Rent" meta="Due Nov 15 · monthly" amount={4200}/>
        <ExpenseRow emoji="📱" color="#06B6D4" title="Cellcom" meta="Due Nov 22 · monthly" amount={89}/>
      </ListCard>
    </div>
  </div>
);

// ------------- EXPENSES -------------
const ExpensesScreen = () => {
  const [tab, setTab]   = useState('exp');
  const [cat, setCat]   = useState('all');
  const chips = [{id:'all', label:'All', emoji: null}].concat(CATEGORIES.slice(0,4).map(c => ({id: c.id, label: c.name, emoji: c.emoji})));
  return (
    <div style={{padding: '16px 16px 24px', display:'flex', flexDirection:'column', gap: 14}}>
      <SegTabs value={tab} onChange={setTab} options={[{value:'exp', label:'Expenses'},{value:'inc', label:'Income'}]}/>
      <div style={{display:'flex', gap: 8, overflowX:'auto', paddingBottom: 4, margin: '-4px -16px 0', padding: '4px 16px'}}>
        {chips.map(c => <CategoryChip key={c.id} emoji={c.emoji} label={c.label} on={cat===c.id} onClick={()=>setCat(c.id)}/>)}
      </div>
      <Group title="Today" total={212.50}>
        <ExpenseRow emoji="🛒" color="#F97316" title="Shufersal"  meta="Groceries · 💳"             amount={148.50}/>
        <ExpenseRow emoji="☕" color="#D97706" title="Aroma"      meta="Coffee · split 2 · 💵"      amount={32}/>
        <ExpenseRow emoji="⛽" color="#7C3AED" title="Sonol"      meta="Fuel · 💳 · 🔒"             amount={32}/>
      </Group>
      <Group title="Yesterday" total={89}>
        <ExpenseRow emoji="🍔" color="#F97316" title="Burgers Bar" meta="Restaurants · 💳"          amount={89}/>
      </Group>
      <Group title="Wed, Nov 8" total={310}>
        <ExpenseRow emoji="💊" color="#EC4899" title="Super-Pharm" meta="Health · 💳"                amount={210}/>
        <ExpenseRow emoji="🎬" color="#EAB308" title="Yes Planet"  meta="Movies · 💳"                amount={100}/>
      </Group>
    </div>
  );
};

// ------------- ADD EXPENSE -------------
const AddExpenseScreen = ({ go }) => {
  const [amount, setAmount] = useState('');
  const [cat, setCat]       = useState('food');
  const [pay, setPay]       = useState('card');
  const [secret, setSecret] = useState(false);
  const [note, setNote]     = useState('');
  return (
    <div style={{padding: '16px 16px 24px', display:'flex', flexDirection:'column', gap: 14}}>
      <AmountInput value={amount} onChange={setAmount}/>
      <div>
        <div style={{fontSize: 13, fontWeight: 500, marginBottom: 8}}>Category</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 8}}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={()=>setCat(c.id)} style={{
              padding: '12px 6px', borderRadius: 12, cursor: 'pointer',
              border: '1px solid ' + (cat===c.id ? 'hsl(var(--primary))' : 'hsl(var(--border))'),
              background: cat===c.id ? 'hsl(var(--primary) / .1)' : 'hsl(var(--card))',
              color: cat===c.id ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
              display:'flex', flexDirection:'column', alignItems:'center', gap: 4,
              fontWeight: cat===c.id ? 600 : 400, fontSize: 12,
            }}>
              <span style={{fontSize: 22}}>{c.emoji}</span>{c.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{fontSize: 13, fontWeight: 500, marginBottom: 8}}>Payment method</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8}}>
          {[{id:'card',l:'💳 Card'},{id:'cash',l:'💵 Cash'},{id:'transfer',l:'🏦 Transfer'}].map(p => (
            <button key={p.id} onClick={()=>setPay(p.id)} style={{
              padding: '10px 6px', borderRadius: 12, cursor:'pointer',
              border: '1px solid ' + (pay===p.id ? 'hsl(var(--primary))' : 'hsl(var(--border))'),
              background: pay===p.id ? 'hsl(var(--primary) / .1)' : 'hsl(var(--card))',
              color: pay===p.id ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
              fontSize: 13, fontWeight: pay===p.id ? 600 : 400,
            }}>{p.l}</button>
          ))}
        </div>
      </div>
      <div>
        <div style={{fontSize: 13, fontWeight: 500, marginBottom: 6}}>Store / Place <span style={{color:'hsl(var(--muted-foreground))'}}>(optional)</span></div>
        <TextInput value={note} onChange={setNote} placeholder="Shufersal, Tel Aviv"/>
      </div>
      <label style={{display:'flex', alignItems:'center', gap: 10, padding: '12px 14px', background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius: 12, cursor:'pointer'}}>
        <input type="checkbox" checked={secret} onChange={e=>setSecret(e.target.checked)} style={{width: 18, height: 18, accentColor: 'hsl(var(--primary))'}}/>
        <div style={{flex:1}}>
          <div style={{fontSize: 14, fontWeight: 500}}>🔒 Secret expense</div>
          <div style={{fontSize: 12, color:'hsl(var(--muted-foreground))'}}>Hide from family members</div>
        </div>
      </label>
      <PrimaryButton large onClick={()=>go('expenses')}>Save Expense</PrimaryButton>
    </div>
  );
};

// ------------- STATS -------------
const StatsScreen = () => {
  // simple donut via conic-gradient
  const slices = [
    {color:'#F97316', pct: 38, label:'Food'},
    {color:'#3B82F6', pct: 25, label:'Home'},
    {color:'#8B5CF6', pct: 18, label:'Transport'},
    {color:'#06B6D4', pct: 11, label:'Shopping'},
    {color:'#6B7280', pct: 8,  label:'Other'},
  ];
  let acc = 0;
  const grad = slices.map(s => {
    const start = acc; acc += s.pct;
    return `${s.color} ${start}% ${acc}%`;
  }).join(', ');
  return (
    <div style={{padding: '16px 16px 24px', display:'flex', flexDirection:'column', gap: 14}}>
      <SegTabs value="month" onChange={()=>{}} options={[{value:'month', label:'This Month'},{value:'last', label:'Last Month'},{value:'3m', label:'3M'}]}/>
      <div style={{display:'flex', alignItems:'center', justifyContent:'center', padding: '16px 0'}}>
        <div style={{
          width: 180, height: 180, borderRadius: '50%',
          background: `conic-gradient(${grad})`,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{width:120, height: 120, borderRadius:'50%', background:'hsl(var(--background))', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
            <div style={{fontSize: 11, color:'hsl(var(--muted-foreground))'}}>Spent</div>
            <div style={{fontSize: 22, fontWeight: 700, fontVariantNumeric:'tabular-nums'}}>₪4,780</div>
          </div>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection:'column', gap: 10}}>
        <BudgetBar emoji="🍽️" color="#F97316" name="Food"      spent={1840} limit={1500}/>
        <BudgetBar emoji="🏠" color="#3B82F6" name="Home"      spent={1200} limit={1800}/>
        <BudgetBar emoji="🚗" color="#8B5CF6" name="Transport" spent={860}  limit={1000}/>
        <BudgetBar emoji="🛍️" color="#06B6D4" name="Shopping"  spent={540}  limit={800}/>
      </div>
    </div>
  );
};

// ------------- ANALYTICS -------------
const AnalyticsScreen = () => {
  const bars = [
    {m:'Jun', v: 70}, {m:'Jul', v: 84}, {m:'Aug', v: 62},
    {m:'Sep', v: 92}, {m:'Oct', v: 78}, {m:'Nov', v: 100},
  ];
  return (
    <div style={{padding: '16px 16px 24px', display:'flex', flexDirection:'column', gap: 14}}>
      <ListCard style={{padding: '16px'}}>
        <div style={{fontSize: 12, color:'hsl(var(--muted-foreground))', fontWeight: 600, textTransform:'uppercase', letterSpacing:'.04em'}}>Avg monthly spend</div>
        <div style={{fontSize: 28, fontWeight: 700, fontVariantNumeric:'tabular-nums', marginTop: 4}}>₪4,510</div>
        <div style={{fontSize: 12, color:'hsl(160 84% 39%)', marginTop: 4}}>↓ 8 % vs last 3 months</div>
      </ListCard>
      <div>
        <div style={{fontSize: 13, fontWeight: 600, marginBottom: 8, padding: '0 4px'}}>6-month trend</div>
        <ListCard style={{padding: 16}}>
          <div style={{display:'flex', alignItems:'flex-end', gap: 10, height: 130}}>
            {bars.map((b, i) => (
              <div key={i} style={{flex: 1, display:'flex', flexDirection:'column', alignItems:'center', gap: 6}}>
                <div style={{height: b.v + '%', width: '100%', background: i === bars.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / .25)', borderRadius: '4px 4px 0 0'}}/>
                <span style={{fontSize: 11, color:'hsl(var(--muted-foreground))'}}>{b.m}</span>
              </div>
            ))}
          </div>
        </ListCard>
      </div>
      <div>
        <div style={{fontSize: 13, fontWeight: 600, marginBottom: 8, padding: '0 4px'}}>🎯 Savings Goals</div>
        <div style={{display:'flex', flexDirection:'column', gap: 10}}>
          <SavingsGoal emoji="✈️" name="Trip to Greece" saved={4200} target={10000}/>
          <SavingsGoal emoji="💻" name="New Laptop"     saved={2800} target={7000}/>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { AuthScreen, HomeScreen, ExpensesScreen, AddExpenseScreen, StatsScreen, AnalyticsScreen, CATEGORIES });
