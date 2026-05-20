import type { ItemEntry } from './types';

export const HOME_ITEMS: Record<string, ItemEntry> = {

  // ── Rent / Mortgage ───────────────────────────────────────────────────────
  'аренда':           { categoryId: 'rent' },
  'квартплата':       { categoryId: 'rent' },
  'квартира':         { categoryId: 'rent' },
  'съем':             { categoryId: 'rent' },
  'rent':             { categoryId: 'rent' },
  'שכר דירה':         { categoryId: 'rent' },
  'ипотека':          { categoryId: 'mortgage' },
  'mortgage':         { categoryId: 'mortgage' },
  'משכנתא':           { categoryId: 'mortgage' },

  // ── Utilities ─────────────────────────────────────────────────────────────
  'электричество':    { categoryId: 'utilities' },
  'свет':             { categoryId: 'utilities' },
  'газ':              { categoryId: 'utilities' },
  'коммунальные':     { categoryId: 'utilities' },
  'electricity':      { categoryId: 'utilities' },
  'חשמל':             { categoryId: 'utilities' },
  'מים':              { categoryId: 'utilities' },
  'גז':               { categoryId: 'utilities' },

  // ── Internet / Mobile ─────────────────────────────────────────────────────
  'интернет':         { categoryId: 'internet' },
  'wifi':             { categoryId: 'internet' },
  'internet':         { categoryId: 'internet' },
  'אינטרנט':          { categoryId: 'internet' },
  'мобильная':        { categoryId: 'mobile_bill' },
  'мобильный':        { categoryId: 'mobile_bill' },
  'сотовый':          { categoryId: 'mobile_bill' },
  'mobile plan':      { categoryId: 'mobile_bill' },
  'cell phone':       { categoryId: 'mobile_bill' },

  // ── Furniture / Appliances ────────────────────────────────────────────────
  'мебель':           { categoryId: 'furniture' },
  'диван':            { categoryId: 'furniture' },
  'кровать':          { categoryId: 'furniture' },
  'стол':             { categoryId: 'furniture' },
  'шкаф':             { categoryId: 'furniture' },
  'furniture':        { categoryId: 'furniture' },
  'ריהוט':            { categoryId: 'furniture' },
  'холодильник':      { categoryId: 'appliances' },
  'стиральная':       { categoryId: 'appliances' },
  'духовка':          { categoryId: 'appliances' },
  'микроволновка':    { categoryId: 'appliances' },
  'кондиционер':      { categoryId: 'appliances' },
  'fridge':           { categoryId: 'appliances' },
  'washing machine':  { categoryId: 'appliances' },
  'air conditioner':  { categoryId: 'appliances' },
  'appliance':        { categoryId: 'appliances' },

  // ── Tools ─────────────────────────────────────────────────────────────────
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
  'מברגה':            { categoryId: 'tools' },
  'פטיש':             { categoryId: 'tools' },
  'מקדחה':            { categoryId: 'tools' },

  // ── Repairs ───────────────────────────────────────────────────────────────
  'ремонт':           { categoryId: 'repairs' },
  'repairs':          { categoryId: 'repairs' },
  'renovation':       { categoryId: 'repairs' },
  'תיקון':            { categoryId: 'repairs' },

  // ── Household supplies ────────────────────────────────────────────────────
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
  'שמפו':             { categoryId: 'household' },
  'סבון':             { categoryId: 'household' },

  // ── Arnona / Committee ────────────────────────────────────────────────────
  'арнона':           { categoryId: 'arnona' },
  'arnona':           { categoryId: 'arnona' },
  'ארנונה':           { categoryId: 'arnona' },
  'ваад':             { categoryId: 'committee' },
  'ועד בית':          { categoryId: 'committee' },
};
