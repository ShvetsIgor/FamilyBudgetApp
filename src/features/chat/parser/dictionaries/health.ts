import type { ItemEntry } from './types';

export const HEALTH_ITEMS: Record<string, ItemEntry> = {

  // ── Pharmacy ──────────────────────────────────────────────────────────────
  'таблетки':         { categoryId: 'pharmacy' },
  'pills':             { categoryId: 'pharmacy' },
  'лекарства':        { categoryId: 'pharmacy' },
  'лекарство':        { categoryId: 'pharmacy' },
  'витамины':         { categoryId: 'pharmacy' },
  'medicine':         { categoryId: 'pharmacy' },
  'vitamins':         { categoryId: 'pharmacy' },
  'pharmacy':         { categoryId: 'pharmacy' },
  'תרופה':            { categoryId: 'pharmacy' },
  'בית מרקחת':        { categoryId: 'pharmacy' },

  // ── Doctors ───────────────────────────────────────────────────────────────
  'врач':             { categoryId: 'doctors' },
  'доктор':           { categoryId: 'doctors' },
  'клиника':          { categoryId: 'doctors' },
  'doctor':           { categoryId: 'doctors' },
  'clinic':           { categoryId: 'doctors' },
  'רופא':             { categoryId: 'doctors' },

  // ── Lab tests ─────────────────────────────────────────────────────────────
  'анализы':          { categoryId: 'lab_tests' },
  'lab tests':        { categoryId: 'lab_tests' },
  'בדיקות':           { categoryId: 'lab_tests' },

  // ── Dentist ───────────────────────────────────────────────────────────────
  'стоматолог':       { categoryId: 'dentist' },
  'дантист':          { categoryId: 'dentist' },
  'зубы':             { categoryId: 'dentist' },
  'dentist':          { categoryId: 'dentist' },
  'דנטיסט':           { categoryId: 'dentist' },

  // ── Gym ───────────────────────────────────────────────────────────────────
  'спортзал':         { categoryId: 'gym' },
  'фитнес':           { categoryId: 'gym' },
  'тренировка':       { categoryId: 'gym' },
  'абонемент':        { categoryId: 'gym' },
  'gym':              { categoryId: 'gym' },
  'fitness':          { categoryId: 'gym' },
  'workout':          { categoryId: 'gym' },
  'חדר כושר':         { categoryId: 'gym' },

  // ── Sports classes ────────────────────────────────────────────────────────
  'йога':             { categoryId: 'sports_classes' },
  'пилатес':          { categoryId: 'sports_classes' },
  'секция':           { categoryId: 'sports_classes' },
  'yoga':             { categoryId: 'sports_classes' },
  'pilates':          { categoryId: 'sports_classes' },

  // ── Sports equipment ──────────────────────────────────────────────────────
  'гантели':          { categoryId: 'sports_equip' },
  'dumbbells':        { categoryId: 'sports_equip' },
};
