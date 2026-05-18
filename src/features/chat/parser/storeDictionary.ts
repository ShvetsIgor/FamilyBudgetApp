export interface StoreEntry {
  id: string;
  name: string;
  storeGroup: string;
  /** Only set for self-describing stores (needsContext: false) */
  parentId?: string;
  /** Only set for self-describing stores (needsContext: false) */
  subId?: string;
  /** true = ambiguous store (supermarket, amazon, pharmacy) — always ask clarification */
  needsContext: boolean;
  aliases: string[];
}

export const STORES: StoreEntry[] = [
  // ── Supermarkets ────────────────────────────────────────────────────────────
  {
    id: 'rami_levi', name: 'Рами Леви', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['рами леви', 'rami levi', 'רמי לוי'],
  },
  {
    id: 'shufersal', name: 'Шуферсал', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['шуферсал', 'шуперсаль', 'shufersal', 'שופרסל'],
  },
  {
    id: 'victory', name: 'Виктори', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['виктори', 'victory', 'ויקטורי'],
  },
  {
    id: 'yochananof', name: 'Йоханов', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['йоханов', 'йохананов', 'yochananof', 'יוחננוף'],
  },
  {
    id: 'osher_ad', name: 'Ошер Ад', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['ошер ад', 'osher ad', 'אושר עד'],
  },
  {
    id: 'am_pm', name: 'Am:Pm', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['am pm', 'am:pm', 'ампм'],
  },
  {
    id: 'yellow', name: 'Yellow', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['yellow', 'יילו'],
  },
  {
    id: 'dabbah', name: 'Даббах', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['даббах', 'dabbah', 'דבאח'],
  },
  {
    id: 'stop_market', name: 'Stop Market', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['stop market', 'stopmarket', 'סטופ מרקט'],
  },
  {
    id: 'mahsanei_hashuk', name: 'Mahsanei HaShuk', storeGroup: 'supermarket',
    parentId: 'food', subId: 'groceries', needsContext: true,
    aliases: ['מחסני השוק', 'mahsanei hashuk'],
  },

  // ── Pharmacy ────────────────────────────────────────────────────────────────
  {
    id: 'super_pharm', name: 'Super-Pharm', storeGroup: 'pharmacy',
    parentId: 'health', subId: 'pharmacy', needsContext: true,
    aliases: ['суперфарм', 'super-pharm', 'superpharm', 'super pharm', 'סופר פארם'],
  },
  {
    id: 'new_pharm', name: 'New Pharm', storeGroup: 'pharmacy',
    parentId: 'health', subId: 'pharmacy', needsContext: true,
    aliases: ['new pharm', 'ניו פארם'],
  },
  {
    id: 'be_pharm', name: 'Be Pharm', storeGroup: 'pharmacy',
    parentId: 'health', subId: 'pharmacy', needsContext: true,
    aliases: ['be pharm', 'בי פארם'],
  },

  // ── Fast food ───────────────────────────────────────────────────────────────
  {
    id: 'mcdonalds', name: "McDonald's", storeGroup: 'fast_food',
    parentId: 'food', subId: 'fast_food', needsContext: false,
    aliases: ['макдональдс', 'mcdonalds', 'mac donalds', 'макдак', 'מקדונלדס'],
  },
  {
    id: 'burger_king', name: 'Burger King', storeGroup: 'fast_food',
    parentId: 'food', subId: 'fast_food', needsContext: false,
    aliases: ['бургер кинг', 'burger king', 'בורגר קינג'],
  },
  {
    id: 'kfc', name: 'KFC', storeGroup: 'fast_food',
    parentId: 'food', subId: 'fast_food', needsContext: false,
    aliases: ['kfc', 'кфс'],
  },
  {
    id: 'dominos', name: "Domino's", storeGroup: 'fast_food',
    parentId: 'food', subId: 'fast_food', needsContext: false,
    aliases: ['dominos', "domino's", 'доминос', 'דומינוס'],
  },

  // ── Coffee ──────────────────────────────────────────────────────────────────
  {
    id: 'aroma', name: 'Aroma', storeGroup: 'coffee',
    parentId: 'food', subId: 'coffee', needsContext: false,
    aliases: ['aroma', 'арома', 'ארומה'],
  },
  {
    id: 'cofix', name: 'Cofix', storeGroup: 'coffee',
    parentId: 'food', subId: 'coffee', needsContext: false,
    aliases: ['cofix', 'кофикс', 'קופיקס'],
  },
  {
    id: 'starbucks', name: 'Starbucks', storeGroup: 'coffee',
    parentId: 'food', subId: 'coffee', needsContext: false,
    aliases: ['starbucks', 'старбакс', 'סטארבקס'],
  },

  // ── Delivery apps ───────────────────────────────────────────────────────────
  {
    id: 'wolt', name: 'Wolt', storeGroup: 'delivery',
    parentId: 'food', subId: 'delivery', needsContext: false,
    aliases: ['wolt', 'וולט'],
  },
  {
    id: 'tenbis', name: 'Ten Bis', storeGroup: 'delivery',
    parentId: 'food', subId: 'delivery', needsContext: false,
    aliases: ['tenbis', 'ten bis', 'тен бис', 'טן ביס', '10bis'],
  },
  {
    id: 'bolt_food', name: 'Bolt Food', storeGroup: 'delivery',
    parentId: 'food', subId: 'delivery', needsContext: false,
    aliases: ['bolt food'],
  },
  {
    id: 'mishloha', name: 'Mishloha', storeGroup: 'delivery',
    parentId: 'food', subId: 'delivery', needsContext: false,
    aliases: ['mishloha', 'מישלוחה'],
  },

  // ── Taxi ────────────────────────────────────────────────────────────────────
  {
    id: 'gett', name: 'Gett', storeGroup: 'taxi',
    parentId: 'transport', subId: 'taxi', needsContext: false,
    aliases: ['gett', 'גט'],
  },
  {
    id: 'yango', name: 'Yango', storeGroup: 'taxi',
    parentId: 'transport', subId: 'taxi', needsContext: false,
    aliases: ['yango', 'янго'],
  },
  {
    id: 'uber', name: 'Uber', storeGroup: 'taxi',
    parentId: 'transport', subId: 'taxi', needsContext: false,
    aliases: ['uber', 'убер'],
  },
  {
    id: 'bolt_taxi', name: 'Bolt', storeGroup: 'taxi',
    parentId: 'transport', subId: 'taxi', needsContext: false,
    aliases: ['bolt taxi', 'bolt'],
  },

  // ── Fuel stations ───────────────────────────────────────────────────────────
  {
    id: 'sonol', name: 'Sonol', storeGroup: 'fuel_station',
    parentId: 'car', subId: 'fuel', needsContext: false,
    aliases: ['sonol', 'сонол', 'סונול'],
  },
  {
    id: 'delek', name: 'Delek', storeGroup: 'fuel_station',
    parentId: 'car', subId: 'fuel', needsContext: false,
    aliases: ['delek', 'дилек', 'דלק'],
  },
  {
    id: 'paz', name: 'Paz', storeGroup: 'fuel_station',
    parentId: 'car', subId: 'fuel', needsContext: false,
    aliases: ['paz', 'פז'],
  },
  {
    id: 'dor_alon', name: 'Dor Alon', storeGroup: 'fuel_station',
    parentId: 'car', subId: 'fuel', needsContext: false,
    aliases: ['dor alon', 'דור אלון'],
  },

  // ── Clothing brands ─────────────────────────────────────────────────────────
  {
    id: 'zara', name: 'Zara', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: false,
    aliases: ['zara', 'зара', 'זארה'],
  },
  {
    id: 'hm', name: 'H&M', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: false,
    aliases: ['h&m', 'hm', 'h & m'],
  },
  {
    id: 'nike', name: 'Nike', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'shoes', needsContext: false,
    aliases: ['nike', 'найк', 'נייק'],
  },
  {
    id: 'adidas', name: 'Adidas', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'shoes', needsContext: false,
    aliases: ['adidas', 'адидас', 'אדידס'],
  },
  {
    id: 'pull_bear', name: 'Pull&Bear', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: false,
    aliases: ['pull&bear', 'pull bear'],
  },
  {
    id: 'castro', name: 'Castro', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: false,
    aliases: ['castro', 'קסטרו'],
  },
  {
    id: 'fox', name: 'Fox', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: true,
    aliases: ['fox fashion', 'פוקס'],
  },

  // ── Online retail ───────────────────────────────────────────────────────────
  {
    id: 'amazon', name: 'Amazon', storeGroup: 'online_retail',
    parentId: 'shopping', subId: 'online_shopping', needsContext: true,
    aliases: ['amazon', 'амазон', 'אמזון'],
  },
  {
    id: 'aliexpress', name: 'AliExpress', storeGroup: 'online_retail',
    parentId: 'shopping', subId: 'online_shopping', needsContext: true,
    aliases: ['aliexpress', 'али', 'אליאקספרס'],
  },
  {
    id: 'ebay', name: 'eBay', storeGroup: 'online_retail',
    parentId: 'shopping', subId: 'online_shopping', needsContext: true,
    aliases: ['ebay', 'ибей', 'איביי'],
  },

  // ── Electronics stores ──────────────────────────────────────────────────────
  {
    id: 'bug', name: 'Bug', storeGroup: 'electronics_store',
    parentId: 'technology', subId: 'electronics', needsContext: true,
    aliases: ['bug', 'באג'],
  },
  {
    id: 'ivory', name: 'Ivory', storeGroup: 'electronics_store',
    parentId: 'technology', subId: 'electronics', needsContext: true,
    aliases: ['ivory', 'איבורי'],
  },
  {
    id: 'ksmart', name: 'KSmart', storeGroup: 'electronics_store',
    parentId: 'technology', subId: 'electronics', needsContext: true,
    aliases: ['ksmart', 'קסמארט'],
  },

  // ── Furniture ───────────────────────────────────────────────────────────────
  {
    id: 'ikea', name: 'IKEA', storeGroup: 'furniture_store',
    parentId: 'home', subId: 'furniture', needsContext: false,
    aliases: ['ikea', 'икеа', 'איקאה'],
  },
  {
    id: 'kika', name: 'Kika', storeGroup: 'furniture_store',
    parentId: 'home', subId: 'furniture', needsContext: true,
    aliases: ['kika', 'кика', 'קיקה'],
  },

  // ── Home improvement ────────────────────────────────────────────────────────
  {
    id: 'ace', name: 'ACE', storeGroup: 'home_improvement',
    parentId: 'home', subId: 'tools', needsContext: true,
    aliases: ['ace', 'эйс', 'אייס'],
  },
  {
    id: 'obi', name: 'OBI', storeGroup: 'home_improvement',
    parentId: 'home', subId: 'tools', needsContext: true,
    aliases: ['obi', 'оби'],
  },

  // ── Streaming / Subscriptions ───────────────────────────────────────────────
  {
    id: 'netflix', name: 'Netflix', storeGroup: 'streaming',
    parentId: 'subscriptions', subId: 'streaming', needsContext: false,
    aliases: ['netflix', 'нетфликс', 'נטפליקס'],
  },
  {
    id: 'spotify', name: 'Spotify', storeGroup: 'streaming',
    parentId: 'subscriptions', subId: 'music_sub', needsContext: false,
    aliases: ['spotify', 'спотифай', 'ספוטיפיי'],
  },
  {
    id: 'youtube_premium', name: 'YouTube Premium', storeGroup: 'streaming',
    parentId: 'subscriptions', subId: 'streaming', needsContext: false,
    aliases: ['youtube premium', 'ютуб премиум'],
  },
  {
    id: 'apple_music', name: 'Apple Music', storeGroup: 'streaming',
    parentId: 'subscriptions', subId: 'music_sub', needsContext: false,
    aliases: ['apple music'],
  },
  {
    id: 'apple_tv', name: 'Apple TV+', storeGroup: 'streaming',
    parentId: 'subscriptions', subId: 'streaming', needsContext: false,
    aliases: ['apple tv', 'apple tv+'],
  },
  {
    id: 'disney', name: 'Disney+', storeGroup: 'streaming',
    parentId: 'subscriptions', subId: 'streaming', needsContext: false,
    aliases: ['disney+', 'disney plus', 'диснейплюс'],
  },
  {
    id: 'icloud', name: 'iCloud', storeGroup: 'cloud',
    parentId: 'subscriptions', subId: 'cloud_storage', needsContext: false,
    aliases: ['icloud', 'айклауд'],
  },
  {
    id: 'google_one', name: 'Google One', storeGroup: 'cloud',
    parentId: 'subscriptions', subId: 'cloud_storage', needsContext: false,
    aliases: ['google one'],
  },
  {
    id: 'chatgpt', name: 'ChatGPT', storeGroup: 'software',
    parentId: 'subscriptions', subId: 'software_sub', needsContext: false,
    aliases: ['chatgpt', 'openai', 'chat gpt'],
  },
  {
    id: 'telegram_premium', name: 'Telegram Premium', storeGroup: 'software',
    parentId: 'subscriptions', subId: 'software_sub', needsContext: false,
    aliases: ['telegram premium', 'телеграм премиум'],
  },
  {
    id: 'claude', name: 'Claude', storeGroup: 'software',
    parentId: 'subscriptions', subId: 'software_sub', needsContext: false,
    aliases: ['claude', 'anthropic', 'клод'],
  },

  // ── Telecom ─────────────────────────────────────────────────────────────────
  {
    id: 'bezeq', name: 'Bezeq', storeGroup: 'internet_provider',
    parentId: 'home', subId: 'internet', needsContext: false,
    aliases: ['bezeq', 'безек', 'בזק'],
  },
  {
    id: 'hot', name: 'HOT', storeGroup: 'internet_provider',
    parentId: 'home', subId: 'internet', needsContext: false,
    aliases: ['hot mobile', 'hot net', 'הוט'],
  },
  {
    id: 'cellcom', name: 'Cellcom', storeGroup: 'mobile_carrier',
    parentId: 'home', subId: 'mobile_bill', needsContext: false,
    aliases: ['cellcom', 'сэлком', 'סלקום'],
  },
  {
    id: 'partner', name: 'Partner', storeGroup: 'mobile_carrier',
    parentId: 'home', subId: 'mobile_bill', needsContext: false,
    aliases: ['partner', 'פרטנר'],
  },
  {
    id: 'pelephone', name: 'Pelephone', storeGroup: 'mobile_carrier',
    parentId: 'home', subId: 'mobile_bill', needsContext: false,
    aliases: ['pelephone', 'פלאפון'],
  },
  {
    id: 'hot_mobile', name: 'HOT Mobile', storeGroup: 'mobile_carrier',
    parentId: 'home', subId: 'mobile_bill', needsContext: false,
    aliases: ['hot mobile', 'הוט מובייל'],
  },
  {
    id: '012_mobile', name: '012 Mobile', storeGroup: 'mobile_carrier',
    parentId: 'home', subId: 'mobile_bill', needsContext: false,
    aliases: ['012', '012 mobile'],
  },

  // ── Travel ──────────────────────────────────────────────────────────────────
  {
    id: 'airbnb', name: 'Airbnb', storeGroup: 'accommodation',
    parentId: 'travel', subId: 'hotels', needsContext: false,
    aliases: ['airbnb', 'эирбнб', 'אירבנב'],
  },
  {
    id: 'booking', name: 'Booking.com', storeGroup: 'accommodation',
    parentId: 'travel', subId: 'hotels', needsContext: false,
    aliases: ['booking.com', 'booking', 'букинг'],
  },
  {
    id: 'elal', name: 'El Al', storeGroup: 'airline',
    parentId: 'travel', subId: 'flights', needsContext: false,
    aliases: ['el al', 'elal', 'אל על'],
  },
  {
    id: 'ryanair', name: 'Ryanair', storeGroup: 'airline',
    parentId: 'travel', subId: 'flights', needsContext: false,
    aliases: ['ryanair', 'райанэйр'],
  },
  {
    id: 'wizzair', name: 'Wizz Air', storeGroup: 'airline',
    parentId: 'travel', subId: 'flights', needsContext: false,
    aliases: ['wizz air', 'wizzair', 'виззэйр'],
  },
];

// Build sorted alias → store map (longest alias first for greedy match)
const _sorted = STORES
  .flatMap((s) => s.aliases.map((a) => [a, s] as [string, StoreEntry]))
  .sort((a, b) => b[0].length - a[0].length);

export interface StoreMatch {
  id: string;
  name: string;
  storeGroup: string;
  parentId: string;
  subId: string;
  needsContext: boolean;
  keyword: string;
}

export function matchStore(text: string): StoreMatch | null {
  for (const [alias, store] of _sorted) {
    if (text.includes(alias)) {
      return {
        id: store.id, name: store.name, storeGroup: store.storeGroup,
        parentId: store.parentId, subId: store.subId,
        needsContext: store.needsContext, keyword: alias,
      };
    }
  }
  return null;
}
