export interface StoreEntry {
  id: string;
  name: string;
  storeGroup: string;
  parentId: string;
  subId: string;
  /** true = ambiguous store (supermarket, amazon) — ask "what did you buy?" */
  needsContext: boolean;
  aliases: string[];
}

export const STORES: StoreEntry[] = [
  // ── Supermarkets ────────────────────────────────────────────────────────────
  {
    id: 'rami_levi', name: 'Рами Леви', storeGroup: 'supermarket',
    parentId: 'groceries', subId: 'supermarket', needsContext: true,
    aliases: ['рами леви', 'rami levi', 'רמי לוי'],
  },
  {
    id: 'shufersal', name: 'Шуферсал', storeGroup: 'supermarket',
    parentId: 'groceries', subId: 'supermarket', needsContext: true,
    aliases: ['шуферсал', 'шуперсаль', 'shufersal', 'שופרסל'],
  },
  {
    id: 'victory', name: 'Виктори', storeGroup: 'supermarket',
    parentId: 'groceries', subId: 'supermarket', needsContext: true,
    aliases: ['виктори', 'victory', 'ויקטורי'],
  },
  {
    id: 'yochananof', name: 'Йоханов', storeGroup: 'supermarket',
    parentId: 'groceries', subId: 'supermarket', needsContext: true,
    aliases: ['йоханов', 'йохананов', 'yochananof', 'יוחננוף'],
  },
  {
    id: 'osher_ad', name: 'Ошер Ад', storeGroup: 'supermarket',
    parentId: 'groceries', subId: 'supermarket', needsContext: true,
    aliases: ['ошер ад', 'osher ad', 'אושר עד'],
  },
  {
    id: 'am_pm', name: 'Am:Pm', storeGroup: 'supermarket',
    parentId: 'groceries', subId: 'supermarket', needsContext: true,
    aliases: ['am pm', 'am:pm', 'ампм'],
  },
  {
    id: 'yellow', name: 'Yellow', storeGroup: 'supermarket',
    parentId: 'groceries', subId: 'supermarket', needsContext: true,
    aliases: ['yellow', 'יילו'],
  },
  {
    id: 'dabbah', name: 'Даббах', storeGroup: 'supermarket',
    parentId: 'groceries', subId: 'supermarket', needsContext: true,
    aliases: ['даббах', 'dabbah', 'דבאח'],
  },

  // ── Pharmacy ────────────────────────────────────────────────────────────────
  {
    id: 'super_pharm', name: 'Super-Pharm', storeGroup: 'pharmacy',
    parentId: 'health', subId: 'medicine', needsContext: true,
    aliases: ['суперфарм', 'super-pharm', 'superpharm', 'super pharm'],
  },

  // ── Fast food ───────────────────────────────────────────────────────────────
  {
    id: 'mcdonalds', name: "McDonald's", storeGroup: 'fast_food',
    parentId: 'dining', subId: 'fast_food', needsContext: false,
    aliases: ['макдональдс', 'mcdonalds', 'mac donalds', 'макдак'],
  },
  {
    id: 'burger_king', name: 'Burger King', storeGroup: 'fast_food',
    parentId: 'dining', subId: 'fast_food', needsContext: false,
    aliases: ['бургер кинг', 'burger king'],
  },
  {
    id: 'kfc', name: 'KFC', storeGroup: 'fast_food',
    parentId: 'dining', subId: 'fast_food', needsContext: false,
    aliases: ['kfc', 'кфс'],
  },

  // ── Coffee ──────────────────────────────────────────────────────────────────
  {
    id: 'aroma', name: 'Aroma', storeGroup: 'coffee',
    parentId: 'dining', subId: 'coffee', needsContext: false,
    aliases: ['aroma', 'арома'],
  },
  {
    id: 'cofix', name: 'Cofix', storeGroup: 'coffee',
    parentId: 'dining', subId: 'coffee', needsContext: false,
    aliases: ['cofix', 'кофикс'],
  },

  // ── Delivery apps ───────────────────────────────────────────────────────────
  {
    id: 'wolt', name: 'Wolt', storeGroup: 'delivery',
    parentId: 'dining', subId: 'delivery', needsContext: false,
    aliases: ['wolt'],
  },
  {
    id: 'tenbis', name: 'Ten Bis', storeGroup: 'delivery',
    parentId: 'dining', subId: 'delivery', needsContext: false,
    aliases: ['tenbis', 'ten bis', 'тен бис'],
  },
  {
    id: 'bolt_food', name: 'Bolt Food', storeGroup: 'delivery',
    parentId: 'dining', subId: 'delivery', needsContext: false,
    aliases: ['bolt food'],
  },

  // ── Taxi ────────────────────────────────────────────────────────────────────
  {
    id: 'gett', name: 'Gett', storeGroup: 'taxi',
    parentId: 'transport', subId: 'taxi', needsContext: false,
    aliases: ['gett'],
  },
  {
    id: 'yango', name: 'Yango', storeGroup: 'taxi',
    parentId: 'transport', subId: 'taxi', needsContext: false,
    aliases: ['yango'],
  },
  {
    id: 'uber', name: 'Uber', storeGroup: 'taxi',
    parentId: 'transport', subId: 'taxi', needsContext: false,
    aliases: ['uber'],
  },

  // ── Fuel stations ───────────────────────────────────────────────────────────
  {
    id: 'sonol', name: 'Sonol', storeGroup: 'fuel',
    parentId: 'car', subId: 'fuel', needsContext: false,
    aliases: ['sonol', 'сонол'],
  },
  {
    id: 'delek', name: 'Delek', storeGroup: 'fuel',
    parentId: 'car', subId: 'fuel', needsContext: false,
    aliases: ['delek', 'дилек', 'דלק'],
  },
  {
    id: 'paz', name: 'Paz', storeGroup: 'fuel',
    parentId: 'car', subId: 'fuel', needsContext: false,
    aliases: ['paz', 'פז'],
  },
  {
    id: 'dor_alon', name: 'Dor Alon', storeGroup: 'fuel',
    parentId: 'car', subId: 'fuel', needsContext: false,
    aliases: ['dor alon', 'דור אלון'],
  },

  // ── Clothing brands ─────────────────────────────────────────────────────────
  {
    id: 'zara', name: 'Zara', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: false,
    aliases: ['zara', 'зара'],
  },
  {
    id: 'hm', name: 'H&M', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: false,
    aliases: ['h&m', 'hm'],
  },
  {
    id: 'nike', name: 'Nike', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: false,
    aliases: ['nike', 'найк'],
  },
  {
    id: 'adidas', name: 'Adidas', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: false,
    aliases: ['adidas', 'адидас'],
  },
  {
    id: 'pull_bear', name: 'Pull&Bear', storeGroup: 'fashion',
    parentId: 'shopping', subId: 'clothes', needsContext: false,
    aliases: ['pull&bear', 'pull bear'],
  },

  // ── Online retail ───────────────────────────────────────────────────────────
  {
    id: 'amazon', name: 'Amazon', storeGroup: 'online',
    parentId: 'shopping', subId: 'online', needsContext: true,
    aliases: ['amazon'],
  },
  {
    id: 'aliexpress', name: 'AliExpress', storeGroup: 'online',
    parentId: 'shopping', subId: 'online', needsContext: true,
    aliases: ['aliexpress'],
  },

  // ── Furniture ───────────────────────────────────────────────────────────────
  {
    id: 'ikea', name: 'IKEA', storeGroup: 'furniture',
    parentId: 'home', subId: 'furniture', needsContext: false,
    aliases: ['ikea', 'икеа'],
  },

  // ── Streaming / digital ─────────────────────────────────────────────────────
  {
    id: 'netflix', name: 'Netflix', storeGroup: 'streaming',
    parentId: 'digital', subId: 'streaming', needsContext: false,
    aliases: ['netflix'],
  },
  {
    id: 'spotify', name: 'Spotify', storeGroup: 'streaming',
    parentId: 'digital', subId: 'd_music', needsContext: false,
    aliases: ['spotify'],
  },
  {
    id: 'youtube_premium', name: 'YouTube Premium', storeGroup: 'streaming',
    parentId: 'digital', subId: 'streaming', needsContext: false,
    aliases: ['youtube premium', 'ютуб премиум'],
  },
  {
    id: 'apple_music', name: 'Apple Music', storeGroup: 'streaming',
    parentId: 'digital', subId: 'd_music', needsContext: false,
    aliases: ['apple music'],
  },
  {
    id: 'icloud', name: 'iCloud', storeGroup: 'cloud',
    parentId: 'digital', subId: 'cloud', needsContext: false,
    aliases: ['icloud'],
  },
  {
    id: 'google_one', name: 'Google One', storeGroup: 'cloud',
    parentId: 'digital', subId: 'cloud', needsContext: false,
    aliases: ['google one'],
  },
  {
    id: 'chatgpt', name: 'ChatGPT', storeGroup: 'subscriptions',
    parentId: 'digital', subId: 'subscriptions', needsContext: false,
    aliases: ['chatgpt', 'openai'],
  },
  {
    id: 'telegram_premium', name: 'Telegram Premium', storeGroup: 'subscriptions',
    parentId: 'digital', subId: 'subscriptions', needsContext: false,
    aliases: ['telegram premium'],
  },

  // ── Telecom ─────────────────────────────────────────────────────────────────
  {
    id: 'bezeq', name: 'Bezeq', storeGroup: 'internet',
    parentId: 'home', subId: 'internet', needsContext: false,
    aliases: ['bezeq', 'בזק'],
  },
  {
    id: 'cellcom', name: 'Cellcom', storeGroup: 'mobile',
    parentId: 'home', subId: 'mobile', needsContext: false,
    aliases: ['cellcom', 'סלקום'],
  },
  {
    id: 'partner', name: 'Partner', storeGroup: 'mobile',
    parentId: 'home', subId: 'mobile', needsContext: false,
    aliases: ['partner', 'פרטנר'],
  },

  // ── Travel ──────────────────────────────────────────────────────────────────
  {
    id: 'airbnb', name: 'Airbnb', storeGroup: 'accommodation',
    parentId: 'travel', subId: 'hotels', needsContext: false,
    aliases: ['airbnb'],
  },
  {
    id: 'booking', name: 'Booking.com', storeGroup: 'accommodation',
    parentId: 'travel', subId: 'hotels', needsContext: false,
    aliases: ['booking.com', 'booking'],
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
