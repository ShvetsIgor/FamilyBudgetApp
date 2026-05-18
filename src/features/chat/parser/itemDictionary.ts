export interface ItemEntry {
  parentId: string;
  subId: string;
}

export const ITEMS: Record<string, ItemEntry> = {
  // ── Groceries ────────────────────────────────────────────────────────────────

  // Bread & bakery
  'хлеб':          { parentId: 'groceries', subId: 'supermarket' },
  'батон':         { parentId: 'groceries', subId: 'supermarket' },
  'булка':         { parentId: 'groceries', subId: 'supermarket' },
  'лаваш':         { parentId: 'groceries', subId: 'supermarket' },
  'пита':          { parentId: 'groceries', subId: 'supermarket' },
  'bread':         { parentId: 'groceries', subId: 'supermarket' },
  'pita':          { parentId: 'groceries', subId: 'supermarket' },

  // Dairy
  'молоко':        { parentId: 'groceries', subId: 'supermarket' },
  'сыр':           { parentId: 'groceries', subId: 'supermarket' },
  'творог':        { parentId: 'groceries', subId: 'supermarket' },
  'йогурт':        { parentId: 'groceries', subId: 'supermarket' },
  'кефир':         { parentId: 'groceries', subId: 'supermarket' },
  'масло':         { parentId: 'groceries', subId: 'supermarket' },
  'milk':          { parentId: 'groceries', subId: 'supermarket' },
  'cheese':        { parentId: 'groceries', subId: 'supermarket' },
  'butter':        { parentId: 'groceries', subId: 'supermarket' },
  'yogurt':        { parentId: 'groceries', subId: 'supermarket' },

  // Eggs & meat
  'яйца':          { parentId: 'groceries', subId: 'supermarket' },
  'курица':        { parentId: 'groceries', subId: 'supermarket' },
  'говядина':      { parentId: 'groceries', subId: 'supermarket' },
  'фарш':          { parentId: 'groceries', subId: 'supermarket' },
  'рыба':          { parentId: 'groceries', subId: 'supermarket' },
  'лосось':        { parentId: 'groceries', subId: 'supermarket' },
  'тунец':         { parentId: 'groceries', subId: 'supermarket' },
  'eggs':          { parentId: 'groceries', subId: 'supermarket' },
  'chicken':       { parentId: 'groceries', subId: 'supermarket' },
  'beef':          { parentId: 'groceries', subId: 'supermarket' },
  'salmon':        { parentId: 'groceries', subId: 'supermarket' },
  'tuna':          { parentId: 'groceries', subId: 'supermarket' },

  // Fruits & vegetables
  'банан':         { parentId: 'groceries', subId: 'supermarket' },
  'яблоко':        { parentId: 'groceries', subId: 'supermarket' },
  'апельсин':      { parentId: 'groceries', subId: 'supermarket' },
  'мандарины':     { parentId: 'groceries', subId: 'supermarket' },
  'огурцы':        { parentId: 'groceries', subId: 'supermarket' },
  'помидоры':      { parentId: 'groceries', subId: 'supermarket' },
  'картошка':      { parentId: 'groceries', subId: 'supermarket' },
  'лук':           { parentId: 'groceries', subId: 'supermarket' },
  'чеснок':        { parentId: 'groceries', subId: 'supermarket' },
  'овощи':         { parentId: 'groceries', subId: 'supermarket' },
  'фрукты':        { parentId: 'groceries', subId: 'supermarket' },
  'banana':        { parentId: 'groceries', subId: 'supermarket' },
  'apple':         { parentId: 'groceries', subId: 'supermarket' },
  'tomatoes':      { parentId: 'groceries', subId: 'supermarket' },
  'vegetables':    { parentId: 'groceries', subId: 'supermarket' },
  'fruits':        { parentId: 'groceries', subId: 'supermarket' },

  // Dry goods & drinks
  'рис':           { parentId: 'groceries', subId: 'supermarket' },
  'гречка':        { parentId: 'groceries', subId: 'supermarket' },
  'макароны':      { parentId: 'groceries', subId: 'supermarket' },
  'спагетти':      { parentId: 'groceries', subId: 'supermarket' },
  'кола':          { parentId: 'groceries', subId: 'supermarket' },
  'кока кола':     { parentId: 'groceries', subId: 'supermarket' },
  'сок':           { parentId: 'groceries', subId: 'supermarket' },
  'энергетик':     { parentId: 'groceries', subId: 'supermarket' },
  'чипсы':         { parentId: 'groceries', subId: 'supermarket' },
  'шоколад':       { parentId: 'groceries', subId: 'supermarket' },
  'печенье':       { parentId: 'groceries', subId: 'supermarket' },
  'чай':           { parentId: 'groceries', subId: 'supermarket' },
  'rice':          { parentId: 'groceries', subId: 'supermarket' },
  'pasta':         { parentId: 'groceries', subId: 'supermarket' },
  'juice':         { parentId: 'groceries', subId: 'supermarket' },
  'chocolate':     { parentId: 'groceries', subId: 'supermarket' },
  'tea':           { parentId: 'groceries', subId: 'supermarket' },

  // Generic
  'продукты':      { parentId: 'groceries', subId: 'supermarket' },
  'groceries':     { parentId: 'groceries', subId: 'supermarket' },
  'grocery':       { parentId: 'groceries', subId: 'supermarket' },

  // Alcohol
  'вино':          { parentId: 'groceries', subId: 'alcohol' },
  'пиво':          { parentId: 'groceries', subId: 'alcohol' },
  'алкоголь':      { parentId: 'groceries', subId: 'alcohol' },
  'виски':         { parentId: 'groceries', subId: 'alcohol' },
  'wine':          { parentId: 'groceries', subId: 'alcohol' },
  'beer':          { parentId: 'groceries', subId: 'alcohol' },
  'alcohol':       { parentId: 'groceries', subId: 'alcohol' },
  'whiskey':       { parentId: 'groceries', subId: 'alcohol' },

  // Household chemicals
  'химия':         { parentId: 'groceries', subId: 'household_chem' },
  'мыло':          { parentId: 'groceries', subId: 'household_chem' },
  'шампунь':       { parentId: 'groceries', subId: 'household_chem' },
  'soap':          { parentId: 'groceries', subId: 'household_chem' },
  'shampoo':       { parentId: 'groceries', subId: 'household_chem' },
  'detergent':     { parentId: 'groceries', subId: 'household_chem' },

  // ── Dining ───────────────────────────────────────────────────────────────────

  'кофе':          { parentId: 'dining', subId: 'coffee' },
  'капучино':      { parentId: 'dining', subId: 'coffee' },
  'латте':         { parentId: 'dining', subId: 'coffee' },
  'эспрессо':      { parentId: 'dining', subId: 'coffee' },
  'coffee':        { parentId: 'dining', subId: 'coffee' },
  'americano':     { parentId: 'dining', subId: 'coffee' },
  'cappuccino':    { parentId: 'dining', subId: 'coffee' },
  'latte':         { parentId: 'dining', subId: 'coffee' },
  'espresso':      { parentId: 'dining', subId: 'coffee' },

  'пицца':         { parentId: 'dining', subId: 'fast_food' },
  'бургер':        { parentId: 'dining', subId: 'fast_food' },
  'шаурма':        { parentId: 'dining', subId: 'fast_food' },
  'шаверма':       { parentId: 'dining', subId: 'fast_food' },
  'фалафель':      { parentId: 'dining', subId: 'fast_food' },
  'донер':         { parentId: 'dining', subId: 'fast_food' },
  'pizza':         { parentId: 'dining', subId: 'fast_food' },
  'burger':        { parentId: 'dining', subId: 'fast_food' },
  'shawarma':      { parentId: 'dining', subId: 'fast_food' },
  'falafel':       { parentId: 'dining', subId: 'fast_food' },
  'doner':         { parentId: 'dining', subId: 'fast_food' },

  'суши':          { parentId: 'dining', subId: 'restaurants' },
  'роллы':         { parentId: 'dining', subId: 'restaurants' },
  'обед':          { parentId: 'dining', subId: 'restaurants' },
  'ужин':          { parentId: 'dining', subId: 'restaurants' },
  'завтрак':       { parentId: 'dining', subId: 'restaurants' },
  'sushi':         { parentId: 'dining', subId: 'restaurants' },
  'lunch':         { parentId: 'dining', subId: 'restaurants' },
  'dinner':        { parentId: 'dining', subId: 'restaurants' },
  'breakfast':     { parentId: 'dining', subId: 'restaurants' },

  'доставка':      { parentId: 'dining', subId: 'delivery' },
  'delivery':      { parentId: 'dining', subId: 'delivery' },

  'мороженое':     { parentId: 'dining', subId: 'snacks' },
  'десерт':        { parentId: 'dining', subId: 'snacks' },
  'снэк':          { parentId: 'dining', subId: 'snacks' },
  'ice cream':     { parentId: 'dining', subId: 'snacks' },
  'dessert':       { parentId: 'dining', subId: 'snacks' },
  'snack':         { parentId: 'dining', subId: 'snacks' },

  // ── Transport ────────────────────────────────────────────────────────────────

  'такси':         { parentId: 'transport', subId: 'taxi' },
  'taxi':          { parentId: 'transport', subId: 'taxi' },
  'автобус':       { parentId: 'transport', subId: 'public' },
  'метро':         { parentId: 'transport', subId: 'public' },
  'проезд':        { parentId: 'transport', subId: 'public' },
  'bus':           { parentId: 'transport', subId: 'public' },
  'metro':         { parentId: 'transport', subId: 'public' },
  'поезд':         { parentId: 'transport', subId: 'train' },
  'электричка':    { parentId: 'transport', subId: 'train' },
  'train':         { parentId: 'transport', subId: 'train' },
  'проездной':     { parentId: 'transport', subId: 'bus_pass' },
  'рав кав':       { parentId: 'transport', subId: 'bus_pass' },
  'rav kav':       { parentId: 'transport', subId: 'bus_pass' },
  'bus pass':      { parentId: 'transport', subId: 'bus_pass' },

  // ── Car ──────────────────────────────────────────────────────────────────────

  'бензин':        { parentId: 'car', subId: 'fuel' },
  'топливо':       { parentId: 'car', subId: 'fuel' },
  'дизель':        { parentId: 'car', subId: 'fuel' },
  'заправка':      { parentId: 'car', subId: 'fuel' },
  'fuel':          { parentId: 'car', subId: 'fuel' },
  'petrol':        { parentId: 'car', subId: 'fuel' },
  'diesel':        { parentId: 'car', subId: 'fuel' },
  'gas station':   { parentId: 'car', subId: 'fuel' },
  'парковка':      { parentId: 'car', subId: 'parking' },
  'parking':       { parentId: 'car', subId: 'parking' },
  'шины':          { parentId: 'car', subId: 'maintenance' },
  'резина':        { parentId: 'car', subId: 'maintenance' },
  'tires':         { parentId: 'car', subId: 'maintenance' },
  'мойка':         { parentId: 'car', subId: 'car_wash' },
  'car wash':      { parentId: 'car', subId: 'car_wash' },

  // ── Health ───────────────────────────────────────────────────────────────────

  'таблетки':      { parentId: 'health', subId: 'medicine' },
  'лекарства':     { parentId: 'health', subId: 'medicine' },
  'лекарство':     { parentId: 'health', subId: 'medicine' },
  'витамины':      { parentId: 'health', subId: 'medicine' },
  'medicine':      { parentId: 'health', subId: 'medicine' },
  'vitamins':      { parentId: 'health', subId: 'medicine' },
  'pharmacy':      { parentId: 'health', subId: 'medicine' },
  'врач':          { parentId: 'health', subId: 'doctors' },
  'доктор':        { parentId: 'health', subId: 'doctors' },
  'клиника':       { parentId: 'health', subId: 'doctors' },
  'анализы':       { parentId: 'health', subId: 'doctors' },
  'doctor':        { parentId: 'health', subId: 'doctors' },
  'clinic':        { parentId: 'health', subId: 'doctors' },
  'стоматолог':    { parentId: 'health', subId: 'dentist' },
  'дантист':       { parentId: 'health', subId: 'dentist' },
  'зубы':          { parentId: 'health', subId: 'dentist' },
  'dentist':       { parentId: 'health', subId: 'dentist' },
  'спортзал':      { parentId: 'health', subId: 'fitness' },
  'фитнес':        { parentId: 'health', subId: 'fitness' },
  'тренировка':    { parentId: 'health', subId: 'fitness' },
  'абонемент':     { parentId: 'health', subId: 'fitness' },
  'gym':           { parentId: 'health', subId: 'fitness' },
  'fitness':       { parentId: 'health', subId: 'fitness' },
  'workout':       { parentId: 'health', subId: 'fitness' },

  // ── Home & bills ─────────────────────────────────────────────────────────────

  'аренда':        { parentId: 'home', subId: 'rent' },
  'квартплата':    { parentId: 'home', subId: 'rent' },
  'квартира':      { parentId: 'home', subId: 'rent' },
  'съем':          { parentId: 'home', subId: 'rent' },
  'rent':          { parentId: 'home', subId: 'rent' },
  'ипотека':       { parentId: 'home', subId: 'mortgage' },
  'mortgage':      { parentId: 'home', subId: 'mortgage' },
  'электричество': { parentId: 'home', subId: 'electricity' },
  'свет':          { parentId: 'home', subId: 'electricity' },
  'electricity':   { parentId: 'home', subId: 'electricity' },
  'вода':          { parentId: 'home', subId: 'water' },
  'газ':           { parentId: 'home', subId: 'electricity' },
  'интернет':      { parentId: 'home', subId: 'internet' },
  'wifi':          { parentId: 'home', subId: 'internet' },
  'internet':      { parentId: 'home', subId: 'internet' },
  'арнона':        { parentId: 'home', subId: 'arnona' },
  'arnona':        { parentId: 'home', subId: 'arnona' },
  'ваад':          { parentId: 'home', subId: 'committee' },
  'ремонт':        { parentId: 'home', subId: 'repairs' },
  'repairs':       { parentId: 'home', subId: 'repairs' },
  'renovation':    { parentId: 'home', subId: 'repairs' },
  'мебель':        { parentId: 'home', subId: 'furniture' },
  'диван':         { parentId: 'home', subId: 'furniture' },
  'кровать':       { parentId: 'home', subId: 'furniture' },
  'furniture':     { parentId: 'home', subId: 'furniture' },
  'посуда':        { parentId: 'home', subId: 'home_purch' },
  'кастрюля':      { parentId: 'home', subId: 'home_purch' },

  // ── Shopping ─────────────────────────────────────────────────────────────────

  'одежда':        { parentId: 'shopping', subId: 'clothes' },
  'шмотки':        { parentId: 'shopping', subId: 'clothes' },
  'футболка':      { parentId: 'shopping', subId: 'clothes' },
  'майка':         { parentId: 'shopping', subId: 'clothes' },
  'рубашка':       { parentId: 'shopping', subId: 'clothes' },
  'штаны':         { parentId: 'shopping', subId: 'clothes' },
  'джинсы':        { parentId: 'shopping', subId: 'clothes' },
  'шорты':         { parentId: 'shopping', subId: 'clothes' },
  'куртка':        { parentId: 'shopping', subId: 'clothes' },
  'носки':         { parentId: 'shopping', subId: 'clothes' },
  'белье':         { parentId: 'shopping', subId: 'clothes' },
  'трусы':         { parentId: 'shopping', subId: 'clothes' },
  'платье':        { parentId: 'shopping', subId: 'clothes' },
  'юбка':          { parentId: 'shopping', subId: 'clothes' },
  'кроссовки':     { parentId: 'shopping', subId: 'clothes' },
  'ботинки':       { parentId: 'shopping', subId: 'clothes' },
  'туфли':         { parentId: 'shopping', subId: 'clothes' },
  'сандалии':      { parentId: 'shopping', subId: 'clothes' },
  'рюкзак':        { parentId: 'shopping', subId: 'clothes' },
  'сумка':         { parentId: 'shopping', subId: 'clothes' },
  'clothes':       { parentId: 'shopping', subId: 'clothes' },
  'dress':         { parentId: 'shopping', subId: 'clothes' },
  'shirt':         { parentId: 'shopping', subId: 'clothes' },
  'jeans':         { parentId: 'shopping', subId: 'clothes' },
  'jacket':        { parentId: 'shopping', subId: 'clothes' },
  'shoes':         { parentId: 'shopping', subId: 'clothes' },
  'sneakers':      { parentId: 'shopping', subId: 'clothes' },
  'backpack':      { parentId: 'shopping', subId: 'clothes' },

  'электроника':   { parentId: 'shopping', subId: 'electronics' },
  'телефон':       { parentId: 'shopping', subId: 'electronics' },
  'смартфон':      { parentId: 'shopping', subId: 'electronics' },
  'айфон':         { parentId: 'shopping', subId: 'electronics' },
  'ноутбук':       { parentId: 'shopping', subId: 'electronics' },
  'наушники':      { parentId: 'shopping', subId: 'electronics' },
  'мышка':         { parentId: 'shopping', subId: 'electronics' },
  'клавиатура':    { parentId: 'shopping', subId: 'electronics' },
  'зарядка':       { parentId: 'shopping', subId: 'electronics' },
  'iphone':        { parentId: 'shopping', subId: 'electronics' },
  'macbook':       { parentId: 'shopping', subId: 'electronics' },
  'airpods':       { parentId: 'shopping', subId: 'electronics' },
  'phone':         { parentId: 'shopping', subId: 'electronics' },
  'laptop':        { parentId: 'shopping', subId: 'electronics' },
  'headphones':    { parentId: 'shopping', subId: 'electronics' },
  'electronics':   { parentId: 'shopping', subId: 'electronics' },
  'charger':       { parentId: 'shopping', subId: 'electronics' },

  'косметика':     { parentId: 'shopping', subId: 'cosmetics' },
  'крем':          { parentId: 'shopping', subId: 'cosmetics' },
  'духи':          { parentId: 'shopping', subId: 'cosmetics' },
  'cosmetics':     { parentId: 'shopping', subId: 'cosmetics' },
  'perfume':       { parentId: 'shopping', subId: 'cosmetics' },
  'makeup':        { parentId: 'shopping', subId: 'cosmetics' },

  // ── Kids ─────────────────────────────────────────────────────────────────────

  'садик':         { parentId: 'kids', subId: 'school' },
  'детский сад':   { parentId: 'kids', subId: 'school' },
  'школа':         { parentId: 'kids', subId: 'school' },
  'kindergarten':  { parentId: 'kids', subId: 'school' },
  'school':        { parentId: 'kids', subId: 'school' },
  'репетитор':     { parentId: 'kids', subId: 'tutoring' },
  'tutor':         { parentId: 'kids', subId: 'tutoring' },
  'кружок':        { parentId: 'kids', subId: 'activities' },
  'секция':        { parentId: 'kids', subId: 'activities' },
  'activities':    { parentId: 'kids', subId: 'activities' },
  'игрушки':       { parentId: 'kids', subId: 'toys' },
  'toys':          { parentId: 'kids', subId: 'toys' },

  // ── Gifts ────────────────────────────────────────────────────────────────────

  'подарок':       { parentId: 'gifts', subId: 'birthdays' },
  'подарки':       { parentId: 'gifts', subId: 'birthdays' },
  'gift':          { parentId: 'gifts', subId: 'birthdays' },
  'present':       { parentId: 'gifts', subId: 'birthdays' },
  'благотворит':   { parentId: 'gifts', subId: 'charity' },
  'charity':       { parentId: 'gifts', subId: 'charity' },
  'donation':      { parentId: 'gifts', subId: 'charity' },

  // ── Entertainment ────────────────────────────────────────────────────────────

  'кино':          { parentId: 'entertainment', subId: 'movies' },
  'cinema':        { parentId: 'entertainment', subId: 'movies' },
  'movies':        { parentId: 'entertainment', subId: 'movies' },
  'билет':         { parentId: 'entertainment', subId: 'events' },
  'концерт':       { parentId: 'entertainment', subId: 'events' },
  'ticket':        { parentId: 'entertainment', subId: 'events' },
  'concert':       { parentId: 'entertainment', subId: 'events' },
  'хобби':         { parentId: 'entertainment', subId: 'hobbies' },
  'hobby':         { parentId: 'entertainment', subId: 'hobbies' },
  'зоопарк':       { parentId: 'entertainment', subId: 'parks' },
  'парк':          { parentId: 'entertainment', subId: 'parks' },
  'zoo':           { parentId: 'entertainment', subId: 'parks' },
  'park':          { parentId: 'entertainment', subId: 'parks' },

  // ── Digital ──────────────────────────────────────────────────────────────────

  'подписка':      { parentId: 'digital', subId: 'subscriptions' },
  'subscription':  { parentId: 'digital', subId: 'subscriptions' },
  'облако':        { parentId: 'digital', subId: 'cloud' },
  'cloud':         { parentId: 'digital', subId: 'cloud' },
  'игры':          { parentId: 'digital', subId: 'games' },
  'games':         { parentId: 'digital', subId: 'games' },

  // ── Travel ───────────────────────────────────────────────────────────────────

  'перелёт':       { parentId: 'travel', subId: 'flights' },
  'авиа':          { parentId: 'travel', subId: 'flights' },
  'авиабилеты':    { parentId: 'travel', subId: 'flights' },
  'самолет':       { parentId: 'travel', subId: 'flights' },
  'чемодан':       { parentId: 'travel', subId: 'flights' },
  'flight':        { parentId: 'travel', subId: 'flights' },
  'flights':       { parentId: 'travel', subId: 'flights' },
  'airplane':      { parentId: 'travel', subId: 'flights' },
  'airport':       { parentId: 'travel', subId: 'flights' },
  'suitcase':      { parentId: 'travel', subId: 'flights' },
  'отель':         { parentId: 'travel', subId: 'hotels' },
  'гостиница':     { parentId: 'travel', subId: 'hotels' },
  'hotel':         { parentId: 'travel', subId: 'hotels' },
  'hostel':        { parentId: 'travel', subId: 'hotels' },
};

const _sorted = Object.entries(ITEMS).sort((a, b) => b[0].length - a[0].length);

export interface ItemMatch {
  parentId: string;
  subId: string;
  keyword: string;
}

export function matchItem(text: string): ItemMatch | null {
  for (const [kw, hit] of _sorted) {
    if (text.includes(kw)) {
      return { parentId: hit.parentId, subId: hit.subId, keyword: kw };
    }
  }
  return null;
}
