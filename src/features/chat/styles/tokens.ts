export const C_THEME = {
  primary: 'hsl(var(--primary))',
  primaryDeep: 'hsl(var(--primary))',
  primaryTint: 'hsl(var(--primary) / 0.12)',
  sage: 'hsl(var(--success))',
  rose: 'hsl(var(--destructive))',
  caramel: 'hsl(var(--warn))',
  yellow: 'hsl(var(--warn))',
  lavender: 'hsl(var(--primary))',
  blueSoft: 'hsl(var(--primary) / 0.72)',
  olive: 'hsl(var(--success))',
  apricot: 'hsl(var(--warn))',

  bg: 'hsl(var(--background))',
  bgSoft: 'hsl(var(--muted))',
  card: 'hsl(var(--card))',
  cardTint: 'hsl(var(--card))',
  fg: 'hsl(var(--foreground))',
  sub: 'hsl(var(--muted-foreground))',
  hairline: 'hsl(var(--border))',
} as const;

export const C_LIGHT = C_THEME;
export const C_DARK = C_THEME;

/** Backward-compat static export - use useChatTokens() in React components instead. */
export const C = C_THEME;

export const SHADOW = {
  bubble: 'var(--shadow-sm)',
  card: 'var(--shadow-md)',
  user: 'var(--shadow-primary-sm)',
  pinned: 'var(--shadow-primary)',
} as const;

export const RAD = {
  chip: 'var(--radius-pill)',
  bubble: 'var(--radius-lg)',
  card: 'var(--radius-xl)',
  hero: 'var(--radius-xl)',
} as const;
