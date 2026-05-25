/**
 * LAYER: preset — onboarding / seed data only.
 *
 * Provides blueprint definitions for initial category setup.
 * This is NOT runtime semantic authority — blueprints describe onboarding intent,
 * not live category state.
 *
 * Allowed consumers:
 *   - config/categoryLabels.ts  (builds alias map from blueprint IDs)
 *   - config/libraryConfig.ts   (exposes LIBRARY_FOLDERS for the add-from-library flow)
 *   - services/defaultCategories.ts  (expands blueprints into Firestore seed entries)
 *   - hooks/useConstructorState.ts   (constructor wizard state)
 *   - components/CategoriesHub.tsx   (library activation)
 *
 * Must NOT be used for:
 *   - Runtime icon resolution
 *   - Selector derivation
 *   - Category hierarchy traversal at runtime
 *   - Any code path that runs on every render or user action
 */

/** A preset folder that becomes a CategoryFolder in the app. */
export interface FolderBlueprint {
  id: string;
  name: string;
  ru?: string;
  icon: string;
  color: string;
}

/** A preset category that becomes a flat Category with folderId in the app. */
export interface CategoryBlueprint {
  id: string;
  folderId: string;
  name: string;
  ru?: string;
  icon: string;
  color: string;
}

// ─── Folder blueprints ────────────────────────────────────────────────────────
// Income folder is last — filter by `f.id !== 'income'` for expense-only flows.

export const FOLDER_BLUEPRINTS: readonly FolderBlueprint[] = [
  { id: 'food',          name: 'Supermarket',     ru: 'Супермаркет',     color: '#E07A5F', icon: 'cart'      },
  { id: 'dining',        name: 'Dining Out',      ru: 'Вне дома',        color: '#E07A5F', icon: 'plate'     },
  { id: 'home',          name: 'Home',            ru: 'Дом',             color: '#81B29A', icon: 'house'     },
  { id: 'transport',     name: 'Transport',       ru: 'Транспорт',       color: '#F2CC8F', icon: 'bus'       },
  { id: 'car',           name: 'Car',             ru: 'Машина',          color: '#8AA9D6', icon: 'car'       },
  { id: 'health',        name: 'Health',          ru: 'Здоровье',        color: '#C97B84', icon: 'heart'     },
  { id: 'sports',        name: 'Sports & Fitness',ru: 'Спорт',           color: '#81B29A', icon: 'dumbbell'  },
  { id: 'shopping',      name: 'Shopping',        ru: 'Покупки',         color: '#E9B384', icon: 'bag'       },
  { id: 'beauty',        name: 'Beauty',          ru: 'Красота',         color: '#C97B84', icon: 'lipstick'  },
  { id: 'technology',    name: 'Technology',      ru: 'Технологии',      color: '#8AA9D6', icon: 'laptop'    },
  { id: 'entertainment', name: 'Entertainment',   ru: 'Развлечения',     color: '#A8B89C', icon: 'cinema'    },
  { id: 'subscriptions', name: 'Subscriptions',   ru: 'Подписки',        color: '#8AA9D6', icon: 'tv'        },
  { id: 'travel',        name: 'Travel',          ru: 'Путешествия',     color: '#E07A5F', icon: 'plane'     },
  { id: 'education',     name: 'Education',       ru: 'Образование',     color: '#E9B384', icon: 'book'      },
  { id: 'kids',          name: 'Kids',            ru: 'Дети',            color: '#E07A5F', icon: 'teddy'     },
  { id: 'pets',          name: 'Pets',            ru: 'Питомцы',         color: '#A8B89C', icon: 'paw'       },
  { id: 'gifts',         name: 'Gifts',           ru: 'Подарки',         color: '#C97B84', icon: 'gift'      },
  { id: 'work',          name: 'Work',            ru: 'Работа',          color: '#8AA9D6', icon: 'briefcase' },
  { id: 'finance',       name: 'Finance',         ru: 'Финансы',         color: '#81B29A', icon: 'bank'      },
  { id: 'services',      name: 'Services',        ru: 'Услуги',          color: '#D4A574', icon: 'wrench'    },
  { id: 'income',        name: 'Income',          ru: 'Доход',           color: '#81B29A', icon: 'cash'      },
];

// ─── Category blueprints ──────────────────────────────────────────────────────
// Flat — no nesting. folderId links each category to its parent folder.
// color is inherited from the folder blueprint above.
// Filter by `c.folderId !== 'income'` for expense-only flows.

export const CATEGORY_BLUEPRINTS: readonly CategoryBlueprint[] = [
  // food
  { id: 'groceries',         folderId: 'food',          name: 'Groceries',          ru: 'Продукты',           icon: 'cart',        color: '#E07A5F' },
  { id: 'bakery',            folderId: 'food',          name: 'Bakery',             ru: 'Хлеб и выпечка',     icon: 'cart',        color: '#E07A5F' },
  { id: 'dairy',             folderId: 'food',          name: 'Dairy',              ru: 'Молочные',           icon: 'cart',        color: '#E07A5F' },
  { id: 'meat_fish',         folderId: 'food',          name: 'Meat & Fish',        ru: 'Мясо и рыба',        icon: 'cart',        color: '#E07A5F' },
  { id: 'fruits_veg',        folderId: 'food',          name: 'Fruits & Veg',       ru: 'Фрукты и овощи',     icon: 'cart',        color: '#E07A5F' },
  { id: 'restaurant',        folderId: 'dining',        name: 'Restaurant',         ru: 'Ресторан',           icon: 'plate',       color: '#E07A5F' },
  { id: 'coffee',            folderId: 'dining',        name: 'Coffee',             ru: 'Кофе',               icon: 'coffee',      color: '#E07A5F' },
  { id: 'fast_food',         folderId: 'dining',        name: 'Fast Food',          ru: 'Фастфуд',            icon: 'burger',      color: '#E07A5F' },
  { id: 'delivery',          folderId: 'dining',        name: 'Delivery',           ru: 'Доставка',           icon: 'delivery',    color: '#E07A5F' },
  { id: 'snacks',            folderId: 'dining',        name: 'Snacks',             ru: 'Снэки',              icon: 'icecream',    color: '#E07A5F' },
  { id: 'alcohol',           folderId: 'food',          name: 'Alcohol',            ru: 'Алкоголь',           icon: 'wine',        color: '#E07A5F' },
  { id: 'food_other',        folderId: 'food',          name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#E07A5F' },

  // home
  { id: 'rent',              folderId: 'home',          name: 'Rent',               ru: 'Аренда',             icon: 'key',         color: '#81B29A' },
  { id: 'mortgage',          folderId: 'home',          name: 'Mortgage',           ru: 'Ипотека',            icon: 'bank',        color: '#81B29A' },
  { id: 'utilities',         folderId: 'home',          name: 'Utilities',          ru: 'Коммунальные',       icon: 'lightning',   color: '#81B29A' },
  { id: 'internet',          folderId: 'home',          name: 'Internet',           ru: 'Интернет',           icon: 'wifi',        color: '#81B29A' },
  { id: 'mobile_bill',       folderId: 'home',          name: 'Mobile Plan',        ru: 'Мобильная',          icon: 'phone',       color: '#81B29A' },
  { id: 'furniture',         folderId: 'home',          name: 'Furniture',          ru: 'Мебель',             icon: 'couch',       color: '#81B29A' },
  { id: 'appliances',        folderId: 'home',          name: 'Appliances',         ru: 'Бытовая техника',    icon: 'lightning',   color: '#81B29A' },
  { id: 'repairs',           folderId: 'home',          name: 'Repairs',            ru: 'Ремонт',             icon: 'wrench',      color: '#81B29A' },
  { id: 'tools',             folderId: 'home',          name: 'Tools',              ru: 'Инструменты',        icon: 'wrench',      color: '#81B29A' },
  { id: 'household',         folderId: 'home',          name: 'Household',          ru: 'Хозтовары',          icon: 'spray',       color: '#81B29A' },
  { id: 'arnona',            folderId: 'home',          name: 'Arnona',             ru: 'Арнона',             icon: 'receipt',     color: '#81B29A' },
  { id: 'committee',         folderId: 'home',          name: 'Building Committee', ru: 'Ваад баит',          icon: 'building',    color: '#81B29A' },
  { id: 'home_other',        folderId: 'home',          name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#81B29A' },

  // transport
  { id: 'public_transport',  folderId: 'transport',     name: 'Public Transport',   ru: 'Общ. транспорт',     icon: 'bus',         color: '#F2CC8F' },
  { id: 'taxi',              folderId: 'transport',     name: 'Taxi',               ru: 'Такси',              icon: 'taxi',        color: '#F2CC8F' },
  { id: 'train',             folderId: 'transport',     name: 'Train',              ru: 'Поезд',              icon: 'train',       color: '#F2CC8F' },
  { id: 'bus_pass',          folderId: 'transport',     name: 'Transit Pass',       ru: 'Проездной',          icon: 'card',        color: '#F2CC8F' },
  { id: 'tr_other',          folderId: 'transport',     name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#F2CC8F' },

  // car
  { id: 'fuel',              folderId: 'car',           name: 'Fuel',               ru: 'Бензин',             icon: 'fuel',        color: '#8AA9D6' },
  { id: 'parking',           folderId: 'car',           name: 'Parking',            ru: 'Парковка',           icon: 'parking',     color: '#8AA9D6' },
  { id: 'car_service',       folderId: 'car',           name: 'Car Service',        ru: 'ТО',                 icon: 'wrench',      color: '#8AA9D6' },
  { id: 'car_insurance',     folderId: 'car',           name: 'Car Insurance',      ru: 'Страховка',          icon: 'shield',      color: '#8AA9D6' },
  { id: 'car_wash',          folderId: 'car',           name: 'Car Wash',           ru: 'Мойка',              icon: 'carwash',     color: '#8AA9D6' },
  { id: 'car_tax',           folderId: 'car',           name: 'Car Tax',            ru: 'Налог',              icon: 'receipt',     color: '#8AA9D6' },
  { id: 'car_other',         folderId: 'car',           name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#8AA9D6' },

  // health
  { id: 'pharmacy',          folderId: 'health',        name: 'Pharmacy',           ru: 'Аптека',             icon: 'pill',        color: '#C97B84' },
  { id: 'doctors',           folderId: 'health',        name: 'Doctors',            ru: 'Врачи',              icon: 'stethoscope', color: '#C97B84' },
  { id: 'dentist',           folderId: 'health',        name: 'Dentist',            ru: 'Стоматолог',         icon: 'tooth',       color: '#C97B84' },
  { id: 'h_insurance',       folderId: 'health',        name: 'Health Insurance',   ru: 'Страховка',          icon: 'shield',      color: '#C97B84' },
  { id: 'lab_tests',         folderId: 'health',        name: 'Lab Tests',          ru: 'Анализы',            icon: 'receipt',     color: '#C97B84' },
  { id: 'h_other',           folderId: 'health',        name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#C97B84' },

  // sports
  { id: 'gym',               folderId: 'sports',        name: 'Gym',                ru: 'Спортзал',           icon: 'dumbbell',    color: '#81B29A' },
  { id: 'sports_classes',    folderId: 'sports',        name: 'Classes',            ru: 'Тренировки',         icon: 'ball',        color: '#81B29A' },
  { id: 'sports_equip',      folderId: 'sports',        name: 'Equipment',          ru: 'Инвентарь',          icon: 'ball',        color: '#81B29A' },
  { id: 'outdoor',           folderId: 'sports',        name: 'Outdoor',            ru: 'На воздухе',         icon: 'compass',     color: '#81B29A' },
  { id: 'sports_other',      folderId: 'sports',        name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#81B29A' },

  // shopping
  { id: 'clothes',           folderId: 'shopping',      name: 'Clothes',            ru: 'Одежда',             icon: 'shirt',       color: '#E9B384' },
  { id: 'shoes',             folderId: 'shopping',      name: 'Shoes',              ru: 'Обувь',              icon: 'bag',         color: '#E9B384' },
  { id: 'accessories',       folderId: 'shopping',      name: 'Accessories',        ru: 'Аксессуары',         icon: 'watch',       color: '#E9B384' },
  { id: 'online_shopping',   folderId: 'shopping',      name: 'Online Shopping',    ru: 'Онлайн',             icon: 'online',      color: '#E9B384' },
  { id: 'home_goods',        folderId: 'shopping',      name: 'Home Goods',         ru: 'Для дома',           icon: 'couch',       color: '#E9B384' },
  { id: 'sh_other',          folderId: 'shopping',      name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#E9B384' },

  // beauty
  { id: 'haircut',           folderId: 'beauty',        name: 'Haircut',            ru: 'Стрижка',            icon: 'scissors',    color: '#C97B84' },
  { id: 'cosmetics',         folderId: 'beauty',        name: 'Cosmetics',          ru: 'Косметика',          icon: 'lipstick',    color: '#C97B84' },
  { id: 'spa_massage',       folderId: 'beauty',        name: 'Spa & Massage',      ru: 'Спа и массаж',       icon: 'heart',       color: '#C97B84' },
  { id: 'manicure',          folderId: 'beauty',        name: 'Manicure',           ru: 'Маникюр',            icon: 'lipstick',    color: '#C97B84' },
  { id: 'beauty_other',      folderId: 'beauty',        name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#C97B84' },

  // technology
  { id: 'electronics',       folderId: 'technology',    name: 'Electronics',        ru: 'Электроника',        icon: 'laptop',      color: '#8AA9D6' },
  { id: 'gadgets',           folderId: 'technology',    name: 'Gadgets',            ru: 'Гаджеты',            icon: 'phone',       color: '#8AA9D6' },
  { id: 'software',          folderId: 'technology',    name: 'Software',           ru: 'Программы',          icon: 'laptop',      color: '#8AA9D6' },
  { id: 'phone_acc',         folderId: 'technology',    name: 'Phone Accessories',  ru: 'Аксессуары',         icon: 'phone',       color: '#8AA9D6' },
  { id: 'tech_other',        folderId: 'technology',    name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#8AA9D6' },

  // entertainment
  { id: 'movies',            folderId: 'entertainment', name: 'Movies & Shows',     ru: 'Кино',               icon: 'cinema',      color: '#A8B89C' },
  { id: 'events',            folderId: 'entertainment', name: 'Events',             ru: 'Мероприятия',        icon: 'ticket',      color: '#A8B89C' },
  { id: 'hobbies',           folderId: 'entertainment', name: 'Hobbies',            ru: 'Хобби',              icon: 'brush',       color: '#A8B89C' },
  { id: 'parks',             folderId: 'entertainment', name: 'Parks & Attractions',ru: 'Парки',              icon: 'ferris',      color: '#A8B89C' },
  { id: 'games',             folderId: 'entertainment', name: 'Games',              ru: 'Игры',               icon: 'controller',  color: '#A8B89C' },
  { id: 'ent_other',         folderId: 'entertainment', name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#A8B89C' },

  // subscriptions
  { id: 'streaming',         folderId: 'subscriptions', name: 'Streaming',          ru: 'Стриминг',           icon: 'tv',          color: '#8AA9D6' },
  { id: 'music_sub',         folderId: 'subscriptions', name: 'Music',              ru: 'Музыка',             icon: 'music',       color: '#8AA9D6' },
  { id: 'cloud_storage',     folderId: 'subscriptions', name: 'Cloud Storage',      ru: 'Облако',             icon: 'cloud',       color: '#8AA9D6' },
  { id: 'software_sub',      folderId: 'subscriptions', name: 'Software',           ru: 'Программы',          icon: 'laptop',      color: '#8AA9D6' },
  { id: 'sub_other',         folderId: 'subscriptions', name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#8AA9D6' },

  // travel
  { id: 'flights',           folderId: 'travel',        name: 'Flights',            ru: 'Перелёты',           icon: 'plane',       color: '#E07A5F' },
  { id: 'hotels',            folderId: 'travel',        name: 'Hotels',             ru: 'Отели',              icon: 'bed',         color: '#E07A5F' },
  { id: 'car_rental',        folderId: 'travel',        name: 'Car Rental',         ru: 'Прокат авто',        icon: 'car',         color: '#E07A5F' },
  { id: 'attractions',       folderId: 'travel',        name: 'Attractions',        ru: 'Достопримечательн.', icon: 'ferris',      color: '#E07A5F' },
  { id: 'travel_other',      folderId: 'travel',        name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#E07A5F' },

  // education
  { id: 'courses',           folderId: 'education',     name: 'Courses',            ru: 'Курсы',              icon: 'cap',         color: '#E9B384' },
  { id: 'books',             folderId: 'education',     name: 'Books',              ru: 'Книги',              icon: 'book',        color: '#E9B384' },
  { id: 'tutoring',          folderId: 'education',     name: 'Tutoring',           ru: 'Репетиторы',         icon: 'book',        color: '#E9B384' },
  { id: 'school_fees',       folderId: 'education',     name: 'School Fees',        ru: 'Школьные',           icon: 'backpack',    color: '#E9B384' },
  { id: 'edu_other',         folderId: 'education',     name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#E9B384' },

  // kids
  { id: 'kindergarten',      folderId: 'kids',          name: 'Kindergarten',       ru: 'Детский сад',        icon: 'teddy',       color: '#E07A5F' },
  { id: 'kids_school',       folderId: 'kids',          name: 'School',             ru: 'Школа',              icon: 'backpack',    color: '#E07A5F' },
  { id: 'kids_activities',   folderId: 'kids',          name: 'Activities',         ru: 'Кружки',             icon: 'ball',        color: '#E07A5F' },
  { id: 'toys',              folderId: 'kids',          name: 'Toys',               ru: 'Игрушки',            icon: 'teddy',       color: '#E07A5F' },
  { id: 'baby',              folderId: 'kids',          name: 'Baby',               ru: 'Для малыша',         icon: 'teddy',       color: '#E07A5F' },
  { id: 'kids_pocket',       folderId: 'kids',          name: 'Pocket Money',       ru: 'Карманные',          icon: 'coin',        color: '#E07A5F' },
  { id: 'kids_other',        folderId: 'kids',          name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#E07A5F' },

  // pets
  { id: 'pet_food',          folderId: 'pets',          name: 'Pet Food',           ru: 'Корм',               icon: 'cart',        color: '#A8B89C' },
  { id: 'vet',               folderId: 'pets',          name: 'Vet',                ru: 'Ветеринар',          icon: 'stethoscope', color: '#A8B89C' },
  { id: 'grooming',          folderId: 'pets',          name: 'Grooming',           ru: 'Уход за питомцем',   icon: 'scissors',    color: '#A8B89C' },
  { id: 'pet_supplies',      folderId: 'pets',          name: 'Supplies',           ru: 'Товары',             icon: 'bag',         color: '#A8B89C' },
  { id: 'pets_other',        folderId: 'pets',          name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#A8B89C' },

  // gifts
  { id: 'birthday_gifts',    folderId: 'gifts',         name: 'Birthday',           ru: 'Дни рождения',       icon: 'cake',        color: '#C97B84' },
  { id: 'holiday_gifts',     folderId: 'gifts',         name: 'Holidays',           ru: 'Праздники',          icon: 'palm',        color: '#C97B84' },
  { id: 'charity',           folderId: 'gifts',         name: 'Charity',            ru: 'Благотворит.',       icon: 'hands',       color: '#C97B84' },
  { id: 'g_other',           folderId: 'gifts',         name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#C97B84' },

  // work
  { id: 'office_supplies',   folderId: 'work',          name: 'Office Supplies',    ru: 'Канцелярия',         icon: 'book',        color: '#8AA9D6' },
  { id: 'coworking',         folderId: 'work',          name: 'Coworking',          ru: 'Коворкинг',          icon: 'building',    color: '#8AA9D6' },
  { id: 'work_equipment',    folderId: 'work',          name: 'Work Equipment',     ru: 'Оборудование',       icon: 'laptop',      color: '#8AA9D6' },
  { id: 'business_meals',    folderId: 'work',          name: 'Business Meals',     ru: 'Деловые обеды',      icon: 'plate',       color: '#8AA9D6' },
  { id: 'work_other',        folderId: 'work',          name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#8AA9D6' },

  // finance
  { id: 'insurance',         folderId: 'finance',       name: 'Insurance',          ru: 'Страховка',          icon: 'shield',      color: '#81B29A' },
  { id: 'bank_fees',         folderId: 'finance',       name: 'Bank Fees',          ru: 'Комиссии банка',     icon: 'bank',        color: '#81B29A' },
  { id: 'taxes',             folderId: 'finance',       name: 'Taxes',              ru: 'Налоги',             icon: 'receipt',     color: '#81B29A' },
  { id: 'investments',       folderId: 'finance',       name: 'Investments',        ru: 'Инвестиции',         icon: 'chart_up',    color: '#81B29A' },
  { id: 'fin_other',         folderId: 'finance',       name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#81B29A' },

  // services
  { id: 'cleaning',          folderId: 'services',      name: 'Cleaning',           ru: 'Уборка',             icon: 'broom',       color: '#D4A574' },
  { id: 'laundry',           folderId: 'services',      name: 'Laundry',            ru: 'Прачечная',          icon: 'spray',       color: '#D4A574' },
  { id: 'postal',            folderId: 'services',      name: 'Postal & Shipping',  ru: 'Почта',              icon: 'delivery',    color: '#D4A574' },
  { id: 'legal',             folderId: 'services',      name: 'Legal',              ru: 'Юридические',        icon: 'receipt',     color: '#D4A574' },
  { id: 'svc_other',         folderId: 'services',      name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#D4A574' },

  // income
  { id: 'salary',            folderId: 'income',        name: 'Salary',             ru: 'Зарплата',           icon: 'briefcase',   color: '#81B29A' },
  { id: 'freelance',         folderId: 'income',        name: 'Freelance',          ru: 'Фриланс',            icon: 'laptop',      color: '#81B29A' },
  { id: 'business',          folderId: 'income',        name: 'Business',           ru: 'Бизнес',             icon: 'chart_up',    color: '#81B29A' },
  { id: 'bonus',             folderId: 'income',        name: 'Bonus',              ru: 'Бонус',              icon: 'star',        color: '#81B29A' },
  { id: 'in_gifts',          folderId: 'income',        name: 'Gifts',              ru: 'Подарки',            icon: 'gift',        color: '#81B29A' },
  { id: 'refunds',           folderId: 'income',        name: 'Refunds',            ru: 'Возвраты',           icon: 'refund',      color: '#81B29A' },
  { id: 'investments',       folderId: 'income',        name: 'Investments',        ru: 'Инвестиции',         icon: 'chart_up',    color: '#81B29A' },
  { id: 'in_other',          folderId: 'income',        name: 'Other',              ru: 'Прочее',             icon: 'box',         color: '#81B29A' },
];

/** Returns preset category blueprints belonging to a given folder slug. */
export function getPresetCategoriesForFolder(folderId: string): readonly CategoryBlueprint[] {
  return CATEGORY_BLUEPRINTS.filter((c) => c.folderId === folderId);
}
