export const C_LIGHT = {
  primary:     '#E07A5F',
  primaryDeep: '#C9684E',
  primaryTint: '#FAEAE2',
  sage:        '#81B29A',
  rose:        '#C97B84',
  caramel:     '#D4A574',
  yellow:      '#F2CC8F',
  lavender:    '#A48BC9',
  blueSoft:    '#8AA9D6',
  olive:       '#A8B89C',
  apricot:     '#E9B384',

  bg:       '#FBF6EE',
  bgSoft:   '#F4ECDE',
  card:     '#FFFFFF',
  cardTint: '#FEFAF3',
  fg:       '#3D2C1F',
  sub:      '#8E7A66',
  hairline: '#EDE0CC',
} as const;

export const C_DARK = {
  primary:     '#E07A5F',
  primaryDeep: '#C9684E',
  primaryTint: '#3D1E14',
  sage:        '#81B29A',
  rose:        '#C97B84',
  caramel:     '#D4A574',
  yellow:      '#F2CC8F',
  lavender:    '#A48BC9',
  blueSoft:    '#8AA9D6',
  olive:       '#A8B89C',
  apricot:     '#E9B384',

  bg:       '#1C1510',
  bgSoft:   '#231A12',
  card:     '#2A1F17',
  cardTint: '#2E2318',
  fg:       '#F5EDE0',
  sub:      '#A09080',
  hairline: '#3D3028',
} as const;

/** Backward-compat static export — use useChatTokens() in React components instead. */
export const C = C_LIGHT;

export const SHADOW = {
  bubble: '0 1px 2px rgba(61,44,31,.05), 0 4px 14px rgba(61,44,31,.04)',
  card:   '0 1px 2px rgba(61,44,31,.06), 0 8px 22px rgba(61,44,31,.07)',
  user:   '0 4px 14px #C9684E30',
  pinned: '0 14px 28px #C9684E38',
} as const;

export const RAD = {
  chip:   '999px',
  bubble: '18px',
  card:   '22px',
  hero:   '26px',
} as const;
