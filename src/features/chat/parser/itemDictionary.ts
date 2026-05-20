export interface ItemEntry {
  categoryId: string;
}

/**
 * Keyword → subcategory mapping (EN / RU / HE).
 * subId must match a sub.id in TAXONOMY (icons.tsx).
 * Sorted by key length descending at module init for greedy matching.
 */
export const ITEMS: Record<string, ItemEntry> = {

  // ── FOOD › Bakery ─────────────────────────────────────────────────────────
  'לחם':              { categoryId: 'bakery' },  // HE bread
  'хлеб':             { categoryId: 'bakery' },
  'батон':            { categoryId: 'bakery' },
  'булка':            { categoryId: 'bakery' },
  'лаваш':            { categoryId: 'bakery' },
  'пита':             { categoryId: 'bakery' },
  'выпечка':          { categoryId: 'bakery' },
  'пирог':            { categoryId: 'bakery' },
  'булочка':          { categoryId: 'bakery' },
  'bagel':            { categoryId: 'bakery' },
  'bread':            { categoryId: 'bakery' },
  'pita':             { categoryId: 'bakery' },
  'challah':          { categoryId: 'bakery' },
  'croissant':        { categoryId: 'bakery' },
  'bakery':           { categoryId: 'bakery' },
  'מאפייה':           { categoryId: 'bakery' },  // HE bakery

  // ── FOOD › Dairy ──────────────────────────────────────────────────────────
  'חלב':              { categoryId: 'dairy' },   // HE milk
  'גבינה':            { categoryId: 'dairy' },   // HE cheese
  'יוגורט':           { categoryId: 'dairy' },   // HE yogurt
  'молоко':           { categoryId: 'dairy' },
  'сыр':              { categoryId: 'dairy' },
  'творог':           { categoryId: 'dairy' },
  'йогурт':           { categoryId: 'dairy' },
  'кефир':            { categoryId: 'dairy' },
  'ряженка':          { categoryId: 'dairy' },
  'сметана':          { categoryId: 'dairy' },
  'масло':            { categoryId: 'dairy' },
  'milk':             { categoryId: 'dairy' },
  'cheese':           { categoryId: 'dairy' },
  'butter':           { categoryId: 'dairy' },
  'yogurt':           { categoryId: 'dairy' },
  'cream':            { categoryId: 'dairy' },
  'cottage':          { categoryId: 'dairy' },
  'dairy':            { categoryId: 'dairy' },

  // ── FOOD › Meat & Fish ────────────────────────────────────────────────────
  'עוף':              { categoryId: 'meat_fish' }, // HE chicken
  'בשר':              { categoryId: 'meat_fish' }, // HE meat
  'דגים':             { categoryId: 'meat_fish' }, // HE fish
  'סלמון':            { categoryId: 'meat_fish' }, // HE salmon
  'טונה':             { categoryId: 'meat_fish' }, // HE tuna
  'курица':           { categoryId: 'meat_fish' },
  'говядина':         { categoryId: 'meat_fish' },
  'мясо':             { categoryId: 'meat_fish' },
  'фарш':             { categoryId: 'meat_fish' },
  'рыба':             { categoryId: 'meat_fish' },
  'лосось':           { categoryId: 'meat_fish' },
  'тунец':            { categoryId: 'meat_fish' },
  'колбаса':          { categoryId: 'meat_fish' },
  'сосиски':          { categoryId: 'meat_fish' },
  'chicken':          { categoryId: 'meat_fish' },
  'beef':             { categoryId: 'meat_fish' },
  'meat':             { categoryId: 'meat_fish' },
  'salmon':           { categoryId: 'meat_fish' },
  'tuna':             { categoryId: 'meat_fish' },
  'fish':             { categoryId: 'meat_fish' },
  'sausage':          { categoryId: 'meat_fish' },
  'turkey':           { categoryId: 'meat_fish' },
  'steak':            { categoryId: 'meat_fish' },

  // ── FOOD › Fruits & Veg ───────────────────────────────────────────────────
  'ירקות':            { categoryId: 'fruits_veg' }, // HE vegetables
  'פירות':            { categoryId: 'fruits_veg' }, // HE fruits
  'עגבניות':          { categoryId: 'fruits_veg' }, // HE tomatoes
  'מלפפון':           { categoryId: 'fruits_veg' }, // HE cucumber
  'תפוח':             { categoryId: 'fruits_veg' }, // HE apple
  'בננה':             { categoryId: 'fruits_veg' }, // HE banana
  'банан':            { categoryId: 'fruits_veg' },
  'яблоко':           { categoryId: 'fruits_veg' },
  'яблоки':           { categoryId: 'fruits_veg' },
  'апельсин':         { categoryId: 'fruits_veg' },
  'мандарины':        { categoryId: 'fruits_veg' },
  'огурцы':           { categoryId: 'fruits_veg' },
  'помидоры':         { categoryId: 'fruits_veg' },
  'картошка':         { categoryId: 'fruits_veg' },
  'картофель':        { categoryId: 'fruits_veg' },
  'лук':              { categoryId: 'fruits_veg' },
  'чеснок':           { categoryId: 'fruits_veg' },
  'овощи':            { categoryId: 'fruits_veg' },
  'фрукты':           { categoryId: 'fruits_veg' },
  'salad':            { categoryId: 'fruits_veg' },
  'banana':           { categoryId: 'fruits_veg' },
  'apple':            { categoryId: 'fruits_veg' },
  'tomatoes':         { categoryId: 'fruits_veg' },
  'vegetables':       { categoryId: 'fruits_veg' },
  'fruits':           { categoryId: 'fruits_veg' },
  'avocado':          { categoryId: 'fruits_veg' },
  'авокадо':          { categoryId: 'fruits_veg' },
  'авокадо ':         { categoryId: 'fruits_veg' },

  // ── FOOD › Groceries (generic) ────────────────────────────────────────────
  'яйца':             { categoryId: 'groceries' },
  'яйцо':             { categoryId: 'groceries' },
  'рис':              { categoryId: 'groceries' },
  'гречка':           { categoryId: 'groceries' },
  'макароны':         { categoryId: 'groceries' },
  'спагетти':         { categoryId: 'groceries' },
  'сок':              { categoryId: 'groceries' },
  'вода':             { categoryId: 'groceries' },
  'чай':              { categoryId: 'groceries' },
  'продукты':         { categoryId: 'groceries' },
  'eggs':             { categoryId: 'groceries' },
  'rice':             { categoryId: 'groceries' },
  'pasta':            { categoryId: 'groceries' },
  'juice':            { categoryId: 'groceries' },
  'tea':              { categoryId: 'groceries' },
  'groceries':        { categoryId: 'groceries' },
  'grocery':          { categoryId: 'groceries' },
  'ביצים':            { categoryId: 'groceries' }, // HE eggs
  'אורז':             { categoryId: 'groceries' }, // HE rice

  // ── FOOD › Snacks ─────────────────────────────────────────────────────────
  'шоколад':          { categoryId: 'snacks' },
  'печенье':          { categoryId: 'snacks' },
  'чипсы':            { categoryId: 'snacks' },
  'мороженое':        { categoryId: 'snacks' },
  'десерт':           { categoryId: 'snacks' },
  'конфеты':          { categoryId: 'snacks' },
  'снэк':             { categoryId: 'snacks' },
  'chocolate':        { categoryId: 'snacks' },
  'chips':            { categoryId: 'snacks' },
  'ice cream':        { categoryId: 'snacks' },
  'dessert':          { categoryId: 'snacks' },
  'candy':            { categoryId: 'snacks' },
  'snack':            { categoryId: 'snacks' },
  'שוקולד':           { categoryId: 'snacks' }, // HE chocolate
  'גלידה':            { categoryId: 'snacks' }, // HE ice cream

  // ── FOOD › Alcohol ────────────────────────────────────────────────────────
  'вино':             { categoryId: 'alcohol' },
  'пиво':             { categoryId: 'alcohol' },
  'алкоголь':         { categoryId: 'alcohol' },
  'виски':            { categoryId: 'alcohol' },
  'водка':            { categoryId: 'alcohol' },
  'wine':             { categoryId: 'alcohol' },
  'beer':             { categoryId: 'alcohol' },
  'whiskey':          { categoryId: 'alcohol' },
  'alcohol':          { categoryId: 'alcohol' },
  'יין':              { categoryId: 'alcohol' }, // HE wine
  'בירה':             { categoryId: 'alcohol' }, // HE beer

  // ── FOOD › Coffee ─────────────────────────────────────────────────────────
  'кофе':             { categoryId: 'coffee' },
  'капучино':         { categoryId: 'coffee' },
  'латте':            { categoryId: 'coffee' },
  'эспрессо':         { categoryId: 'coffee' },
  'americano':        { categoryId: 'coffee' },
  'cappuccino':       { categoryId: 'coffee' },
  'coffee':           { categoryId: 'coffee' },
  'latte':            { categoryId: 'coffee' },
  'espresso':         { categoryId: 'coffee' },
  'קפה':              { categoryId: 'coffee' }, // HE coffee
  'קפוצ\'ינו':        { categoryId: 'coffee' }, // HE cappuccino

  // ── FOOD › Fast Food ──────────────────────────────────────────────────────
  'пицца':            { categoryId: 'fast_food' },
  'бургер':           { categoryId: 'fast_food' },
  'шаурма':           { categoryId: 'fast_food' },
  'шаверма':          { categoryId: 'fast_food' },
  'фалафель':         { categoryId: 'fast_food' },
  'донер':            { categoryId: 'fast_food' },
  'хот-дог':          { categoryId: 'fast_food' },
  'pizza':            { categoryId: 'fast_food' },
  'burger':           { categoryId: 'fast_food' },
  'shawarma':         { categoryId: 'fast_food' },
  'falafel':          { categoryId: 'fast_food' },
  'hotdog':           { categoryId: 'fast_food' },
  'פיצה':             { categoryId: 'fast_food' }, // HE pizza
  'שווארמה':          { categoryId: 'fast_food' }, // HE shawarma
  'פלאפל':            { categoryId: 'fast_food' }, // HE falafel
  'המבורגר':          { categoryId: 'fast_food' }, // HE burger

  // ── FOOD › Restaurant ─────────────────────────────────────────────────────
  'суши':             { categoryId: 'restaurant' },
  'роллы':            { categoryId: 'restaurant' },
  'обед':             { categoryId: 'restaurant' },
  'ужин':             { categoryId: 'restaurant' },
  'завтрак':          { categoryId: 'restaurant' },
  'ресторан':         { categoryId: 'restaurant' },
  'sushi':            { categoryId: 'restaurant' },
  'lunch':            { categoryId: 'restaurant' },
  'dinner':           { categoryId: 'restaurant' },
  'breakfast':        { categoryId: 'restaurant' },
  'restaurant':       { categoryId: 'restaurant' },
  'סושי':             { categoryId: 'restaurant' }, // HE sushi
  'מסעדה':            { categoryId: 'restaurant' }, // HE restaurant

  // ── FOOD › Delivery ───────────────────────────────────────────────────────
  'доставка':         { categoryId: 'delivery' },
  'delivery':         { categoryId: 'delivery' },
  'משלוח':            { categoryId: 'delivery' }, // HE delivery

  // ── HOME › Rent / Mortgage ────────────────────────────────────────────────
  'аренда':           { categoryId: 'rent' },
  'квартплата':       { categoryId: 'rent' },
  'квартира':         { categoryId: 'rent' },
  'съем':             { categoryId: 'rent' },
  'rent':             { categoryId: 'rent' },
  'שכר דירה':         { categoryId: 'rent' },   // HE rent
  'ипотека':          { categoryId: 'mortgage' },
  'mortgage':         { categoryId: 'mortgage' },
  'משכנתא':           { categoryId: 'mortgage' }, // HE mortgage

  // ── HOME › Utilities ──────────────────────────────────────────────────────
  'электричество':    { categoryId: 'utilities' },
  'свет':             { categoryId: 'utilities' },
  'газ':              { categoryId: 'utilities' },
  'коммунальные':     { categoryId: 'utilities' },
  'electricity':      { categoryId: 'utilities' },
  'חשמל':             { categoryId: 'utilities' }, // HE electricity
  'מים':              { categoryId: 'utilities' }, // HE water/utilities
  'גז':               { categoryId: 'utilities' }, // HE gas

  // ── HOME › Internet / Mobile ──────────────────────────────────────────────
  'интернет':         { categoryId: 'internet' },
  'wifi':             { categoryId: 'internet' },
  'internet':         { categoryId: 'internet' },
  'אינטרנט':          { categoryId: 'internet' }, // HE internet
  'мобильная':        { categoryId: 'mobile_bill' },
  'мобильный':        { categoryId: 'mobile_bill' },
  'сотовый':          { categoryId: 'mobile_bill' },
  'mobile plan':      { categoryId: 'mobile_bill' },
  'cell phone':       { categoryId: 'mobile_bill' },

  // ── HOME › Furniture / Appliances ────────────────────────────────────────
  'мебель':           { categoryId: 'furniture' },
  'диван':            { categoryId: 'furniture' },
  'кровать':          { categoryId: 'furniture' },
  'стол':             { categoryId: 'furniture' },
  'шкаф':             { categoryId: 'furniture' },
  'furniture':        { categoryId: 'furniture' },
  'ריהוט':            { categoryId: 'furniture' }, // HE furniture
  'холодильник':      { categoryId: 'appliances' },
  'стиральная':       { categoryId: 'appliances' },
  'духовка':          { categoryId: 'appliances' },
  'микроволновка':    { categoryId: 'appliances' },
  'кондиционер':      { categoryId: 'appliances' },
  'fridge':           { categoryId: 'appliances' },
  'washing machine':  { categoryId: 'appliances' },
  'air conditioner':  { categoryId: 'appliances' },
  'appliance':        { categoryId: 'appliances' },

  // ── HOME › Tools ──────────────────────────────────────────────────────────
  'дрель':            { categoryId: 'tools' },
  'молоток':          { categoryId: 'tools' },
  'отвертка':         { categoryId: 'tools' },
  'шуруповерт':       { categoryId: 'tools' },
  'пила':             { categoryId: 'tools' },
  'гвозди':           { categoryId: 'tools' },
  'инструменты':      { categoryId: 'tools' },
  'drill':            { categoryId: 'tools' },
  'hammer':           { categoryId: 'tools' },
  'screwdriver':      { categoryId: 'tools' },
  'tools':            { categoryId: 'tools' },
  'מברגה':            { categoryId: 'tools' }, // HE screwdriver
  'פטיש':             { categoryId: 'tools' }, // HE hammer
  'מקדחה':            { categoryId: 'tools' }, // HE drill

  // ── HOME › Repairs ────────────────────────────────────────────────────────
  'ремонт':           { categoryId: 'repairs' },
  'repairs':          { categoryId: 'repairs' },
  'renovation':       { categoryId: 'repairs' },
  'תיקון':            { categoryId: 'repairs' }, // HE repair

  // ── HOME › Household ──────────────────────────────────────────────────────
  'шампунь':          { categoryId: 'household' },
  'мыло':             { categoryId: 'household' },
  'стиральный порошок': { categoryId: 'household' },
  'химия':            { categoryId: 'household' },
  'туалетная бумага': { categoryId: 'household' },
  'посуда':           { categoryId: 'household' },
  'кастрюля':         { categoryId: 'household' },
  'shampoo':          { categoryId: 'household' },
  'soap':             { categoryId: 'household' },
  'detergent':        { categoryId: 'household' },
  'toilet paper':     { categoryId: 'household' },
  'שמפו':             { categoryId: 'household' }, // HE shampoo
  'סבון':             { categoryId: 'household' }, // HE soap

  // ── HOME › Arnona / Committee ─────────────────────────────────────────────
  'арнона':           { categoryId: 'arnona' },
  'arnona':           { categoryId: 'arnona' },
  'ארנונה':           { categoryId: 'arnona' }, // HE arnona
  'ваад':             { categoryId: 'committee' },
  'ועד בית':          { categoryId: 'committee' }, // HE committee

  // ── TRANSPORT ─────────────────────────────────────────────────────────────
  'автобус':          { categoryId: 'public_transport' },
  'метро':            { categoryId: 'public_transport' },
  'проезд':           { categoryId: 'public_transport' },
  'bus':              { categoryId: 'public_transport' },
  'metro':            { categoryId: 'public_transport' },
  'אוטובוס':          { categoryId: 'public_transport' }, // HE bus
  'такси':            { categoryId: 'taxi' },
  'taxi':             { categoryId: 'taxi' },
  'מונית':            { categoryId: 'taxi' }, // HE taxi
  'поезд':            { categoryId: 'train' },
  'электричка':       { categoryId: 'train' },
  'train':            { categoryId: 'train' },
  'רכבת':             { categoryId: 'train' }, // HE train
  'проездной':        { categoryId: 'bus_pass' },
  'рав кав':          { categoryId: 'bus_pass' },
  'rav kav':          { categoryId: 'bus_pass' },
  'bus pass':         { categoryId: 'bus_pass' },
  'רב קו':            { categoryId: 'bus_pass' }, // HE Rav Kav

  // ── CAR ───────────────────────────────────────────────────────────────────
  'бензин':           { categoryId: 'fuel' },
  'топливо':          { categoryId: 'fuel' },
  'дизель':           { categoryId: 'fuel' },
  'заправка':         { categoryId: 'fuel' },
  'fuel':             { categoryId: 'fuel' },
  'petrol':           { categoryId: 'fuel' },
  'diesel':           { categoryId: 'fuel' },
  'gas station':      { categoryId: 'fuel' },
  'בנזין':            { categoryId: 'fuel' }, // HE petrol
  'דלק':              { categoryId: 'fuel' }, // HE fuel/Delek
  'парковка':         { categoryId: 'parking' },
  'parking':          { categoryId: 'parking' },
  'חניה':             { categoryId: 'parking' }, // HE parking
  'шины':             { categoryId: 'car_service' },
  'резина':           { categoryId: 'car_service' },
  'tires':            { categoryId: 'car_service' },
  'мойка':            { categoryId: 'car_wash' },
  'car wash':         { categoryId: 'car_wash' },

  // ── HEALTH ────────────────────────────────────────────────────────────────
  'таблетки':         { categoryId: 'pharmacy' },
  'лекарства':        { categoryId: 'pharmacy' },
  'лекарство':        { categoryId: 'pharmacy' },
  'витамины':         { categoryId: 'pharmacy' },
  'medicine':         { categoryId: 'pharmacy' },
  'vitamins':         { categoryId: 'pharmacy' },
  'pharmacy':         { categoryId: 'pharmacy' },
  'תרופה':            { categoryId: 'pharmacy' }, // HE medicine
  'בית מרקחת':        { categoryId: 'pharmacy' }, // HE pharmacy
  'врач':             { categoryId: 'doctors' },
  'доктор':           { categoryId: 'doctors' },
  'клиника':          { categoryId: 'doctors' },
  'doctor':           { categoryId: 'doctors' },
  'clinic':           { categoryId: 'doctors' },
  'רופא':             { categoryId: 'doctors' }, // HE doctor
  'анализы':          { categoryId: 'lab_tests' },
  'lab tests':        { categoryId: 'lab_tests' },
  'בדיקות':           { categoryId: 'lab_tests' }, // HE tests
  'стоматолог':       { categoryId: 'dentist' },
  'дантист':          { categoryId: 'dentist' },
  'зубы':             { categoryId: 'dentist' },
  'dentist':          { categoryId: 'dentist' },
  'דנטיסט':           { categoryId: 'dentist' }, // HE dentist

  // ── SPORTS ────────────────────────────────────────────────────────────────
  'спортзал':         { categoryId: 'gym' },
  'фитнес':           { categoryId: 'gym' },
  'тренировка':       { categoryId: 'gym' },
  'абонемент':        { categoryId: 'gym' },
  'gym':              { categoryId: 'gym' },
  'fitness':          { categoryId: 'gym' },
  'workout':          { categoryId: 'gym' },
  'חדר כושר':         { categoryId: 'gym' }, // HE gym
  'йога':             { categoryId: 'sports_classes' },
  'пилатес':          { categoryId: 'sports_classes' },
  'секция':           { categoryId: 'sports_classes' },
  'yoga':             { categoryId: 'sports_classes' },
  'pilates':          { categoryId: 'sports_classes' },
  'гантели':          { categoryId: 'sports_equip' },
  'dumbbells':        { categoryId: 'sports_equip' },

  // ── SHOPPING › Clothes ────────────────────────────────────────────────────
  'одежда':           { categoryId: 'clothes' },
  'шмотки':           { categoryId: 'clothes' },
  'футболка':         { categoryId: 'clothes' },
  'майка':            { categoryId: 'clothes' },
  'рубашка':          { categoryId: 'clothes' },
  'штаны':            { categoryId: 'clothes' },
  'джинсы':           { categoryId: 'clothes' },
  'шорты':            { categoryId: 'clothes' },
  'куртка':           { categoryId: 'clothes' },
  'носки':            { categoryId: 'clothes' },
  'белье':            { categoryId: 'clothes' },
  'платье':           { categoryId: 'clothes' },
  'юбка':             { categoryId: 'clothes' },
  'clothes':          { categoryId: 'clothes' },
  'dress':            { categoryId: 'clothes' },
  'shirt':            { categoryId: 'clothes' },
  'jeans':            { categoryId: 'clothes' },
  'jacket':           { categoryId: 'clothes' },
  'בגדים':            { categoryId: 'clothes' }, // HE clothes

  // ── SHOPPING › Shoes ──────────────────────────────────────────────────────
  'кроссовки':        { categoryId: 'shoes' },
  'ботинки':          { categoryId: 'shoes' },
  'туфли':            { categoryId: 'shoes' },
  'сандалии':         { categoryId: 'shoes' },
  'shoes':            { categoryId: 'shoes' },
  'sneakers':         { categoryId: 'shoes' },
  'boots':            { categoryId: 'shoes' },
  'sandals':          { categoryId: 'shoes' },
  'נעליים':           { categoryId: 'shoes' }, // HE shoes

  // ── SHOPPING › Accessories ────────────────────────────────────────────────
  'рюкзак':           { categoryId: 'accessories' },
  'сумка':            { categoryId: 'accessories' },
  'кошелек':          { categoryId: 'accessories' },
  'backpack':         { categoryId: 'accessories' },
  'bag':              { categoryId: 'accessories' },
  'watch':            { categoryId: 'accessories' },
  'часы':             { categoryId: 'accessories' },

  // ── SHOPPING › Online ─────────────────────────────────────────────────────
  'онлайн':           { categoryId: 'online_shopping' },
  'online':           { categoryId: 'online_shopping' },

  // ── BEAUTY ────────────────────────────────────────────────────────────────
  'стрижка':          { categoryId: 'haircut' },
  'парикмахер':       { categoryId: 'haircut' },
  'haircut':          { categoryId: 'haircut' },
  'barber':           { categoryId: 'haircut' },
  'hairdresser':      { categoryId: 'haircut' },
  'תספורת':           { categoryId: 'haircut' }, // HE haircut
  'косметика':        { categoryId: 'cosmetics' },
  'крем':             { categoryId: 'cosmetics' },
  'духи':             { categoryId: 'cosmetics' },
  'помада':           { categoryId: 'cosmetics' },
  'cosmetics':        { categoryId: 'cosmetics' },
  'perfume':          { categoryId: 'cosmetics' },
  'makeup':           { categoryId: 'cosmetics' },
  'lipstick':         { categoryId: 'cosmetics' },
  'קוסמטיקה':         { categoryId: 'cosmetics' }, // HE cosmetics
  'маникюр':          { categoryId: 'manicure' },
  'педикюр':          { categoryId: 'manicure' },
  'manicure':         { categoryId: 'manicure' },
  'pedicure':         { categoryId: 'manicure' },
  'спа':              { categoryId: 'spa_massage' },
  'массаж':           { categoryId: 'spa_massage' },
  'spa':              { categoryId: 'spa_massage' },
  'massage':          { categoryId: 'spa_massage' },

  // ── TECHNOLOGY ────────────────────────────────────────────────────────────
  'электроника':      { categoryId: 'electronics' },
  'ноутбук':          { categoryId: 'electronics' },
  'телевизор':        { categoryId: 'electronics' },
  'наушники':         { categoryId: 'electronics' },
  'laptop':           { categoryId: 'electronics' },
  'tv':               { categoryId: 'electronics' },
  'headphones':       { categoryId: 'electronics' },
  'electronics':      { categoryId: 'electronics' },
  'מחשב':             { categoryId: 'electronics' }, // HE computer
  'телефон':          { categoryId: 'gadgets' },
  'смартфон':         { categoryId: 'gadgets' },
  'айфон':            { categoryId: 'gadgets' },
  'планшет':          { categoryId: 'gadgets' },
  'iphone':           { categoryId: 'gadgets' },
  'samsung':          { categoryId: 'gadgets' },
  'phone':            { categoryId: 'gadgets' },
  'tablet':           { categoryId: 'gadgets' },
  'טלפון':            { categoryId: 'gadgets' }, // HE phone
  'мышка':            { categoryId: 'phone_acc' },
  'клавиатура':       { categoryId: 'phone_acc' },
  'зарядка':          { categoryId: 'phone_acc' },
  'кабель':           { categoryId: 'phone_acc' },
  'charger':          { categoryId: 'phone_acc' },
  'cable':            { categoryId: 'phone_acc' },
  'airpods':          { categoryId: 'phone_acc' },
  'macbook':          { categoryId: 'electronics' },

  // ── ENTERTAINMENT ─────────────────────────────────────────────────────────
  'кино':             { categoryId: 'movies' },
  'cinema':           { categoryId: 'movies' },
  'movies':           { categoryId: 'movies' },
  'קולנוע':           { categoryId: 'movies' }, // HE cinema
  'билет':            { categoryId: 'events' },
  'концерт':          { categoryId: 'events' },
  'театр':            { categoryId: 'events' },
  'ticket':           { categoryId: 'events' },
  'concert':          { categoryId: 'events' },
  'theatre':          { categoryId: 'events' },
  'כרטיס':            { categoryId: 'events' }, // HE ticket
  'хобби':            { categoryId: 'hobbies' },
  'hobby':            { categoryId: 'hobbies' },
  'зоопарк':          { categoryId: 'parks' },
  'парк':             { categoryId: 'parks' },
  'zoo':              { categoryId: 'parks' },
  'park':             { categoryId: 'parks' },
  'игры':             { categoryId: 'games' },
  'games':            { categoryId: 'games' },
  'gaming':           { categoryId: 'games' },

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
  'подписка':         { categoryId: 'streaming' },
  'subscription':     { categoryId: 'streaming' },
  'стриминг':         { categoryId: 'streaming' },
  'streaming':        { categoryId: 'streaming' },
  'מנוי':             { categoryId: 'streaming' }, // HE subscription
  'облако':           { categoryId: 'cloud_storage' },
  'cloud':            { categoryId: 'cloud_storage' },

  // ── TRAVEL ────────────────────────────────────────────────────────────────
  'перелёт':          { categoryId: 'flights' },
  'авиа':             { categoryId: 'flights' },
  'авиабилеты':       { categoryId: 'flights' },
  'самолет':          { categoryId: 'flights' },
  'flight':           { categoryId: 'flights' },
  'flights':          { categoryId: 'flights' },
  'airplane':         { categoryId: 'flights' },
  'airport':          { categoryId: 'flights' },
  'טיסה':             { categoryId: 'flights' }, // HE flight
  'отель':            { categoryId: 'hotels' },
  'гостиница':        { categoryId: 'hotels' },
  'hotel':            { categoryId: 'hotels' },
  'hostel':           { categoryId: 'hotels' },
  'מלון':             { categoryId: 'hotels' }, // HE hotel

  // ── EDUCATION ─────────────────────────────────────────────────────────────
  'курсы':            { categoryId: 'courses' },
  'курс':             { categoryId: 'courses' },
  'courses':          { categoryId: 'courses' },
  'course':           { categoryId: 'courses' },
  'קורס':             { categoryId: 'courses' }, // HE course
  'книги':            { categoryId: 'books' },
  'книга':            { categoryId: 'books' },
  'books':            { categoryId: 'books' },
  'book':             { categoryId: 'books' },
  'ספר':              { categoryId: 'books' }, // HE book
  'репетитор':        { categoryId: 'tutoring' },
  'tutor':            { categoryId: 'tutoring' },

  // ── KIDS ──────────────────────────────────────────────────────────────────
  'садик':            { categoryId: 'kindergarten' },
  'детский сад':      { categoryId: 'kindergarten' },
  'kindergarten':     { categoryId: 'kindergarten' },
  'גן ילדים':         { categoryId: 'kindergarten' }, // HE kindergarten
  'школа':            { categoryId: 'kids_school' },
  'school':           { categoryId: 'kids_school' },
  'кружок':           { categoryId: 'kids_activities' },
  'activities':       { categoryId: 'kids_activities' },
  'חוג':              { categoryId: 'kids_activities' }, // HE class/activity
  'игрушки':          { categoryId: 'toys' },
  'toys':             { categoryId: 'toys' },
  'צעצוע':            { categoryId: 'toys' }, // HE toy

  // ── PETS ──────────────────────────────────────────────────────────────────
  'корм для':         { categoryId: 'pet_food' },
  'pet food':         { categoryId: 'pet_food' },
  'ветеринар':        { categoryId: 'vet' },
  'vet':              { categoryId: 'vet' },
  'veterinary':       { categoryId: 'vet' },
  'וטרינר':           { categoryId: 'vet' }, // HE vet

  // ── GIFTS ─────────────────────────────────────────────────────────────────
  'подарок':          { categoryId: 'birthday_gifts' },
  'подарки':          { categoryId: 'birthday_gifts' },
  'gift':             { categoryId: 'birthday_gifts' },
  'present':          { categoryId: 'birthday_gifts' },
  'מתנה':             { categoryId: 'birthday_gifts' }, // HE gift
  'благотворит':      { categoryId: 'charity' },
  'charity':          { categoryId: 'charity' },
  'donation':         { categoryId: 'charity' },
  'צדקה':             { categoryId: 'charity' }, // HE charity

  // ── WORK ──────────────────────────────────────────────────────────────────
  'канцелярия':       { categoryId: 'office_supplies' },
  'бумага':           { categoryId: 'office_supplies' },
  'office supplies':  { categoryId: 'office_supplies' },
  'коворкинг':        { categoryId: 'coworking' },
  'coworking':        { categoryId: 'coworking' },

  // ── FINANCE ───────────────────────────────────────────────────────────────
  'страховка':        { categoryId: 'insurance' },
  'страхование':      { categoryId: 'insurance' },
  'insurance':        { categoryId: 'insurance' },
  'ביטוח':            { categoryId: 'insurance' }, // HE insurance
  'налоги':           { categoryId: 'taxes' },
  'налог':            { categoryId: 'taxes' },
  'taxes':            { categoryId: 'taxes' },
  'инвестиции':       { categoryId: 'investments' },
  'investments':      { categoryId: 'investments' },

  // ── SERVICES ──────────────────────────────────────────────────────────────
  'уборка':           { categoryId: 'cleaning' },
  'cleaning':         { categoryId: 'cleaning' },
  'ניקיון':           { categoryId: 'cleaning' }, // HE cleaning
  'прачечная':        { categoryId: 'laundry' },
  'laundry':          { categoryId: 'laundry' },
  'почта':            { categoryId: 'postal' },
  'postal':           { categoryId: 'postal' },
  'shipping':         { categoryId: 'postal' },
  'דואר':             { categoryId: 'postal' }, // HE postal
};

const _sorted = Object.entries(ITEMS).sort((a, b) => b[0].length - a[0].length);

export interface ItemMatch {
  parentId: string;
  subId: string;
  keyword: string;
}

// Check keyword appears as a whole word (not embedded inside another word)
function matchesWord(text: string, kw: string): boolean {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}])${esc}(?![\\p{L}])`, 'iu').test(text);
}

export function matchItem(text: string): ItemMatch | null {
  for (const [kw, hit] of _sorted) {
    if (matchesWord(text, kw)) {
      return { parentId: '', subId: hit.categoryId, keyword: kw };
    }
  }
  return null;
}
