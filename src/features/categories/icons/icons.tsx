import React from 'react';

/**
 * Family Budget — Outline icon set (v2 · Mist + Paper compatible)
 *
 * Drop-in replacement for the sticker-style `icons.tsx`. Same exports
 * (`I`, `IconKey`, `IconProps`) and same icon names so any existing
 * `<CategoryIcon icon="cart" .../>` keeps working — only the rendering
 * changes from playful stickers to clean outline glyphs.
 *
 * Strokes use `currentColor`-style approach via the `c` prop. Each icon
 * is a single monochrome outline rendered at 32×32 (matches v1 viewBox
 * so chip/tile sizes don't need to change). `id` is kept in the props
 * signature for API compatibility but unused (no gradient).
 *
 * Usage stays identical:
 *
 *   const Icon = I[catKey] ?? I.box;
 *   <Icon c={category.color} id={catKey} />
 *
 * Theme-aware tinting happens at the wrapper level (the `.fb-cat-chip`
 * background uses the category --cat-*-tint var, while the icon stroke
 * uses the matching --cat-* solid). Both come from the active theme.
 */

interface IconProps { c: string; id: string }

const out = (c: string) => ({
  viewBox: '0 0 32 32',
  fill: 'none' as const,
  stroke: c,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/* eslint-disable react/display-name */
export const I: Record<string, (props: IconProps) => React.ReactElement> = {};

/* ───── MONEY / INCOME ───── */
I.briefcase = ({ c }) => <svg {...out(c)}>
  <path d="M5 11h22a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2Z"/>
  <path d="M12 11V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/>
  <path d="M3 18h26"/>
</svg>;
I.cash = ({ c }) => <svg {...out(c)}>
  <rect x="3" y="9" width="26" height="14" rx="2"/>
  <circle cx="16" cy="16" r="4"/>
  <path d="M16 14v4M14.5 15.5h3M14.5 16.5h3" strokeWidth="1.5"/>
</svg>;
I.card = ({ c }) => <svg {...out(c)}>
  <rect x="3" y="7" width="26" height="18" rx="3"/>
  <path d="M3 13h26M7 19h5"/>
</svg>;
I.coin = ({ c }) => <svg {...out(c)}>
  <circle cx="16" cy="16" r="11"/>
  <path d="M16 9v14M12 12.5h6.5a2.5 2.5 0 0 1 0 5h-5a2.5 2.5 0 0 0 0 5H20"/>
</svg>;
I.piggy = ({ c }) => <svg {...out(c)}>
  <path d="M5 17a10 6 0 0 1 16-4.6"/>
  <path d="M21 12.4A4 4 0 0 1 25 16h3v4h-3a4 4 0 0 1-2 3.4V26h-3v-2h-7v2H10v-2.6a10 6 0 0 1-5-5.4"/>
  <circle cx="22.5" cy="15.5" r="1" fill={c} stroke="none"/>
  <path d="M14 12h4"/>
</svg>;
I.gift = ({ c }) => <svg {...out(c)}>
  <rect x="3" y="11" width="26" height="5"/>
  <path d="M5 16v11h22V16"/>
  <path d="M16 11v16"/>
  <path d="M16 11s-2-6-5.5-6a2.5 2.5 0 0 0 0 5H16M16 11s2-6 5.5-6a2.5 2.5 0 0 1 0 5H16"/>
</svg>;
I.chart_up = ({ c }) => <svg {...out(c)}>
  <rect x="3" y="5" width="26" height="22" rx="3"/>
  <path d="M8 20l5-5 4 4 7-7"/>
  <path d="M20 12h4v4"/>
</svg>;
I.star = ({ c }) => <svg {...out(c)}>
  <path d="M16 4l3.5 7.5L28 13l-6 5.5 1.5 8.5L16 23l-7.5 4 1.5-8.5L4 13l8.5-1.5z"/>
</svg>;
I.refund = ({ c }) => <svg {...out(c)}>
  <circle cx="16" cy="16" r="11.5"/>
  <path d="M22 12a7 7 0 1 0 0 8"/>
  <path d="M22 7v5h-5"/>
</svg>;

/* ───── GROCERIES ───── */
I.cart = ({ c }) => <svg {...out(c)}>
  <path d="M3 5h4l3 16h14l2-11H9"/>
  <circle cx="12" cy="25" r="2"/>
  <circle cx="22" cy="25" r="2"/>
</svg>;
I.wine = ({ c }) => <svg {...out(c)}>
  <path d="M9 4h14l-1.5 9a6 6 0 0 1-11 0z"/>
  <path d="M16 19v8M11 27h10"/>
</svg>;
I.spray = ({ c }) => <svg {...out(c)}>
  <rect x="11" y="11" width="10" height="17" rx="2"/>
  <rect x="13" y="4" width="6" height="7" rx="1"/>
  <path d="M22 6h3M22 9h3M22 12h3"/>
</svg>;
I.broom = ({ c }) => <svg {...out(c)}>
  <path d="M19 3l-7 12"/>
  <path d="M5 28l9-13 6 6-7 9z"/>
  <path d="M9 23l3 3M12 20l3 3M15 17l3 3"/>
</svg>;

/* ───── DINING OUT ───── */
I.plate = ({ c }) => <svg {...out(c)}>
  <circle cx="16" cy="16" r="11"/>
  <circle cx="16" cy="16" r="6"/>
</svg>;
I.coffee = ({ c }) => <svg {...out(c)}>
  <path d="M4 11h17v10a6 6 0 0 1-6 6h-5a6 6 0 0 1-6-6z"/>
  <path d="M21 14h2a3 3 0 0 1 0 6h-2"/>
  <path d="M8 4v3M12 4v3M16 4v3"/>
</svg>;
I.delivery = ({ c }) => <svg {...out(c)}>
  <path d="M8 7h16l-2 18H10z"/>
  <path d="M12 7a4 4 0 0 1 8 0"/>
  <path d="M13 13h6M13 17h6"/>
</svg>;
I.burger = ({ c }) => <svg {...out(c)}>
  <path d="M4 12a12 6 0 0 1 24 0z"/>
  <path d="M4 16h24M4 20h24"/>
  <path d="M4 22a12 5 0 0 0 24 0"/>
</svg>;
I.icecream = ({ c }) => <svg {...out(c)}>
  <path d="M9 12a7 7 0 0 1 14 0z"/>
  <path d="M9 12h14l-7 16z"/>
  <path d="M11 17l10 0M13 22l6 0"/>
</svg>;

/* ───── ENTERTAINMENT ───── */
I.cinema = ({ c }) => <svg {...out(c)}>
  <rect x="3" y="6" width="26" height="20" rx="2"/>
  <path d="M3 12h26M9 6v20M23 6v20"/>
  <path d="M6 9h1M6 15h1M6 21h1M25 9h1M25 15h1M25 21h1"/>
</svg>;
I.ferris = ({ c }) => <svg {...out(c)}>
  <circle cx="16" cy="14" r="11"/>
  <circle cx="16" cy="14" r="2"/>
  <path d="M16 3v8M16 17v8M5 14h8M19 14h8M8 6l5.7 5.7M18.3 16.3L24 22M8 22l5.7-5.7M18.3 11.7L24 6"/>
  <path d="M10 25l6 4 6-4"/>
</svg>;
I.compass = ({ c }) => <svg {...out(c)}>
  <circle cx="16" cy="16" r="11.5"/>
  <path d="M21 11l-3 8-8 3 3-8z"/>
  <circle cx="16" cy="16" r="1.2" fill={c} stroke="none"/>
</svg>;
I.ticket = ({ c }) => <svg {...out(c)}>
  <path d="M3 10v3a3 3 0 0 1 0 6v3h26v-3a3 3 0 0 1 0-6v-3z"/>
  <path d="M14 11v10" strokeDasharray="2 2"/>
</svg>;
I.brush = ({ c }) => <svg {...out(c)}>
  <path d="M22 3l7 7-10 10"/>
  <path d="M19 20l-4-4-8 8a2.8 2.8 0 0 0 4 4z"/>
  <path d="M7 26l4 0" strokeWidth="1.5"/>
</svg>;

/* ───── HOME / BILLS ───── */
I.house = ({ c }) => <svg {...out(c)}>
  <path d="M4 15L16 5l12 10v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
  <path d="M13 27v-7h6v7"/>
</svg>;
I.key = ({ c }) => <svg {...out(c)}>
  <circle cx="10" cy="14" r="6"/>
  <path d="M14 14h15v3M22 14v6M26 14v4"/>
</svg>;
I.bank = ({ c }) => <svg {...out(c)}>
  <path d="M3 11L16 5l13 6"/>
  <path d="M3 11v2h26v-2"/>
  <path d="M6 14v9M11 14v9M16 14v9M21 14v9M26 14v9"/>
  <path d="M3 26h26"/>
</svg>;
I.lightning = ({ c }) => <svg {...out(c)}>
  <path d="M18 3L8 18h7l-2 11 10-15h-7z"/>
</svg>;
I.drop = ({ c }) => <svg {...out(c)}>
  <path d="M16 3c-7 9-10 14-10 17a10 10 0 0 0 20 0c0-3-3-8-10-17z"/>
</svg>;
I.wifi = ({ c }) => <svg {...out(c)}>
  <path d="M2 11a20 20 0 0 1 28 0"/>
  <path d="M6 16a14 14 0 0 1 20 0"/>
  <path d="M10 21a8 8 0 0 1 12 0"/>
  <circle cx="16" cy="26" r="1.5" fill={c} stroke="none"/>
</svg>;
I.phone = ({ c }) => <svg {...out(c)}>
  <rect x="9" y="3" width="14" height="26" rx="3"/>
  <path d="M14 25h4" strokeWidth="1.5"/>
</svg>;
I.receipt = ({ c }) => <svg {...out(c)}>
  <path d="M6 4h20v25l-3-2-3 2-4-2-4 2-3-2-3 2z"/>
  <path d="M10 9h12M10 13h12M10 17h8"/>
</svg>;
I.building = ({ c }) => <svg {...out(c)}>
  <rect x="6" y="3" width="20" height="26" rx="1"/>
  <path d="M10 8h2M10 13h2M10 18h2M16 8h2M16 13h2M16 18h2M20 8h2M20 13h2M20 18h2"/>
  <path d="M13 29v-6h6v6"/>
</svg>;
I.couch = ({ c }) => <svg {...out(c)}>
  <path d="M3 16a3 3 0 0 1 6 0v4h14v-4a3 3 0 0 1 6 0v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  <path d="M9 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6"/>
  <path d="M6 24v3M26 24v3"/>
</svg>;
I.bag = ({ c }) => <svg {...out(c)}>
  <path d="M7 11h18l-2 18H9z"/>
  <path d="M11 11V8a5 5 0 0 1 10 0v3"/>
</svg>;
I.wrench = ({ c }) => <svg {...out(c)}>
  <path d="M23 4a6 6 0 0 0-7 7.4L4 23l5 5 11.6-12A6 6 0 0 0 28 9l-4 4-3-3z"/>
</svg>;

/* ───── CAR / TRANSPORT ───── */
I.car = ({ c }) => <svg {...out(c)}>
  <path d="M5 18l2-7a3 3 0 0 1 3-2h12a3 3 0 0 1 3 2l2 7v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2H9v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>
  <path d="M5 18h22"/>
  <circle cx="9" cy="21" r="1.5"/>
  <circle cx="23" cy="21" r="1.5"/>
</svg>;
I.fuel = ({ c }) => <svg {...out(c)}>
  <rect x="6" y="6" width="13" height="22" rx="2"/>
  <rect x="9" y="9" width="7" height="7"/>
  <path d="M19 12h4l2 2v9a2 2 0 0 1-4 0v-3h-2"/>
</svg>;
I.shield = ({ c }) => <svg {...out(c)}>
  <path d="M16 3l11 4v8c0 7-5 12-11 14-6-2-11-7-11-14V7z"/>
  <path d="M11 15l4 4 7-7"/>
</svg>;
I.parking = ({ c }) => <svg {...out(c)}>
  <rect x="4" y="4" width="24" height="24" rx="4"/>
  <path d="M12 8v16M12 8h6a4 4 0 0 1 0 8h-6"/>
</svg>;
I.carwash = ({ c }) => <svg {...out(c)}>
  <path d="M6 6q1-2 2 0t2 0t2 0t2 0t2 0t2 0t2 0t2 0t2 0"/>
  <path d="M5 22l2-5a2 2 0 0 1 2-1h14a2 2 0 0 1 2 1l2 5v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2H9v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>
  <circle cx="9" cy="24" r="1.5"/>
  <circle cx="23" cy="24" r="1.5"/>
</svg>;
I.bus = ({ c }) => <svg {...out(c)}>
  <rect x="5" y="5" width="22" height="18" rx="3"/>
  <path d="M5 17h22"/>
  <rect x="8" y="8" width="6" height="5" rx="1"/>
  <rect x="18" y="8" width="6" height="5" rx="1"/>
  <circle cx="10" cy="25" r="1.5"/>
  <circle cx="22" cy="25" r="1.5"/>
  <path d="M5 11h-2M27 11h2"/>
</svg>;
I.taxi = ({ c }) => <svg {...out(c)}>
  <path d="M11 3h10v3H11z"/>
  <path d="M5 18l2-7a3 3 0 0 1 3-2h12a3 3 0 0 1 3 2l2 7v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2H9v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>
  <path d="M5 18h22M13 12v3M19 12v3"/>
  <circle cx="9" cy="21" r="1.5"/>
  <circle cx="23" cy="21" r="1.5"/>
</svg>;
I.train = ({ c }) => <svg {...out(c)}>
  <rect x="6" y="3" width="20" height="22" rx="4"/>
  <path d="M6 14h20"/>
  <rect x="9" y="6" width="6" height="6" rx="1"/>
  <rect x="17" y="6" width="6" height="6" rx="1"/>
  <circle cx="11" cy="18" r="1" fill={c} stroke="none"/>
  <circle cx="21" cy="18" r="1" fill={c} stroke="none"/>
  <path d="M9 28l-2 2M23 28l2 2"/>
</svg>;

/* ───── TRAVEL ───── */
I.plane = ({ c }) => <svg {...out(c)}>
  <path d="M16 3l3 11h9v3l-9 2v6l3 2v2l-6-2-6 2v-2l3-2v-6l-9-2v-3h9z"/>
</svg>;
I.bed = ({ c }) => <svg {...out(c)}>
  <path d="M4 21V8M4 14h24v7M28 21v4M4 25v-4"/>
  <rect x="7" y="11" width="8" height="5" rx="1.5"/>
</svg>;
I.suitcase = ({ c }) => <svg {...out(c)}>
  <rect x="4" y="9" width="24" height="19" rx="2"/>
  <path d="M12 9V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v4"/>
  <path d="M16 13v11" strokeWidth="1.5"/>
</svg>;

/* ───── HEALTH ───── */
I.heart = ({ c }) => <svg {...out(c)}>
  <path d="M16 27c-8-5-12-11-12-15a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 4-4 10-12 15z"/>
  <path d="M16 11v8M12 15h8"/>
</svg>;
I.pill = ({ c }) => <svg {...out(c)}>
  <rect x="3" y="11" width="26" height="10" rx="5" transform="rotate(-30 16 16)"/>
  <path d="M8 12l7 7" transform="rotate(-30 16 16)"/>
</svg>;
I.stethoscope = ({ c }) => <svg {...out(c)}>
  <path d="M9 4v8a6 6 0 0 0 12 0V4"/>
  <path d="M9 4h-1M9 4h1M21 4h-1M21 4h1"/>
  <path d="M15 18v3a5 5 0 0 0 5 5 4 4 0 0 0 4-4v-2"/>
  <circle cx="24" cy="20" r="3"/>
</svg>;
I.tooth = ({ c }) => <svg {...out(c)}>
  <path d="M9 4q-5 1-5 8 0 8 4 16 2 3 4-1l1-6q1-3 3-3t3 3l1 6q2 4 4 1 4-8 4-16 0-7-5-8-5-1-7 2-2-3-7-2z"/>
</svg>;
I.dumbbell = ({ c }) => <svg {...out(c)}>
  <rect x="2" y="12" width="4" height="8" rx="1"/>
  <rect x="26" y="12" width="4" height="8" rx="1"/>
  <rect x="6" y="14" width="20" height="4"/>
  <path d="M6 10v12M26 10v12"/>
</svg>;

/* ───── SHOPPING ───── */
I.shirt = ({ c }) => <svg {...out(c)}>
  <path d="M4 11l8-7 4 3 4-3 8 7-3 5-3-1v13H10V15l-3 1z"/>
</svg>;
I.laptop = ({ c }) => <svg {...out(c)}>
  <rect x="5" y="5" width="22" height="15" rx="2"/>
  <path d="M3 23h26l-1 3H4z"/>
</svg>;
I.lipstick = ({ c }) => <svg {...out(c)}>
  <path d="M12 4h8l-1 9h-6z"/>
  <rect x="11" y="13" width="10" height="3" rx="0.5"/>
  <rect x="12" y="16" width="8" height="12" rx="1"/>
</svg>;
I.online = ({ c }) => <svg {...out(c)}>
  <rect x="3" y="5" width="26" height="17" rx="2"/>
  <path d="M12 26h8l1 3H11z"/>
  <path d="M8 11l4 4 3-3 4 4 5-5"/>
</svg>;
I.watch = ({ c }) => <svg {...out(c)}>
  <rect x="8" y="9" width="16" height="14" rx="3"/>
  <path d="M11 9V4h10v5M11 23v5h10v-5"/>
  <path d="M16 14v3l2 2"/>
</svg>;

/* ───── KIDS ───── */
I.ball = ({ c }) => <svg {...out(c)}>
  <circle cx="16" cy="16" r="11.5"/>
  <path d="M16 4.5L19 10l-3 4-3-4zM4.5 16l5.5-3 4 3-4 3zM27.5 16l-5.5-3-4 3 4 3zM16 27.5l-3-5.5 3-4 3 4z"/>
  <path d="M13 11l3 3 3-3M11 19l5-3 5 3M13 22l3-3 3 3"/>
</svg>;
I.backpack = ({ c }) => <svg {...out(c)}>
  <path d="M11 4a5 5 0 0 1 10 0"/>
  <rect x="6" y="6" width="20" height="22" rx="4"/>
  <path d="M6 14h20M11 18h10v4H11z"/>
</svg>;
I.teddy = ({ c }) => <svg {...out(c)}>
  <circle cx="9" cy="8" r="3"/>
  <circle cx="23" cy="8" r="3"/>
  <circle cx="16" cy="17" r="10"/>
  <circle cx="13" cy="15" r="1" fill={c} stroke="none"/>
  <circle cx="19" cy="15" r="1" fill={c} stroke="none"/>
  <path d="M14 20q2 2 4 0"/>
</svg>;
I.book = ({ c }) => <svg {...out(c)}>
  <path d="M5 5h17a4 4 0 0 1 4 4v18a3 3 0 0 0-3-3H5z"/>
  <path d="M5 5v22M26 24H8a3 3 0 0 0-3 3"/>
</svg>;
I.cap = ({ c }) => <svg {...out(c)}>
  <path d="M3 13L16 6l13 7-13 6z"/>
  <path d="M9 17v5a6 4 0 0 0 14 0v-5"/>
  <path d="M29 13v9"/>
</svg>;
I.hands = ({ c }) => <svg {...out(c)}>
  <path d="M16 26c-8-5-12-11-12-15a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 4-4 10-12 15z"/>
  <path d="M6 19l4 2 1 4M26 19l-4 2-1 4"/>
</svg>;

/* ───── GIFTS / OCCASIONS ───── */
I.cake = ({ c }) => <svg {...out(c)}>
  <path d="M16 4v3"/>
  <path d="M14 4q0-2 2-2t0 2"/>
  <rect x="4" y="14" width="24" height="13" rx="1"/>
  <path d="M4 18q3 2 6 0t6 0t6 0t6 0"/>
  <path d="M9 14v-3M16 14v-3M23 14v-3"/>
</svg>;
I.palm = ({ c }) => <svg {...out(c)}>
  <path d="M16 12c-3-4-6-6-10-5 2 0 3 1 4 3-3-1-6 0-8 3 3-1 5 0 6 2-2 1-3 3-3 6 2-3 4-4 6-3-1 2-1 4 0 6"/>
  <path d="M16 12c3-4 6-6 10-5-2 0-3 1-4 3 3-1 6 0 8 3-3-1-5 0-6 2 2 1 3 3 3 6-2-3-4-4-6-3 1 2 1 4 0 6"/>
  <path d="M16 12v17"/>
</svg>;

/* ───── ONLINE / DIGITAL ───── */
I.tv = ({ c }) => <svg {...out(c)}>
  <rect x="3" y="5" width="26" height="18" rx="2"/>
  <path d="M10 27h12"/>
  <path d="M14 11l5 3-5 3z"/>
</svg>;
I.controller = ({ c }) => <svg {...out(c)}>
  <path d="M3 14a5 5 0 0 1 5-5h16a5 5 0 0 1 5 5l-2 9a3 3 0 0 1-5 1l-2-3h-8l-2 3a3 3 0 0 1-5-1z"/>
  <path d="M10 14v3M8.5 15.5h3"/>
  <circle cx="21" cy="14" r="1" fill={c} stroke="none"/>
  <circle cx="23" cy="17" r="1" fill={c} stroke="none"/>
</svg>;
I.music = ({ c }) => <svg {...out(c)}>
  <path d="M12 22V6l14-2v16"/>
  <circle cx="9" cy="22" r="3"/>
  <circle cx="23" cy="20" r="3"/>
  <path d="M12 10l14-2"/>
</svg>;
I.cloud = ({ c }) => <svg {...out(c)}>
  <path d="M9 24a6 6 0 0 1 0-12 8 8 0 0 1 15 1 5 5 0 0 1 1 10z"/>
</svg>;
I.headphones = ({ c }) => <svg {...out(c)}>
  <path d="M5 19a11 11 0 0 1 22 0"/>
  <rect x="3" y="17" width="7" height="11" rx="2"/>
  <rect x="22" y="17" width="7" height="11" rx="2"/>
</svg>;

/* ───── MISC ───── */
I.scissors = ({ c }) => <svg {...out(c)}>
  <circle cx="10" cy="22" r="4.5"/>
  <circle cx="22" cy="22" r="4.5"/>
  <path d="M13 18L26 5M10 5l13 13"/>
</svg>;
I.paw = ({ c }) => <svg {...out(c)}>
  <ellipse cx="16" cy="20" rx="7" ry="6"/>
  <ellipse cx="8" cy="13" rx="2.5" ry="3.5"/>
  <ellipse cx="24" cy="13" rx="2.5" ry="3.5"/>
  <ellipse cx="12" cy="8" rx="2.2" ry="3"/>
  <ellipse cx="20" cy="8" rx="2.2" ry="3"/>
</svg>;
I.box = ({ c }) => <svg {...out(c)}>
  <path d="M5 11L16 6l11 5v11l-11 5L5 22z"/>
  <path d="M5 11l11 5 11-5M16 16v11"/>
</svg>;

export type IconKey = keyof typeof I;
export type { IconProps };
