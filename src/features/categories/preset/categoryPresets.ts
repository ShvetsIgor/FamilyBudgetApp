/**
 * Category preset data — initial onboarding blueprints only.
 *
 * TAXONOMY is strictly preset / seeding data. It is NOT a runtime engine.
 *
 * Allowed uses:
 *   - Constructor wizard (initial category selection)
 *   - Default category seeding on first login
 *   - categoryAliasMap.ts (builds flat lookup structures ONCE at module load)
 *
 * Must NOT be used for:
 *   - Runtime icon resolution
 *   - Runtime alias/name lookup (use categoryAliasMap exports instead)
 *   - Selector derivation
 *   - Category hierarchy at runtime
 *
 * All runtime consumers must go through categoryAliasMap.ts exports:
 *   FOLDER_BLUEPRINTS, CATEGORY_BLUEPRINTS, CATEGORY_METADATA, getPresetDisplayName
 */

export interface TaxonomyEntry {
  id: string;
  name: string;
  ru?: string;
  icon: string;
  color: string;
  subs?: TaxonomySub[];
}

export interface TaxonomySub {
  id: string;
  name: string;
  ru?: string;
  icon: string;
}

export const TAXONOMY: TaxonomyEntry[] = [
  { id: 'food',          name: 'Food & Drinks',      ru: 'Еда и напитки',      color: '#E07A5F', icon: 'cart',      subs: [
    { id: 'groceries',    name: 'Groceries',          ru: 'Продукты',           icon: 'cart' },
    { id: 'bakery',       name: 'Bakery',             ru: 'Хлеб и выпечка',     icon: 'cart' },
    { id: 'dairy',        name: 'Dairy',              ru: 'Молочные',           icon: 'cart' },
    { id: 'meat_fish',    name: 'Meat & Fish',        ru: 'Мясо и рыба',        icon: 'cart' },
    { id: 'fruits_veg',   name: 'Fruits & Veg',       ru: 'Фрукты и овощи',     icon: 'cart' },
    { id: 'restaurant',   name: 'Restaurant',         ru: 'Ресторан',           icon: 'plate' },
    { id: 'coffee',       name: 'Coffee',             ru: 'Кофе',               icon: 'coffee' },
    { id: 'fast_food',    name: 'Fast Food',          ru: 'Фастфуд',            icon: 'burger' },
    { id: 'delivery',     name: 'Delivery',           ru: 'Доставка',           icon: 'delivery' },
    { id: 'snacks',       name: 'Snacks',             ru: 'Снэки',              icon: 'icecream' },
    { id: 'alcohol',      name: 'Alcohol',            ru: 'Алкоголь',           icon: 'wine' },
    { id: 'food_other',   name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'home',          name: 'Home & Bills',        ru: 'Дом и счета',        color: '#81B29A', icon: 'house',     subs: [
    { id: 'rent',         name: 'Rent',               ru: 'Аренда',             icon: 'key' },
    { id: 'mortgage',     name: 'Mortgage',           ru: 'Ипотека',            icon: 'bank' },
    { id: 'utilities',    name: 'Utilities',          ru: 'Коммунальные',       icon: 'lightning' },
    { id: 'internet',     name: 'Internet',           ru: 'Интернет',           icon: 'wifi' },
    { id: 'mobile_bill',  name: 'Mobile Plan',        ru: 'Мобильная',          icon: 'phone' },
    { id: 'furniture',    name: 'Furniture',          ru: 'Мебель',             icon: 'couch' },
    { id: 'appliances',   name: 'Appliances',         ru: 'Бытовая техника',    icon: 'lightning' },
    { id: 'repairs',      name: 'Repairs',            ru: 'Ремонт',             icon: 'wrench' },
    { id: 'tools',        name: 'Tools',              ru: 'Инструменты',        icon: 'wrench' },
    { id: 'household',    name: 'Household',          ru: 'Хозтовары',          icon: 'spray' },
    { id: 'arnona',       name: 'Arnona',             ru: 'Арнона',             icon: 'receipt' },
    { id: 'committee',    name: 'Building Committee', ru: 'Ваад баит',          icon: 'building' },
    { id: 'home_other',   name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'transport',     name: 'Transport',           ru: 'Транспорт',          color: '#F2CC8F', icon: 'bus',       subs: [
    { id: 'public_transport', name: 'Public Transport', ru: 'Общ. транспорт',  icon: 'bus' },
    { id: 'taxi',         name: 'Taxi',               ru: 'Такси',              icon: 'taxi' },
    { id: 'train',        name: 'Train',              ru: 'Поезд',              icon: 'train' },
    { id: 'bus_pass',     name: 'Transit Pass',       ru: 'Проездной',          icon: 'card' },
    { id: 'tr_other',     name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'car',           name: 'Car',                 ru: 'Машина',             color: '#8AA9D6', icon: 'car',       subs: [
    { id: 'fuel',         name: 'Fuel',               ru: 'Бензин',             icon: 'fuel' },
    { id: 'parking',      name: 'Parking',            ru: 'Парковка',           icon: 'parking' },
    { id: 'car_service',  name: 'Car Service',        ru: 'ТО',                 icon: 'wrench' },
    { id: 'car_insurance', name: 'Car Insurance',     ru: 'Страховка',          icon: 'shield' },
    { id: 'car_wash',     name: 'Car Wash',           ru: 'Мойка',              icon: 'carwash' },
    { id: 'car_tax',      name: 'Car Tax',            ru: 'Налог',              icon: 'receipt' },
    { id: 'car_other',    name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'health',        name: 'Health',              ru: 'Здоровье',           color: '#C97B84', icon: 'heart',     subs: [
    { id: 'pharmacy',     name: 'Pharmacy',           ru: 'Аптека',             icon: 'pill' },
    { id: 'doctors',      name: 'Doctors',            ru: 'Врачи',              icon: 'stethoscope' },
    { id: 'dentist',      name: 'Dentist',            ru: 'Стоматолог',         icon: 'tooth' },
    { id: 'h_insurance',  name: 'Health Insurance',   ru: 'Страховка',          icon: 'shield' },
    { id: 'lab_tests',    name: 'Lab Tests',          ru: 'Анализы',            icon: 'receipt' },
    { id: 'h_other',      name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'sports',        name: 'Sports & Fitness',    ru: 'Спорт',              color: '#81B29A', icon: 'dumbbell',  subs: [
    { id: 'gym',          name: 'Gym',                ru: 'Спортзал',           icon: 'dumbbell' },
    { id: 'sports_classes', name: 'Classes',          ru: 'Тренировки',         icon: 'ball' },
    { id: 'sports_equip', name: 'Equipment',          ru: 'Инвентарь',          icon: 'ball' },
    { id: 'outdoor',      name: 'Outdoor',            ru: 'На воздухе',         icon: 'compass' },
    { id: 'sports_other', name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'shopping',      name: 'Shopping',            ru: 'Покупки',            color: '#E9B384', icon: 'bag',       subs: [
    { id: 'clothes',      name: 'Clothes',            ru: 'Одежда',             icon: 'shirt' },
    { id: 'shoes',        name: 'Shoes',              ru: 'Обувь',              icon: 'bag' },
    { id: 'accessories',  name: 'Accessories',        ru: 'Аксессуары',         icon: 'watch' },
    { id: 'online_shopping', name: 'Online Shopping', ru: 'Онлайн',            icon: 'online' },
    { id: 'home_goods',   name: 'Home Goods',         ru: 'Для дома',           icon: 'couch' },
    { id: 'sh_other',     name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'beauty',        name: 'Beauty',              ru: 'Красота',            color: '#C97B84', icon: 'lipstick',  subs: [
    { id: 'haircut',      name: 'Haircut',            ru: 'Стрижка',            icon: 'scissors' },
    { id: 'cosmetics',    name: 'Cosmetics',          ru: 'Косметика',          icon: 'lipstick' },
    { id: 'spa_massage',  name: 'Spa & Massage',      ru: 'Спа и массаж',       icon: 'heart' },
    { id: 'manicure',     name: 'Manicure',           ru: 'Маникюр',            icon: 'lipstick' },
    { id: 'beauty_other', name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'technology',    name: 'Technology',          ru: 'Технологии',         color: '#8AA9D6', icon: 'laptop',    subs: [
    { id: 'electronics',  name: 'Electronics',        ru: 'Электроника',        icon: 'laptop' },
    { id: 'gadgets',      name: 'Gadgets',            ru: 'Гаджеты',            icon: 'phone' },
    { id: 'software',     name: 'Software',           ru: 'Программы',          icon: 'laptop' },
    { id: 'phone_acc',    name: 'Phone Accessories',  ru: 'Аксессуары',         icon: 'phone' },
    { id: 'tech_other',   name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'entertainment', name: 'Entertainment',       ru: 'Развлечения',        color: '#A8B89C', icon: 'cinema',    subs: [
    { id: 'movies',       name: 'Movies & Shows',     ru: 'Кино',               icon: 'cinema' },
    { id: 'events',       name: 'Events',             ru: 'Мероприятия',        icon: 'ticket' },
    { id: 'hobbies',      name: 'Hobbies',            ru: 'Хобби',              icon: 'brush' },
    { id: 'parks',        name: 'Parks & Attractions', ru: 'Парки',             icon: 'ferris' },
    { id: 'games',        name: 'Games',              ru: 'Игры',               icon: 'controller' },
    { id: 'ent_other',    name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'subscriptions', name: 'Subscriptions',       ru: 'Подписки',           color: '#8AA9D6', icon: 'tv',        subs: [
    { id: 'streaming',    name: 'Streaming',          ru: 'Стриминг',           icon: 'tv' },
    { id: 'music_sub',    name: 'Music',              ru: 'Музыка',             icon: 'music' },
    { id: 'cloud_storage', name: 'Cloud Storage',     ru: 'Облако',             icon: 'cloud' },
    { id: 'software_sub', name: 'Software',           ru: 'Программы',          icon: 'laptop' },
    { id: 'sub_other',    name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'travel',        name: 'Travel',              ru: 'Путешествия',        color: '#E07A5F', icon: 'plane',     subs: [
    { id: 'flights',      name: 'Flights',            ru: 'Перелёты',           icon: 'plane' },
    { id: 'hotels',       name: 'Hotels',             ru: 'Отели',              icon: 'bed' },
    { id: 'car_rental',   name: 'Car Rental',         ru: 'Прокат авто',        icon: 'car' },
    { id: 'attractions',  name: 'Attractions',        ru: 'Достопримечательн.', icon: 'ferris' },
    { id: 'travel_other', name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'education',     name: 'Education',           ru: 'Образование',        color: '#E9B384', icon: 'book',      subs: [
    { id: 'courses',      name: 'Courses',            ru: 'Курсы',              icon: 'cap' },
    { id: 'books',        name: 'Books',              ru: 'Книги',              icon: 'book' },
    { id: 'tutoring',     name: 'Tutoring',           ru: 'Репетиторы',         icon: 'book' },
    { id: 'school_fees',  name: 'School Fees',        ru: 'Школьные',           icon: 'backpack' },
    { id: 'edu_other',    name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'kids',          name: 'Kids',                ru: 'Дети',               color: '#E07A5F', icon: 'teddy',     subs: [
    { id: 'kindergarten', name: 'Kindergarten',       ru: 'Детский сад',        icon: 'teddy' },
    { id: 'kids_school',  name: 'School',             ru: 'Школа',              icon: 'backpack' },
    { id: 'kids_activities', name: 'Activities',      ru: 'Кружки',             icon: 'ball' },
    { id: 'toys',         name: 'Toys',               ru: 'Игрушки',            icon: 'teddy' },
    { id: 'baby',         name: 'Baby',               ru: 'Для малыша',         icon: 'teddy' },
    { id: 'kids_pocket',  name: 'Pocket Money',       ru: 'Карманные',          icon: 'coin' },
    { id: 'kids_other',   name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'pets',          name: 'Pets',                ru: 'Питомцы',            color: '#A8B89C', icon: 'paw',       subs: [
    { id: 'pet_food',     name: 'Pet Food',           ru: 'Корм',               icon: 'cart' },
    { id: 'vet',          name: 'Vet',                ru: 'Ветеринар',          icon: 'stethoscope' },
    { id: 'grooming',     name: 'Grooming',           ru: 'Уход за питомцем',   icon: 'scissors' },
    { id: 'pet_supplies', name: 'Supplies',           ru: 'Товары',             icon: 'bag' },
    { id: 'pets_other',   name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'gifts',         name: 'Gifts',               ru: 'Подарки',            color: '#C97B84', icon: 'gift',      subs: [
    { id: 'birthday_gifts', name: 'Birthday',         ru: 'Дни рождения',       icon: 'cake' },
    { id: 'holiday_gifts', name: 'Holidays',          ru: 'Праздники',          icon: 'palm' },
    { id: 'charity',      name: 'Charity',            ru: 'Благотворит.',       icon: 'hands' },
    { id: 'g_other',      name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'work',          name: 'Work',                ru: 'Работа',             color: '#8AA9D6', icon: 'briefcase', subs: [
    { id: 'office_supplies', name: 'Office Supplies', ru: 'Канцелярия',         icon: 'book' },
    { id: 'coworking',    name: 'Coworking',          ru: 'Коворкинг',          icon: 'building' },
    { id: 'work_equipment', name: 'Work Equipment',   ru: 'Оборудование',       icon: 'laptop' },
    { id: 'business_meals', name: 'Business Meals',   ru: 'Деловые обеды',      icon: 'plate' },
    { id: 'work_other',   name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'finance',       name: 'Finance',             ru: 'Финансы',            color: '#81B29A', icon: 'bank',      subs: [
    { id: 'insurance',    name: 'Insurance',          ru: 'Страховка',          icon: 'shield' },
    { id: 'bank_fees',    name: 'Bank Fees',          ru: 'Комиссии банка',     icon: 'bank' },
    { id: 'taxes',        name: 'Taxes',              ru: 'Налоги',             icon: 'receipt' },
    { id: 'investments',  name: 'Investments',        ru: 'Инвестиции',         icon: 'chart_up' },
    { id: 'fin_other',    name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
  { id: 'services',      name: 'Services',            ru: 'Услуги',             color: '#D4A574', icon: 'wrench',    subs: [
    { id: 'cleaning',     name: 'Cleaning',           ru: 'Уборка',             icon: 'broom' },
    { id: 'laundry',      name: 'Laundry',            ru: 'Прачечная',          icon: 'spray' },
    { id: 'postal',       name: 'Postal & Shipping',  ru: 'Почта',              icon: 'delivery' },
    { id: 'legal',        name: 'Legal',              ru: 'Юридические',        icon: 'receipt' },
    { id: 'svc_other',    name: 'Other',              ru: 'Прочее',             icon: 'box' },
  ]},
];

export const INCOME_TAXONOMY: TaxonomyEntry = {
  id: 'income', name: 'Income', ru: 'Доход', color: '#81B29A', icon: 'cash', subs: [
    { id: 'salary',       name: 'Salary',       ru: 'Зарплата',    icon: 'briefcase' },
    { id: 'freelance',    name: 'Freelance',    ru: 'Фриланс',     icon: 'laptop' },
    { id: 'business',     name: 'Business',     ru: 'Бизнес',      icon: 'chart_up' },
    { id: 'bonus',        name: 'Bonus',        ru: 'Бонус',       icon: 'star' },
    { id: 'in_gifts',     name: 'Gifts',        ru: 'Подарки',     icon: 'gift' },
    { id: 'refunds',      name: 'Refunds',      ru: 'Возвраты',    icon: 'refund' },
    { id: 'investments',  name: 'Investments',  ru: 'Инвестиции',  icon: 'chart_up' },
    { id: 'in_other',     name: 'Other',        ru: 'Прочее',      icon: 'box' },
  ],
};
