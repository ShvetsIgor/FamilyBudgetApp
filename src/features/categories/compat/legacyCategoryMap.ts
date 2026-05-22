/**
 * Legacy category ID → current category ID mapping.
 * Used only in resetCategoriesToDefaults to remap old expense categoryIds
 * that predate the flat-category architecture.
 */
export const legacyCategoryMap: Record<string, string> = {
  food:           'groceries',
  home:           'household',
  transport:      'public_transport',
  entertainment:  'movies',
  shopping:       'clothing',
  health:         'pharmacy',
  education:      'courses',
  travel:         'flights',
  kids:           'toys',
  pets:           'pet_food',
  beauty:         'haircut',
  sport:          'gym',
  cafe:           'restaurants',
  gifts:          'gifts_given',
  finance:        'bank_fees',
  utilities:      'electricity',
  business:       'office_supplies',
  charity:        'donations',
  other:          'misc',
  income:         'salary',
};
