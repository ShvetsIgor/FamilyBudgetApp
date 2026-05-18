export interface ItemEntry {
  parentId: string;
  subId: string;
}

/**
 * Keyword → subcategory mapping (EN / RU / HE).
 * subId must match a sub.id in TAXONOMY (icons.tsx).
 * Sorted by key length descending at module init for greedy matching.
 */
export const ITEMS: Record<string, ItemEntry> = {

  // ── FOOD › Bakery ─────────────────────────────────────────────────────────
  'לחם':              { parentId: 'food', subId: 'bakery' },  // HE bread
  'хлеб':             { parentId: 'food', subId: 'bakery' },
  'батон':            { parentId: 'food', subId: 'bakery' },
  'булка':            { parentId: 'food', subId: 'bakery' },
  'лаваш':            { parentId: 'food', subId: 'bakery' },
  'пита':             { parentId: 'food', subId: 'bakery' },
  'выпечка':          { parentId: 'food', subId: 'bakery' },
  'пирог':            { parentId: 'food', subId: 'bakery' },
  'булочка':          { parentId: 'food', subId: 'bakery' },
  'bagel':            { parentId: 'food', subId: 'bakery' },
  'bread':            { parentId: 'food', subId: 'bakery' },
  'pita':             { parentId: 'food', subId: 'bakery' },
  'challah':          { parentId: 'food', subId: 'bakery' },
  'croissant':        { parentId: 'food', subId: 'bakery' },
  'bakery':           { parentId: 'food', subId: 'bakery' },
  'מאפייה':           { parentId: 'food', subId: 'bakery' },  // HE bakery

  // ── FOOD › Dairy ──────────────────────────────────────────────────────────
  'חלב':              { parentId: 'food', subId: 'dairy' },   // HE milk
  'גבינה':            { parentId: 'food', subId: 'dairy' },   // HE cheese
  'יוגורט':           { parentId: 'food', subId: 'dairy' },   // HE yogurt
  'молоко':           { parentId: 'food', subId: 'dairy' },
  'сыр':              { parentId: 'food', subId: 'dairy' },
  'творог':           { parentId: 'food', subId: 'dairy' },
  'йогурт':           { parentId: 'food', subId: 'dairy' },
  'кефир':            { parentId: 'food', subId: 'dairy' },
  'ряженка':          { parentId: 'food', subId: 'dairy' },
  'сметана':          { parentId: 'food', subId: 'dairy' },
  'масло':            { parentId: 'food', subId: 'dairy' },
  'milk':             { parentId: 'food', subId: 'dairy' },
  'cheese':           { parentId: 'food', subId: 'dairy' },
  'butter':           { parentId: 'food', subId: 'dairy' },
  'yogurt':           { parentId: 'food', subId: 'dairy' },
  'cream':            { parentId: 'food', subId: 'dairy' },
  'cottage':          { parentId: 'food', subId: 'dairy' },
  'dairy':            { parentId: 'food', subId: 'dairy' },

  // ── FOOD › Meat & Fish ────────────────────────────────────────────────────
  'עוף':              { parentId: 'food', subId: 'meat_fish' }, // HE chicken
  'בשר':              { parentId: 'food', subId: 'meat_fish' }, // HE meat
  'דגים':             { parentId: 'food', subId: 'meat_fish' }, // HE fish
  'סלמון':            { parentId: 'food', subId: 'meat_fish' }, // HE salmon
  'טונה':             { parentId: 'food', subId: 'meat_fish' }, // HE tuna
  'курица':           { parentId: 'food', subId: 'meat_fish' },
  'говядина':         { parentId: 'food', subId: 'meat_fish' },
  'мясо':             { parentId: 'food', subId: 'meat_fish' },
  'фарш':             { parentId: 'food', subId: 'meat_fish' },
  'рыба':             { parentId: 'food', subId: 'meat_fish' },
  'лосось':           { parentId: 'food', subId: 'meat_fish' },
  'тунец':            { parentId: 'food', subId: 'meat_fish' },
  'колбаса':          { parentId: 'food', subId: 'meat_fish' },
  'сосиски':          { parentId: 'food', subId: 'meat_fish' },
  'chicken':          { parentId: 'food', subId: 'meat_fish' },
  'beef':             { parentId: 'food', subId: 'meat_fish' },
  'meat':             { parentId: 'food', subId: 'meat_fish' },
  'salmon':           { parentId: 'food', subId: 'meat_fish' },
  'tuna':             { parentId: 'food', subId: 'meat_fish' },
  'fish':             { parentId: 'food', subId: 'meat_fish' },
  'sausage':          { parentId: 'food', subId: 'meat_fish' },
  'turkey':           { parentId: 'food', subId: 'meat_fish' },
  'steak':            { parentId: 'food', subId: 'meat_fish' },

  // ── FOOD › Fruits & Veg ───────────────────────────────────────────────────
  'ירקות':            { parentId: 'food', subId: 'fruits_veg' }, // HE vegetables
  'פירות':            { parentId: 'food', subId: 'fruits_veg' }, // HE fruits
  'עגבניות':          { parentId: 'food', subId: 'fruits_veg' }, // HE tomatoes
  'מלפפון':           { parentId: 'food', subId: 'fruits_veg' }, // HE cucumber
  'תפוח':             { parentId: 'food', subId: 'fruits_veg' }, // HE apple
  'בננה':             { parentId: 'food', subId: 'fruits_veg' }, // HE banana
  'банан':            { parentId: 'food', subId: 'fruits_veg' },
  'яблоко':           { parentId: 'food', subId: 'fruits_veg' },
  'яблоки':           { parentId: 'food', subId: 'fruits_veg' },
  'апельсин':         { parentId: 'food', subId: 'fruits_veg' },
  'мандарины':        { parentId: 'food', subId: 'fruits_veg' },
  'огурцы':           { parentId: 'food', subId: 'fruits_veg' },
  'помидоры':         { parentId: 'food', subId: 'fruits_veg' },
  'картошка':         { parentId: 'food', subId: 'fruits_veg' },
  'картофель':        { parentId: 'food', subId: 'fruits_veg' },
  'лук':              { parentId: 'food', subId: 'fruits_veg' },
  'чеснок':           { parentId: 'food', subId: 'fruits_veg' },
  'овощи':            { parentId: 'food', subId: 'fruits_veg' },
  'фрукты':           { parentId: 'food', subId: 'fruits_veg' },
  'salad':            { parentId: 'food', subId: 'fruits_veg' },
  'banana':           { parentId: 'food', subId: 'fruits_veg' },
  'apple':            { parentId: 'food', subId: 'fruits_veg' },
  'tomatoes':         { parentId: 'food', subId: 'fruits_veg' },
  'vegetables':       { parentId: 'food', subId: 'fruits_veg' },
  'fruits':           { parentId: 'food', subId: 'fruits_veg' },
  'avocado':          { parentId: 'food', subId: 'fruits_veg' },
  'авокадо':          { parentId: 'food', subId: 'fruits_veg' },
  'авокадо ':         { parentId: 'food', subId: 'fruits_veg' },

  // ── FOOD › Groceries (generic) ────────────────────────────────────────────
  'яйца':             { parentId: 'food', subId: 'groceries' },
  'яйцо':             { parentId: 'food', subId: 'groceries' },
  'рис':              { parentId: 'food', subId: 'groceries' },
  'гречка':           { parentId: 'food', subId: 'groceries' },
  'макароны':         { parentId: 'food', subId: 'groceries' },
  'спагетти':         { parentId: 'food', subId: 'groceries' },
  'сок':              { parentId: 'food', subId: 'groceries' },
  'вода':             { parentId: 'food', subId: 'groceries' },
  'чай':              { parentId: 'food', subId: 'groceries' },
  'продукты':         { parentId: 'food', subId: 'groceries' },
  'eggs':             { parentId: 'food', subId: 'groceries' },
  'rice':             { parentId: 'food', subId: 'groceries' },
  'pasta':            { parentId: 'food', subId: 'groceries' },
  'juice':            { parentId: 'food', subId: 'groceries' },
  'tea':              { parentId: 'food', subId: 'groceries' },
  'groceries':        { parentId: 'food', subId: 'groceries' },
  'grocery':          { parentId: 'food', subId: 'groceries' },
  'ביצים':            { parentId: 'food', subId: 'groceries' }, // HE eggs
  'אורז':             { parentId: 'food', subId: 'groceries' }, // HE rice

  // ── FOOD › Snacks ─────────────────────────────────────────────────────────
  'шоколад':          { parentId: 'food', subId: 'snacks' },
  'печенье':          { parentId: 'food', subId: 'snacks' },
  'чипсы':            { parentId: 'food', subId: 'snacks' },
  'мороженое':        { parentId: 'food', subId: 'snacks' },
  'десерт':           { parentId: 'food', subId: 'snacks' },
  'конфеты':          { parentId: 'food', subId: 'snacks' },
  'снэк':             { parentId: 'food', subId: 'snacks' },
  'chocolate':        { parentId: 'food', subId: 'snacks' },
  'chips':            { parentId: 'food', subId: 'snacks' },
  'ice cream':        { parentId: 'food', subId: 'snacks' },
  'dessert':          { parentId: 'food', subId: 'snacks' },
  'candy':            { parentId: 'food', subId: 'snacks' },
  'snack':            { parentId: 'food', subId: 'snacks' },
  'שוקולד':           { parentId: 'food', subId: 'snacks' }, // HE chocolate
  'גלידה':            { parentId: 'food', subId: 'snacks' }, // HE ice cream

  // ── FOOD › Alcohol ────────────────────────────────────────────────────────
  'вино':             { parentId: 'food', subId: 'alcohol' },
  'пиво':             { parentId: 'food', subId: 'alcohol' },
  'алкоголь':         { parentId: 'food', subId: 'alcohol' },
  'виски':            { parentId: 'food', subId: 'alcohol' },
  'водка':            { parentId: 'food', subId: 'alcohol' },
  'wine':             { parentId: 'food', subId: 'alcohol' },
  'beer':             { parentId: 'food', subId: 'alcohol' },
  'whiskey':          { parentId: 'food', subId: 'alcohol' },
  'alcohol':          { parentId: 'food', subId: 'alcohol' },
  'יין':              { parentId: 'food', subId: 'alcohol' }, // HE wine
  'בירה':             { parentId: 'food', subId: 'alcohol' }, // HE beer

  // ── FOOD › Coffee ─────────────────────────────────────────────────────────
  'кофе':             { parentId: 'food', subId: 'coffee' },
  'капучино':         { parentId: 'food', subId: 'coffee' },
  'латте':            { parentId: 'food', subId: 'coffee' },
  'эспрессо':         { parentId: 'food', subId: 'coffee' },
  'americano':        { parentId: 'food', subId: 'coffee' },
  'cappuccino':       { parentId: 'food', subId: 'coffee' },
  'coffee':           { parentId: 'food', subId: 'coffee' },
  'latte':            { parentId: 'food', subId: 'coffee' },
  'espresso':         { parentId: 'food', subId: 'coffee' },
  'קפה':              { parentId: 'food', subId: 'coffee' }, // HE coffee
  'קפוצ\'ינו':        { parentId: 'food', subId: 'coffee' }, // HE cappuccino

  // ── FOOD › Fast Food ──────────────────────────────────────────────────────
  'пицца':            { parentId: 'food', subId: 'fast_food' },
  'бургер':           { parentId: 'food', subId: 'fast_food' },
  'шаурма':           { parentId: 'food', subId: 'fast_food' },
  'шаверма':          { parentId: 'food', subId: 'fast_food' },
  'фалафель':         { parentId: 'food', subId: 'fast_food' },
  'донер':            { parentId: 'food', subId: 'fast_food' },
  'хот-дог':          { parentId: 'food', subId: 'fast_food' },
  'pizza':            { parentId: 'food', subId: 'fast_food' },
  'burger':           { parentId: 'food', subId: 'fast_food' },
  'shawarma':         { parentId: 'food', subId: 'fast_food' },
  'falafel':          { parentId: 'food', subId: 'fast_food' },
  'hotdog':           { parentId: 'food', subId: 'fast_food' },
  'פיצה':             { parentId: 'food', subId: 'fast_food' }, // HE pizza
  'שווארמה':          { parentId: 'food', subId: 'fast_food' }, // HE shawarma
  'פלאפל':            { parentId: 'food', subId: 'fast_food' }, // HE falafel
  'המבורגר':          { parentId: 'food', subId: 'fast_food' }, // HE burger

  // ── FOOD › Restaurant ─────────────────────────────────────────────────────
  'суши':             { parentId: 'food', subId: 'restaurant' },
  'роллы':            { parentId: 'food', subId: 'restaurant' },
  'обед':             { parentId: 'food', subId: 'restaurant' },
  'ужин':             { parentId: 'food', subId: 'restaurant' },
  'завтрак':          { parentId: 'food', subId: 'restaurant' },
  'ресторан':         { parentId: 'food', subId: 'restaurant' },
  'sushi':            { parentId: 'food', subId: 'restaurant' },
  'lunch':            { parentId: 'food', subId: 'restaurant' },
  'dinner':           { parentId: 'food', subId: 'restaurant' },
  'breakfast':        { parentId: 'food', subId: 'restaurant' },
  'restaurant':       { parentId: 'food', subId: 'restaurant' },
  'סושי':             { parentId: 'food', subId: 'restaurant' }, // HE sushi
  'מסעדה':            { parentId: 'food', subId: 'restaurant' }, // HE restaurant

  // ── FOOD › Delivery ───────────────────────────────────────────────────────
  'доставка':         { parentId: 'food', subId: 'delivery' },
  'delivery':         { parentId: 'food', subId: 'delivery' },
  'משלוח':            { parentId: 'food', subId: 'delivery' }, // HE delivery

  // ── HOME › Rent / Mortgage ────────────────────────────────────────────────
  'аренда':           { parentId: 'home', subId: 'rent' },
  'квартплата':       { parentId: 'home', subId: 'rent' },
  'квартира':         { parentId: 'home', subId: 'rent' },
  'съем':             { parentId: 'home', subId: 'rent' },
  'rent':             { parentId: 'home', subId: 'rent' },
  'שכר דירה':         { parentId: 'home', subId: 'rent' },   // HE rent
  'ипотека':          { parentId: 'home', subId: 'mortgage' },
  'mortgage':         { parentId: 'home', subId: 'mortgage' },
  'משכנתא':           { parentId: 'home', subId: 'mortgage' }, // HE mortgage

  // ── HOME › Utilities ──────────────────────────────────────────────────────
  'электричество':    { parentId: 'home', subId: 'utilities' },
  'свет':             { parentId: 'home', subId: 'utilities' },
  'газ':              { parentId: 'home', subId: 'utilities' },
  'коммунальные':     { parentId: 'home', subId: 'utilities' },
  'electricity':      { parentId: 'home', subId: 'utilities' },
  'חשמל':             { parentId: 'home', subId: 'utilities' }, // HE electricity
  'מים':              { parentId: 'home', subId: 'utilities' }, // HE water/utilities
  'גז':               { parentId: 'home', subId: 'utilities' }, // HE gas

  // ── HOME › Internet / Mobile ──────────────────────────────────────────────
  'интернет':         { parentId: 'home', subId: 'internet' },
  'wifi':             { parentId: 'home', subId: 'internet' },
  'internet':         { parentId: 'home', subId: 'internet' },
  'אינטרנט':          { parentId: 'home', subId: 'internet' }, // HE internet
  'мобильная':        { parentId: 'home', subId: 'mobile_bill' },
  'мобильный':        { parentId: 'home', subId: 'mobile_bill' },
  'сотовый':          { parentId: 'home', subId: 'mobile_bill' },
  'mobile plan':      { parentId: 'home', subId: 'mobile_bill' },
  'cell phone':       { parentId: 'home', subId: 'mobile_bill' },

  // ── HOME › Furniture / Appliances ────────────────────────────────────────
  'мебель':           { parentId: 'home', subId: 'furniture' },
  'диван':            { parentId: 'home', subId: 'furniture' },
  'кровать':          { parentId: 'home', subId: 'furniture' },
  'стол':             { parentId: 'home', subId: 'furniture' },
  'шкаф':             { parentId: 'home', subId: 'furniture' },
  'furniture':        { parentId: 'home', subId: 'furniture' },
  'ריהוט':            { parentId: 'home', subId: 'furniture' }, // HE furniture
  'холодильник':      { parentId: 'home', subId: 'appliances' },
  'стиральная':       { parentId: 'home', subId: 'appliances' },
  'духовка':          { parentId: 'home', subId: 'appliances' },
  'микроволновка':    { parentId: 'home', subId: 'appliances' },
  'кондиционер':      { parentId: 'home', subId: 'appliances' },
  'fridge':           { parentId: 'home', subId: 'appliances' },
  'washing machine':  { parentId: 'home', subId: 'appliances' },
  'air conditioner':  { parentId: 'home', subId: 'appliances' },
  'appliance':        { parentId: 'home', subId: 'appliances' },

  // ── HOME › Tools ──────────────────────────────────────────────────────────
  'дрель':            { parentId: 'home', subId: 'tools' },
  'молоток':          { parentId: 'home', subId: 'tools' },
  'отвертка':         { parentId: 'home', subId: 'tools' },
  'шуруповерт':       { parentId: 'home', subId: 'tools' },
  'пила':             { parentId: 'home', subId: 'tools' },
  'гвозди':           { parentId: 'home', subId: 'tools' },
  'инструменты':      { parentId: 'home', subId: 'tools' },
  'drill':            { parentId: 'home', subId: 'tools' },
  'hammer':           { parentId: 'home', subId: 'tools' },
  'screwdriver':      { parentId: 'home', subId: 'tools' },
  'tools':            { parentId: 'home', subId: 'tools' },
  'מברגה':            { parentId: 'home', subId: 'tools' }, // HE screwdriver
  'פטיש':             { parentId: 'home', subId: 'tools' }, // HE hammer
  'מקדחה':            { parentId: 'home', subId: 'tools' }, // HE drill

  // ── HOME › Repairs ────────────────────────────────────────────────────────
  'ремонт':           { parentId: 'home', subId: 'repairs' },
  'repairs':          { parentId: 'home', subId: 'repairs' },
  'renovation':       { parentId: 'home', subId: 'repairs' },
  'תיקון':            { parentId: 'home', subId: 'repairs' }, // HE repair

  // ── HOME › Household ──────────────────────────────────────────────────────
  'шампунь':          { parentId: 'home', subId: 'household' },
  'мыло':             { parentId: 'home', subId: 'household' },
  'стиральный порошок': { parentId: 'home', subId: 'household' },
  'химия':            { parentId: 'home', subId: 'household' },
  'туалетная бумага': { parentId: 'home', subId: 'household' },
  'посуда':           { parentId: 'home', subId: 'household' },
  'кастрюля':         { parentId: 'home', subId: 'household' },
  'shampoo':          { parentId: 'home', subId: 'household' },
  'soap':             { parentId: 'home', subId: 'household' },
  'detergent':        { parentId: 'home', subId: 'household' },
  'toilet paper':     { parentId: 'home', subId: 'household' },
  'שמפו':             { parentId: 'home', subId: 'household' }, // HE shampoo
  'סבון':             { parentId: 'home', subId: 'household' }, // HE soap

  // ── HOME › Arnona / Committee ─────────────────────────────────────────────
  'арнона':           { parentId: 'home', subId: 'arnona' },
  'arnona':           { parentId: 'home', subId: 'arnona' },
  'ארנונה':           { parentId: 'home', subId: 'arnona' }, // HE arnona
  'ваад':             { parentId: 'home', subId: 'committee' },
  'ועד בית':          { parentId: 'home', subId: 'committee' }, // HE committee

  // ── TRANSPORT ─────────────────────────────────────────────────────────────
  'автобус':          { parentId: 'transport', subId: 'public_transport' },
  'метро':            { parentId: 'transport', subId: 'public_transport' },
  'проезд':           { parentId: 'transport', subId: 'public_transport' },
  'bus':              { parentId: 'transport', subId: 'public_transport' },
  'metro':            { parentId: 'transport', subId: 'public_transport' },
  'אוטובוס':          { parentId: 'transport', subId: 'public_transport' }, // HE bus
  'такси':            { parentId: 'transport', subId: 'taxi' },
  'taxi':             { parentId: 'transport', subId: 'taxi' },
  'מונית':            { parentId: 'transport', subId: 'taxi' }, // HE taxi
  'поезд':            { parentId: 'transport', subId: 'train' },
  'электричка':       { parentId: 'transport', subId: 'train' },
  'train':            { parentId: 'transport', subId: 'train' },
  'רכבת':             { parentId: 'transport', subId: 'train' }, // HE train
  'проездной':        { parentId: 'transport', subId: 'bus_pass' },
  'рав кав':          { parentId: 'transport', subId: 'bus_pass' },
  'rav kav':          { parentId: 'transport', subId: 'bus_pass' },
  'bus pass':         { parentId: 'transport', subId: 'bus_pass' },
  'רב קו':            { parentId: 'transport', subId: 'bus_pass' }, // HE Rav Kav

  // ── CAR ───────────────────────────────────────────────────────────────────
  'бензин':           { parentId: 'car', subId: 'fuel' },
  'топливо':          { parentId: 'car', subId: 'fuel' },
  'дизель':           { parentId: 'car', subId: 'fuel' },
  'заправка':         { parentId: 'car', subId: 'fuel' },
  'fuel':             { parentId: 'car', subId: 'fuel' },
  'petrol':           { parentId: 'car', subId: 'fuel' },
  'diesel':           { parentId: 'car', subId: 'fuel' },
  'gas station':      { parentId: 'car', subId: 'fuel' },
  'בנזין':            { parentId: 'car', subId: 'fuel' }, // HE petrol
  'דלק':              { parentId: 'car', subId: 'fuel' }, // HE fuel/Delek
  'парковка':         { parentId: 'car', subId: 'parking' },
  'parking':          { parentId: 'car', subId: 'parking' },
  'חניה':             { parentId: 'car', subId: 'parking' }, // HE parking
  'шины':             { parentId: 'car', subId: 'car_service' },
  'резина':           { parentId: 'car', subId: 'car_service' },
  'tires':            { parentId: 'car', subId: 'car_service' },
  'мойка':            { parentId: 'car', subId: 'car_wash' },
  'car wash':         { parentId: 'car', subId: 'car_wash' },

  // ── HEALTH ────────────────────────────────────────────────────────────────
  'таблетки':         { parentId: 'health', subId: 'pharmacy' },
  'лекарства':        { parentId: 'health', subId: 'pharmacy' },
  'лекарство':        { parentId: 'health', subId: 'pharmacy' },
  'витамины':         { parentId: 'health', subId: 'pharmacy' },
  'medicine':         { parentId: 'health', subId: 'pharmacy' },
  'vitamins':         { parentId: 'health', subId: 'pharmacy' },
  'pharmacy':         { parentId: 'health', subId: 'pharmacy' },
  'תרופה':            { parentId: 'health', subId: 'pharmacy' }, // HE medicine
  'בית מרקחת':        { parentId: 'health', subId: 'pharmacy' }, // HE pharmacy
  'врач':             { parentId: 'health', subId: 'doctors' },
  'доктор':           { parentId: 'health', subId: 'doctors' },
  'клиника':          { parentId: 'health', subId: 'doctors' },
  'doctor':           { parentId: 'health', subId: 'doctors' },
  'clinic':           { parentId: 'health', subId: 'doctors' },
  'רופא':             { parentId: 'health', subId: 'doctors' }, // HE doctor
  'анализы':          { parentId: 'health', subId: 'lab_tests' },
  'lab tests':        { parentId: 'health', subId: 'lab_tests' },
  'בדיקות':           { parentId: 'health', subId: 'lab_tests' }, // HE tests
  'стоматолог':       { parentId: 'health', subId: 'dentist' },
  'дантист':          { parentId: 'health', subId: 'dentist' },
  'зубы':             { parentId: 'health', subId: 'dentist' },
  'dentist':          { parentId: 'health', subId: 'dentist' },
  'דנטיסט':           { parentId: 'health', subId: 'dentist' }, // HE dentist

  // ── SPORTS ────────────────────────────────────────────────────────────────
  'спортзал':         { parentId: 'sports', subId: 'gym' },
  'фитнес':           { parentId: 'sports', subId: 'gym' },
  'тренировка':       { parentId: 'sports', subId: 'gym' },
  'абонемент':        { parentId: 'sports', subId: 'gym' },
  'gym':              { parentId: 'sports', subId: 'gym' },
  'fitness':          { parentId: 'sports', subId: 'gym' },
  'workout':          { parentId: 'sports', subId: 'gym' },
  'חדר כושר':         { parentId: 'sports', subId: 'gym' }, // HE gym
  'йога':             { parentId: 'sports', subId: 'sports_classes' },
  'пилатес':          { parentId: 'sports', subId: 'sports_classes' },
  'секция':           { parentId: 'sports', subId: 'sports_classes' },
  'yoga':             { parentId: 'sports', subId: 'sports_classes' },
  'pilates':          { parentId: 'sports', subId: 'sports_classes' },
  'гантели':          { parentId: 'sports', subId: 'sports_equip' },
  'dumbbells':        { parentId: 'sports', subId: 'sports_equip' },

  // ── SHOPPING › Clothes ────────────────────────────────────────────────────
  'одежда':           { parentId: 'shopping', subId: 'clothes' },
  'шмотки':           { parentId: 'shopping', subId: 'clothes' },
  'футболка':         { parentId: 'shopping', subId: 'clothes' },
  'майка':            { parentId: 'shopping', subId: 'clothes' },
  'рубашка':          { parentId: 'shopping', subId: 'clothes' },
  'штаны':            { parentId: 'shopping', subId: 'clothes' },
  'джинсы':           { parentId: 'shopping', subId: 'clothes' },
  'шорты':            { parentId: 'shopping', subId: 'clothes' },
  'куртка':           { parentId: 'shopping', subId: 'clothes' },
  'носки':            { parentId: 'shopping', subId: 'clothes' },
  'белье':            { parentId: 'shopping', subId: 'clothes' },
  'платье':           { parentId: 'shopping', subId: 'clothes' },
  'юбка':             { parentId: 'shopping', subId: 'clothes' },
  'clothes':          { parentId: 'shopping', subId: 'clothes' },
  'dress':            { parentId: 'shopping', subId: 'clothes' },
  'shirt':            { parentId: 'shopping', subId: 'clothes' },
  'jeans':            { parentId: 'shopping', subId: 'clothes' },
  'jacket':           { parentId: 'shopping', subId: 'clothes' },
  'בגדים':            { parentId: 'shopping', subId: 'clothes' }, // HE clothes

  // ── SHOPPING › Shoes ──────────────────────────────────────────────────────
  'кроссовки':        { parentId: 'shopping', subId: 'shoes' },
  'ботинки':          { parentId: 'shopping', subId: 'shoes' },
  'туфли':            { parentId: 'shopping', subId: 'shoes' },
  'сандалии':         { parentId: 'shopping', subId: 'shoes' },
  'shoes':            { parentId: 'shopping', subId: 'shoes' },
  'sneakers':         { parentId: 'shopping', subId: 'shoes' },
  'boots':            { parentId: 'shopping', subId: 'shoes' },
  'sandals':          { parentId: 'shopping', subId: 'shoes' },
  'נעליים':           { parentId: 'shopping', subId: 'shoes' }, // HE shoes

  // ── SHOPPING › Accessories ────────────────────────────────────────────────
  'рюкзак':           { parentId: 'shopping', subId: 'accessories' },
  'сумка':            { parentId: 'shopping', subId: 'accessories' },
  'кошелек':          { parentId: 'shopping', subId: 'accessories' },
  'backpack':         { parentId: 'shopping', subId: 'accessories' },
  'bag':              { parentId: 'shopping', subId: 'accessories' },
  'watch':            { parentId: 'shopping', subId: 'accessories' },
  'часы':             { parentId: 'shopping', subId: 'accessories' },

  // ── SHOPPING › Online ─────────────────────────────────────────────────────
  'онлайн':           { parentId: 'shopping', subId: 'online_shopping' },
  'online':           { parentId: 'shopping', subId: 'online_shopping' },

  // ── BEAUTY ────────────────────────────────────────────────────────────────
  'стрижка':          { parentId: 'beauty', subId: 'haircut' },
  'парикмахер':       { parentId: 'beauty', subId: 'haircut' },
  'haircut':          { parentId: 'beauty', subId: 'haircut' },
  'barber':           { parentId: 'beauty', subId: 'haircut' },
  'hairdresser':      { parentId: 'beauty', subId: 'haircut' },
  'תספורת':           { parentId: 'beauty', subId: 'haircut' }, // HE haircut
  'косметика':        { parentId: 'beauty', subId: 'cosmetics' },
  'крем':             { parentId: 'beauty', subId: 'cosmetics' },
  'духи':             { parentId: 'beauty', subId: 'cosmetics' },
  'помада':           { parentId: 'beauty', subId: 'cosmetics' },
  'cosmetics':        { parentId: 'beauty', subId: 'cosmetics' },
  'perfume':          { parentId: 'beauty', subId: 'cosmetics' },
  'makeup':           { parentId: 'beauty', subId: 'cosmetics' },
  'lipstick':         { parentId: 'beauty', subId: 'cosmetics' },
  'קוסמטיקה':         { parentId: 'beauty', subId: 'cosmetics' }, // HE cosmetics
  'маникюр':          { parentId: 'beauty', subId: 'manicure' },
  'педикюр':          { parentId: 'beauty', subId: 'manicure' },
  'manicure':         { parentId: 'beauty', subId: 'manicure' },
  'pedicure':         { parentId: 'beauty', subId: 'manicure' },
  'спа':              { parentId: 'beauty', subId: 'spa_massage' },
  'массаж':           { parentId: 'beauty', subId: 'spa_massage' },
  'spa':              { parentId: 'beauty', subId: 'spa_massage' },
  'massage':          { parentId: 'beauty', subId: 'spa_massage' },

  // ── TECHNOLOGY ────────────────────────────────────────────────────────────
  'электроника':      { parentId: 'technology', subId: 'electronics' },
  'ноутбук':          { parentId: 'technology', subId: 'electronics' },
  'телевизор':        { parentId: 'technology', subId: 'electronics' },
  'наушники':         { parentId: 'technology', subId: 'electronics' },
  'laptop':           { parentId: 'technology', subId: 'electronics' },
  'tv':               { parentId: 'technology', subId: 'electronics' },
  'headphones':       { parentId: 'technology', subId: 'electronics' },
  'electronics':      { parentId: 'technology', subId: 'electronics' },
  'מחשב':             { parentId: 'technology', subId: 'electronics' }, // HE computer
  'телефон':          { parentId: 'technology', subId: 'gadgets' },
  'смартфон':         { parentId: 'technology', subId: 'gadgets' },
  'айфон':            { parentId: 'technology', subId: 'gadgets' },
  'планшет':          { parentId: 'technology', subId: 'gadgets' },
  'iphone':           { parentId: 'technology', subId: 'gadgets' },
  'samsung':          { parentId: 'technology', subId: 'gadgets' },
  'phone':            { parentId: 'technology', subId: 'gadgets' },
  'tablet':           { parentId: 'technology', subId: 'gadgets' },
  'טלפון':            { parentId: 'technology', subId: 'gadgets' }, // HE phone
  'мышка':            { parentId: 'technology', subId: 'phone_acc' },
  'клавиатура':       { parentId: 'technology', subId: 'phone_acc' },
  'зарядка':          { parentId: 'technology', subId: 'phone_acc' },
  'кабель':           { parentId: 'technology', subId: 'phone_acc' },
  'charger':          { parentId: 'technology', subId: 'phone_acc' },
  'cable':            { parentId: 'technology', subId: 'phone_acc' },
  'airpods':          { parentId: 'technology', subId: 'phone_acc' },
  'macbook':          { parentId: 'technology', subId: 'electronics' },

  // ── ENTERTAINMENT ─────────────────────────────────────────────────────────
  'кино':             { parentId: 'entertainment', subId: 'movies' },
  'cinema':           { parentId: 'entertainment', subId: 'movies' },
  'movies':           { parentId: 'entertainment', subId: 'movies' },
  'קולנוע':           { parentId: 'entertainment', subId: 'movies' }, // HE cinema
  'билет':            { parentId: 'entertainment', subId: 'events' },
  'концерт':          { parentId: 'entertainment', subId: 'events' },
  'театр':            { parentId: 'entertainment', subId: 'events' },
  'ticket':           { parentId: 'entertainment', subId: 'events' },
  'concert':          { parentId: 'entertainment', subId: 'events' },
  'theatre':          { parentId: 'entertainment', subId: 'events' },
  'כרטיס':            { parentId: 'entertainment', subId: 'events' }, // HE ticket
  'хобби':            { parentId: 'entertainment', subId: 'hobbies' },
  'hobby':            { parentId: 'entertainment', subId: 'hobbies' },
  'зоопарк':          { parentId: 'entertainment', subId: 'parks' },
  'парк':             { parentId: 'entertainment', subId: 'parks' },
  'zoo':              { parentId: 'entertainment', subId: 'parks' },
  'park':             { parentId: 'entertainment', subId: 'parks' },
  'игры':             { parentId: 'entertainment', subId: 'games' },
  'games':            { parentId: 'entertainment', subId: 'games' },
  'gaming':           { parentId: 'entertainment', subId: 'games' },

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
  'подписка':         { parentId: 'subscriptions', subId: 'streaming' },
  'subscription':     { parentId: 'subscriptions', subId: 'streaming' },
  'стриминг':         { parentId: 'subscriptions', subId: 'streaming' },
  'streaming':        { parentId: 'subscriptions', subId: 'streaming' },
  'מנוי':             { parentId: 'subscriptions', subId: 'streaming' }, // HE subscription
  'облако':           { parentId: 'subscriptions', subId: 'cloud_storage' },
  'cloud':            { parentId: 'subscriptions', subId: 'cloud_storage' },

  // ── TRAVEL ────────────────────────────────────────────────────────────────
  'перелёт':          { parentId: 'travel', subId: 'flights' },
  'авиа':             { parentId: 'travel', subId: 'flights' },
  'авиабилеты':       { parentId: 'travel', subId: 'flights' },
  'самолет':          { parentId: 'travel', subId: 'flights' },
  'flight':           { parentId: 'travel', subId: 'flights' },
  'flights':          { parentId: 'travel', subId: 'flights' },
  'airplane':         { parentId: 'travel', subId: 'flights' },
  'airport':          { parentId: 'travel', subId: 'flights' },
  'טיסה':             { parentId: 'travel', subId: 'flights' }, // HE flight
  'отель':            { parentId: 'travel', subId: 'hotels' },
  'гостиница':        { parentId: 'travel', subId: 'hotels' },
  'hotel':            { parentId: 'travel', subId: 'hotels' },
  'hostel':           { parentId: 'travel', subId: 'hotels' },
  'מלון':             { parentId: 'travel', subId: 'hotels' }, // HE hotel

  // ── EDUCATION ─────────────────────────────────────────────────────────────
  'курсы':            { parentId: 'education', subId: 'courses' },
  'курс':             { parentId: 'education', subId: 'courses' },
  'courses':          { parentId: 'education', subId: 'courses' },
  'course':           { parentId: 'education', subId: 'courses' },
  'קורס':             { parentId: 'education', subId: 'courses' }, // HE course
  'книги':            { parentId: 'education', subId: 'books' },
  'книга':            { parentId: 'education', subId: 'books' },
  'books':            { parentId: 'education', subId: 'books' },
  'book':             { parentId: 'education', subId: 'books' },
  'ספר':              { parentId: 'education', subId: 'books' }, // HE book
  'репетитор':        { parentId: 'education', subId: 'tutoring' },
  'tutor':            { parentId: 'education', subId: 'tutoring' },

  // ── KIDS ──────────────────────────────────────────────────────────────────
  'садик':            { parentId: 'kids', subId: 'kindergarten' },
  'детский сад':      { parentId: 'kids', subId: 'kindergarten' },
  'kindergarten':     { parentId: 'kids', subId: 'kindergarten' },
  'גן ילדים':         { parentId: 'kids', subId: 'kindergarten' }, // HE kindergarten
  'школа':            { parentId: 'kids', subId: 'kids_school' },
  'school':           { parentId: 'kids', subId: 'kids_school' },
  'кружок':           { parentId: 'kids', subId: 'kids_activities' },
  'activities':       { parentId: 'kids', subId: 'kids_activities' },
  'חוג':              { parentId: 'kids', subId: 'kids_activities' }, // HE class/activity
  'игрушки':          { parentId: 'kids', subId: 'toys' },
  'toys':             { parentId: 'kids', subId: 'toys' },
  'צעצוע':            { parentId: 'kids', subId: 'toys' }, // HE toy

  // ── PETS ──────────────────────────────────────────────────────────────────
  'корм для':         { parentId: 'pets', subId: 'pet_food' },
  'pet food':         { parentId: 'pets', subId: 'pet_food' },
  'ветеринар':        { parentId: 'pets', subId: 'vet' },
  'vet':              { parentId: 'pets', subId: 'vet' },
  'veterinary':       { parentId: 'pets', subId: 'vet' },
  'וטרינר':           { parentId: 'pets', subId: 'vet' }, // HE vet

  // ── GIFTS ─────────────────────────────────────────────────────────────────
  'подарок':          { parentId: 'gifts', subId: 'birthday_gifts' },
  'подарки':          { parentId: 'gifts', subId: 'birthday_gifts' },
  'gift':             { parentId: 'gifts', subId: 'birthday_gifts' },
  'present':          { parentId: 'gifts', subId: 'birthday_gifts' },
  'מתנה':             { parentId: 'gifts', subId: 'birthday_gifts' }, // HE gift
  'благотворит':      { parentId: 'gifts', subId: 'charity' },
  'charity':          { parentId: 'gifts', subId: 'charity' },
  'donation':         { parentId: 'gifts', subId: 'charity' },
  'צדקה':             { parentId: 'gifts', subId: 'charity' }, // HE charity

  // ── WORK ──────────────────────────────────────────────────────────────────
  'канцелярия':       { parentId: 'work', subId: 'office_supplies' },
  'бумага':           { parentId: 'work', subId: 'office_supplies' },
  'office supplies':  { parentId: 'work', subId: 'office_supplies' },
  'коворкинг':        { parentId: 'work', subId: 'coworking' },
  'coworking':        { parentId: 'work', subId: 'coworking' },

  // ── FINANCE ───────────────────────────────────────────────────────────────
  'страховка':        { parentId: 'finance', subId: 'insurance' },
  'страхование':      { parentId: 'finance', subId: 'insurance' },
  'insurance':        { parentId: 'finance', subId: 'insurance' },
  'ביטוח':            { parentId: 'finance', subId: 'insurance' }, // HE insurance
  'налоги':           { parentId: 'finance', subId: 'taxes' },
  'налог':            { parentId: 'finance', subId: 'taxes' },
  'taxes':            { parentId: 'finance', subId: 'taxes' },
  'инвестиции':       { parentId: 'finance', subId: 'investments' },
  'investments':      { parentId: 'finance', subId: 'investments' },

  // ── SERVICES ──────────────────────────────────────────────────────────────
  'уборка':           { parentId: 'services', subId: 'cleaning' },
  'cleaning':         { parentId: 'services', subId: 'cleaning' },
  'ניקיון':           { parentId: 'services', subId: 'cleaning' }, // HE cleaning
  'прачечная':        { parentId: 'services', subId: 'laundry' },
  'laundry':          { parentId: 'services', subId: 'laundry' },
  'почта':            { parentId: 'services', subId: 'postal' },
  'postal':           { parentId: 'services', subId: 'postal' },
  'shipping':         { parentId: 'services', subId: 'postal' },
  'דואר':             { parentId: 'services', subId: 'postal' }, // HE postal
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
