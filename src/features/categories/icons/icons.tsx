import React from 'react';

const INK = '#3D2C1F';
const dark = (c: string) => `color-mix(in srgb, ${c} 70%, #3D2C1F)`;

interface IconProps { c: string; id: string }

const Defs = ({ id, c }: IconProps) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={c} />
      <stop offset="100%" stopColor={c} stopOpacity=".78" />
    </linearGradient>
  </defs>
);
const Hi = ({ cx = 10, cy = 12, rx = 2, ry = 2.5, o = 0.5 }: { cx?: number; cy?: number; rx?: number; ry?: number; o?: number }) =>
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="white" opacity={o} />;

export type IconKey = keyof typeof I;

/* eslint-disable react/display-name */
export const I: Record<string, (props: IconProps) => React.ReactElement> = {};

/* ─── MONEY / INCOME ─── */
I.briefcase = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="11" y="6" width="10" height="4" rx="1" fill={dark(c)} />
  <rect x="4" y="10" width="24" height="16" rx="3" fill={dark(c)} />
  <rect x="4" y="9" width="24" height="16" rx="3" fill={`url(#${id})`} />
  <rect x="14" y="14" width="4" height="3" rx="1" fill={INK} />
  <Hi cx={8} cy={13} />
</svg>;
I.cash = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="4" y="9" width="24" height="14" rx="2" fill={dark(c)} />
  <rect x="4" y="8" width="24" height="14" rx="2" fill={`url(#${id})`} />
  <circle cx="16" cy="15" r="4" fill={INK} opacity=".25" />
  <text x="16" y="18" textAnchor="middle" fontSize="7" fontWeight="900" fill="white">₪</text>
  <Hi cx={8} cy={11} />
</svg>;
I.card = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="3" y="8" width="26" height="17" rx="3" fill={dark(c)} />
  <rect x="3" y="7" width="26" height="17" rx="3" fill={`url(#${id})`} />
  <rect x="3" y="11" width="26" height="3.5" fill={INK} opacity=".55" />
  <rect x="6" y="18" width="9" height="2.5" rx="1" fill="white" opacity=".8" />
  <Hi cx={6} cy={9} />
</svg>;
I.coin = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="16" cy="17" r="11" fill={dark(c)} />
  <circle cx="16" cy="16" r="11" fill={`url(#${id})`} />
  <text x="16" y="21" textAnchor="middle" fontSize="14" fontWeight="900" fill={INK}>₪</text>
  <Hi cx={11} cy={11} />
</svg>;
I.piggy = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <ellipse cx="17" cy="19" rx="11" ry="8" fill={dark(c)} />
  <ellipse cx="17" cy="18" rx="11" ry="8" fill={`url(#${id})`} />
  <ellipse cx="26" cy="17" rx="3.2" ry="2.8" fill={dark(c)} />
  <ellipse cx="26" cy="17" rx="2.8" ry="2.4" fill={`url(#${id})`} />
  <circle cx="25" cy="17" r="0.7" fill={INK} /><circle cx="27" cy="17" r="0.7" fill={INK} />
  <circle cx="12" cy="15" r="1.4" fill={INK} />
  <rect x="13" y="11" width="6" height="1.8" rx="0.9" fill={INK} />
  <rect x="11" y="25" width="3" height="3" rx="1" fill={dark(c)} />
  <rect x="21" y="25" width="3" height="3" rx="1" fill={dark(c)} />
  <Hi cx={11} cy={13} />
</svg>;
I.gift = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="4" y="13" width="24" height="14" rx="2" fill={dark(c)} />
  <rect x="4" y="12" width="24" height="14" rx="2" fill={`url(#${id})`} />
  <rect x="14" y="12" width="4" height="15" fill={INK} opacity=".65" />
  <path d="M16 12 C 12 12 10 8 12 6 C 14 4 16 8 16 12 C 16 8 18 4 20 6 C 22 8 20 12 16 12 Z" fill={dark(c)} />
  <Hi cx={8} cy={15} />
</svg>;
I.chart_up = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="4" y="7" width="24" height="20" rx="3" fill={dark(c)} />
  <rect x="4" y="6" width="24" height="20" rx="3" fill={`url(#${id})`} />
  <path d="M7 21 L13 15 L17 19 L25 11" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  <circle cx="25" cy="11" r="1.5" fill="white" />
  <path d="M21 11 L25 11 L25 15" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
</svg>;
I.star = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M16 4 L20 13 L29 14 L22 20 L24 29 L16 24 L8 29 L10 20 L3 14 L12 13 Z" fill={dark(c)} />
  <path d="M16 3 L20 12 L29 13 L22 19 L24 28 L16 23 L8 28 L10 19 L3 13 L12 12 Z" fill={`url(#${id})`} />
  <Hi cx={11} cy={11} />
</svg>;
I.refund = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="16" cy="16" r="11.5" fill={dark(c)} />
  <circle cx="16" cy="15" r="11.5" fill={`url(#${id})`} />
  <path d="M22 12 A 7 7 0 1 0 22 18" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  <path d="M22 8 L22 12 L18 12" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  <Hi cx={11} cy={11} />
</svg>;

/* ─── GROCERIES ─── */
I.cart = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M8 11 L28 11 L25 22 L11 22 Z" fill={dark(c)} />
  <path d="M8 10 L28 10 L25 21 L11 21 Z" fill={`url(#${id})`} />
  <path d="M4 6 L8 6 L11 21" stroke={dark(c)} strokeWidth="2.2" fill="none" strokeLinecap="round" />
  <circle cx="13" cy="26" r="2" fill={INK} /><circle cx="23" cy="26" r="2" fill={INK} />
  <circle cx="15" cy="15" r="2" fill="#81B29A" />
  <circle cx="20" cy="15" r="2" fill="#C9684E" />
  <rect x="22" y="12" width="2.5" height="4" rx=".5" fill="#F2CC8F" />
</svg>;
I.wine = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M9 4 L23 4 L21 14 Q21 18 16 18 Q11 18 11 14 Z" fill={dark(c)} />
  <path d="M9 3 L23 3 L21 13 Q21 17 16 17 Q11 17 11 13 Z" fill={`url(#${id})`} />
  <rect x="15" y="17" width="2" height="9" fill={dark(c)} />
  <ellipse cx="16" cy="27" rx="7" ry="1.5" fill={dark(c)} />
  <Hi cx={12} cy={7} rx={1.5} ry={2} />
</svg>;
I.spray = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M22 8 L26 6 M22 10 L27 10 M22 12 L26 14" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity=".65" />
  <rect x="11" y="13" width="10" height="15" rx="2" fill={dark(c)} />
  <rect x="11" y="12" width="10" height="15" rx="2" fill={`url(#${id})`} />
  <rect x="13" y="5" width="6" height="7" rx="1" fill={dark(c)} />
  <rect x="12.5" y="16" width="7" height="3" rx="0.5" fill="white" opacity=".7" />
  <Hi cx={13} cy={15} rx={1.5} />
</svg>;
I.broom = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="15" y="3" width="2.5" height="18" rx="1" fill={INK} transform="rotate(20 16 12)" />
  <path d="M5 28 L18 18 L25 25 L13 31 Z" fill={dark(c)} />
  <path d="M5 27 L18 17 L25 24 L13 30 Z" fill={`url(#${id})`} />
  <path d="M9 25 L12 28 M12 22 L15 25 M15 19 L18 22 M18 19 L21 22 M21 19 L24 22" stroke={INK} strokeWidth="1.2" opacity=".7" />
</svg>;

/* ─── DINING OUT ─── */
I.plate = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M11 9 Q12 6 11 4 M16 8 Q17 5 16 3 M21 9 Q22 6 21 4" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".6" />
  <path d="M4 22 Q4 13 16 13 Q28 13 28 22 Z" fill={dark(c)} />
  <path d="M4 21 Q4 12 16 12 Q28 12 28 21 Z" fill={`url(#${id})`} />
  <ellipse cx="16" cy="23" rx="14" ry="3.4" fill={INK} />
  <ellipse cx="16" cy="22" rx="14" ry="3.4" fill="white" />
  <Hi cx={10} cy={15} />
</svg>;
I.coffee = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M11 9 Q12 6 11 4 M16 8 Q17 5 16 3" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".6" />
  <path d="M5 12 L23 12 L21 26 L7 26 Z" fill={dark(c)} />
  <path d="M5 11 L23 11 L21 25 L7 25 Z" fill={`url(#${id})`} />
  <path d="M23 14 Q28 14 28 18 Q28 22 23 22" stroke={dark(c)} strokeWidth="2.4" fill="none" />
  <Hi cx={9} cy={14} />
</svg>;
I.delivery = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M9 8 L23 8 L21 22 L11 22 Z" fill={dark(c)} />
  <path d="M9 7 L23 7 L21 21 L11 21 Z" fill={`url(#${id})`} />
  <path d="M13 11 L19 11 M13 15 L19 15" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
  <path d="M12 7 Q12 3 16 3 Q20 3 20 7" stroke={dark(c)} strokeWidth="2" fill="none" strokeLinecap="round" />
  <path d="M11 21 L21 21 L21 24 Q21 26 19 26 L13 26 Q11 26 11 24 Z" fill={INK} />
  <Hi cx={12} cy={10} />
</svg>;
I.burger = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M4 13 Q4 6 16 6 Q28 6 28 13 Z" fill={dark(c)} />
  <path d="M4 12 Q4 5 16 5 Q28 5 28 12 Z" fill={`url(#${id})`} />
  <circle cx="11" cy="9" r=".8" fill="white" /><circle cx="16" cy="7" r=".8" fill="white" /><circle cx="21" cy="9" r=".8" fill="white" />
  <path d="M3 14 L29 14 Q27 17 25 14 Q23 17 21 14 Q19 17 17 14 Q15 17 13 14 Q11 17 9 14 Q7 17 5 14 Z" fill="#81B29A" />
  <rect x="4" y="17" width="24" height="3.5" rx="1" fill="#5A3520" />
  <path d="M3 20 L29 20 L29 22 L3 22 Z" fill="#F2CC8F" />
  <path d="M4 21 L28 21 Q28 26 16 26 Q4 26 4 21 Z" fill={`url(#${id})`} />
</svg>;
I.icecream = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="16" cy="10" r="6" fill={dark(c)} />
  <circle cx="16" cy="9" r="6" fill={`url(#${id})`} />
  <circle cx="11" cy="8" r="4" fill="#C97B84" />
  <circle cx="21" cy="8" r="4" fill="#F2CC8F" />
  <path d="M9 13 L23 13 L18 28 L14 28 Z" fill={dark(c)} />
  <path d="M9 12 L23 12 L18 27 L14 27 Z" fill="#D4A574" />
  <path d="M12 14 L20 14 M11 18 L21 18 M13 22 L19 22" stroke={INK} strokeWidth=".8" opacity=".5" />
  <Hi cx={9} cy={7} />
</svg>;

/* ─── ENTERTAINMENT ─── */
I.cinema = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="3" y="14" width="26" height="13" rx="2" fill={dark(c)} />
  <rect x="3" y="13" width="26" height="13" rx="2" fill={`url(#${id})`} />
  <path d="M3 6 L29 12 L29 14 L3 14 Z" fill={INK} opacity=".85" />
  <path d="M7 8 L9 13 L13 9 L15 14 L19 10 L21 15 L25 11 L27 16" stroke="white" strokeWidth="1.5" fill="none" opacity=".55" />
</svg>;
I.ferris = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="16" cy="14" r="11" fill={dark(c)} opacity=".4" />
  <circle cx="16" cy="14" r="11" fill="none" stroke={dark(c)} strokeWidth="1.5" />
  <circle cx="16" cy="14" r="2" fill={INK} />
  <path d="M16 14 L16 3 M16 14 L26 14 M16 14 L16 25 M16 14 L6 14 M16 14 L24 7 M16 14 L24 21 M16 14 L8 21 M16 14 L8 7" stroke={dark(c)} strokeWidth="1.2" />
  <rect x="14" y="2" width="4" height="3" rx="0.5" fill={c} />
  <rect x="25" y="13" width="3" height="4" rx="0.5" fill={c} />
  <rect x="14" y="24" width="4" height="3" rx="0.5" fill={c} />
  <rect x="4" y="13" width="3" height="4" rx="0.5" fill={c} />
  <path d="M10 24 L16 28 L22 24" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
</svg>;
I.compass = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="16" cy="16" r="12" fill={dark(c)} />
  <circle cx="16" cy="15" r="12" fill={`url(#${id})`} />
  <path d="M16 6 L18 14 L16 16 L14 14 Z" fill="white" opacity=".9" />
  <path d="M26 16 L18 18 L16 16 L18 14 Z" fill="white" opacity=".5" />
  <path d="M16 26 L14 18 L16 16 L18 18 Z" fill={INK} opacity=".6" />
  <path d="M6 16 L14 14 L16 16 L14 18 Z" fill={INK} opacity=".4" />
  <circle cx="16" cy="16" r="2" fill="white" opacity=".9" />
  <Hi cx={11} cy={11} />
</svg>;
I.ticket = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M4 10 L28 10 L28 14 Q26 14 26 16 Q26 18 28 18 L28 22 L4 22 L4 18 Q6 18 6 16 Q6 14 4 14 Z" fill={dark(c)} />
  <path d="M4 9 L28 9 L28 13 Q26 13 26 15 Q26 17 28 17 L28 21 L4 21 L4 17 Q6 17 6 15 Q6 13 4 13 Z" fill={`url(#${id})`} />
  <path d="M14 11 L14 21" stroke="white" strokeWidth="1.5" strokeDasharray="2 2" opacity=".75" />
  <Hi cx={8} cy={12} />
</svg>;
I.brush = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="14" y="3" width="4" height="14" rx="0.5" fill={INK} transform="rotate(35 16 10)" />
  <path d="M4 28 L13 19 L20 26 L11 31 Z" fill={dark(c)} />
  <path d="M4 27 L13 18 L20 25 L11 30 Z" fill={`url(#${id})`} />
  <Hi cx={6} cy={26} />
</svg>;

/* ─── HOME & BILLS ─── */
I.house = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M5 17 L16 7 L27 17 L27 27 L5 27 Z" fill={dark(c)} />
  <path d="M5 16 L16 6 L27 16 L27 26 L5 26 Z" fill={`url(#${id})`} />
  <rect x="13" y="17" width="6" height="9" rx="1" fill={INK} opacity=".85" />
  <Hi cx={9} cy={12} />
</svg>;
I.key = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="10" cy="13" r="7" fill={dark(c)} />
  <circle cx="10" cy="12" r="7" fill={`url(#${id})`} />
  <circle cx="10" cy="12" r="2.5" fill={INK} />
  <rect x="14" y="10" width="14" height="4" rx="0.5" fill={dark(c)} />
  <rect x="14" y="10" width="14" height="3" rx="0.5" fill={`url(#${id})`} />
  <rect x="22" y="13" width="2" height="4" fill={dark(c)} />
  <rect x="26" y="13" width="2" height="3" fill={dark(c)} />
  <Hi cx={7} cy={9} />
</svg>;
I.bank = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M3 10 L16 4 L29 10 L29 12 L3 12 Z" fill={dark(c)} />
  <path d="M3 9 L16 3 L29 9 L29 11 L3 11 Z" fill={`url(#${id})`} />
  <rect x="5" y="13" width="3" height="11" fill={dark(c)} />
  <rect x="5" y="12" width="3" height="11" fill={`url(#${id})`} />
  <rect x="11" y="13" width="3" height="11" fill={dark(c)} />
  <rect x="11" y="12" width="3" height="11" fill={`url(#${id})`} />
  <rect x="18" y="13" width="3" height="11" fill={dark(c)} />
  <rect x="18" y="12" width="3" height="11" fill={`url(#${id})`} />
  <rect x="24" y="13" width="3" height="11" fill={dark(c)} />
  <rect x="24" y="12" width="3" height="11" fill={`url(#${id})`} />
  <rect x="2" y="24" width="28" height="3" rx="0.5" fill={dark(c)} />
</svg>;
I.lightning = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M18 3 L8 18 L15 18 L13 29 L25 13 L17 13 Z" fill={dark(c)} />
  <path d="M18 2 L8 17 L15 17 L13 28 L25 12 L17 12 Z" fill={`url(#${id})`} />
  <Hi cx={13} cy={9} rx={1.5} ry={3} />
</svg>;
I.drop = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M16 4 C 9 14 6 19 6 22 A 10 10 0 0 0 26 22 C 26 19 23 14 16 4 Z" fill={dark(c)} />
  <path d="M16 3 C 9 13 6 18 6 21 A 10 10 0 0 0 26 21 C 26 18 23 13 16 3 Z" fill={`url(#${id})`} />
  <Hi cx={11} cy={17} rx={2} ry={3} />
</svg>;
I.wifi = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M10 17 Q16 12 22 17" stroke={`url(#${id})`} strokeWidth="3.5" fill="none" strokeLinecap="round" />
  <path d="M6 13 Q16 4 26 13" stroke={`url(#${id})`} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity=".7" />
  <circle cx="16" cy="23" r="2.5" fill={dark(c)} />
  <circle cx="16" cy="22.5" r="2" fill={`url(#${id})`} />
</svg>;
I.phone = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="9" y="4" width="14" height="25" rx="3" fill={dark(c)} />
  <rect x="9" y="3" width="14" height="25" rx="3" fill={`url(#${id})`} />
  <rect x="11" y="6" width="10" height="17" rx="1" fill={INK} opacity=".75" />
  <circle cx="16" cy="25.5" r="1" fill="white" opacity=".7" />
  <Hi cx={12} cy={7} />
</svg>;
I.receipt = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M7 5 L25 5 L25 28 L22 26 L19 28 L16 26 L13 28 L10 26 L7 28 Z" fill={dark(c)} />
  <path d="M7 4 L25 4 L25 27 L22 25 L19 27 L16 25 L13 27 L10 25 L7 27 Z" fill={`url(#${id})`} />
  <path d="M10 9 L22 9 M10 13 L22 13 M10 17 L19 17" stroke={INK} strokeWidth="1.4" strokeLinecap="round" opacity=".75" />
  <Hi cx={10} cy={7} />
</svg>;
I.building = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="6" y="4" width="20" height="24" rx="1" fill={dark(c)} />
  <rect x="6" y="3" width="20" height="24" rx="1" fill={`url(#${id})`} />
  <rect x="9" y="6" width="3" height="3" fill={INK} opacity=".55" />
  <rect x="15" y="6" width="3" height="3" fill={INK} opacity=".55" />
  <rect x="21" y="6" width="2" height="3" fill={INK} opacity=".55" />
  <rect x="9" y="11" width="3" height="3" fill={INK} opacity=".55" />
  <rect x="15" y="11" width="3" height="3" fill={INK} opacity=".55" />
  <rect x="21" y="11" width="2" height="3" fill={INK} opacity=".55" />
  <rect x="9" y="16" width="3" height="3" fill={INK} opacity=".55" />
  <rect x="15" y="16" width="3" height="3" fill={INK} opacity=".55" />
  <rect x="21" y="16" width="2" height="3" fill={INK} opacity=".55" />
  <rect x="13" y="21" width="6" height="7" rx="0.5" fill={INK} opacity=".7" />
</svg>;
I.couch = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="3" y="13" width="26" height="11" rx="3" fill={dark(c)} />
  <rect x="3" y="12" width="26" height="11" rx="3" fill={`url(#${id})`} />
  <rect x="5" y="9" width="8" height="6" rx="1.5" fill="white" opacity=".85" />
  <rect x="19" y="9" width="8" height="6" rx="1.5" fill="white" opacity=".85" />
  <rect x="3" y="22" width="3" height="6" rx="0.5" fill={dark(c)} />
  <rect x="26" y="22" width="3" height="6" rx="0.5" fill={dark(c)} />
</svg>;
I.bag = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M7 13 L25 13 L23 28 L9 28 Z" fill={dark(c)} />
  <path d="M7 12 L25 12 L23 27 L9 27 Z" fill={`url(#${id})`} />
  <path d="M11 12 Q11 5 16 5 Q21 5 21 12" stroke={dark(c)} strokeWidth="2.4" fill="none" strokeLinecap="round" />
  <Hi cx={10} cy={15} />
</svg>;
I.wrench = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M22 6 A 6 6 0 0 0 16 12 A 6 6 0 0 0 17 15 L6 26 L8 28 L19 17 A 6 6 0 0 0 22 18 A 6 6 0 0 0 28 12 A 6 6 0 0 0 25 9 L22 12 L20 12 L20 10 L23 7 A 6 6 0 0 0 22 6 Z" fill={dark(c)} />
  <path d="M22 5 A 6 6 0 0 0 16 11 A 6 6 0 0 0 17 14 L6 25 L8 27 L19 16 A 6 6 0 0 0 22 17 A 6 6 0 0 0 28 11 A 6 6 0 0 0 25 8 L22 11 L20 11 L20 9 L23 6 A 6 6 0 0 0 22 5 Z" fill={`url(#${id})`} />
  <Hi cx={20} cy={9} />
</svg>;

/* ─── CAR / TRANSPORT ─── */
I.car = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M5 17 L8 11 L24 11 L27 17 L27 23 L5 23 Z" fill={dark(c)} />
  <path d="M5 16 L8 10 L24 10 L27 16 L27 22 L5 22 Z" fill={`url(#${id})`} />
  <rect x="9" y="12" width="6" height="4" rx="1" fill="white" opacity=".7" />
  <rect x="17" y="12" width="6" height="4" rx="1" fill="white" opacity=".7" />
  <circle cx="9" cy="23" r="2.5" fill={INK} /><circle cx="23" cy="23" r="2.5" fill={INK} />
</svg>;
I.fuel = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="6" y="8" width="13" height="20" rx="2" fill={dark(c)} />
  <rect x="6" y="7" width="13" height="20" rx="2" fill={`url(#${id})`} />
  <rect x="8" y="10" width="9" height="6" rx="1" fill="white" opacity=".7" />
  <path d="M19 13 L23 13 L23 22 Q23 25 26 25 Q26 17 23 14" stroke={dark(c)} strokeWidth="2" fill="none" strokeLinecap="round" />
  <Hi cx={9} cy={11} />
</svg>;
I.shield = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M16 28 Q5 22 5 12 L5 7 L16 4 L27 7 L27 12 Q27 22 16 28 Z" fill={dark(c)} />
  <path d="M16 27 Q5 21 5 11 L5 6 L16 3 L27 6 L27 11 Q27 21 16 27 Z" fill={`url(#${id})`} />
  <path d="M11 14 L15 18 L21 11" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  <Hi cx={9} cy={9} />
</svg>;
I.parking = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="4" y="4" width="24" height="24" rx="5" fill={dark(c)} />
  <rect x="4" y="3" width="24" height="24" rx="5" fill={`url(#${id})`} />
  <text x="16" y="22" textAnchor="middle" fontSize="20" fontWeight="900" fill="white">P</text>
  <Hi cx={9} cy={8} />
</svg>;
I.carwash = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="8" cy="6" r="2" fill="#8AA9D6" opacity=".75" />
  <circle cx="16" cy="4" r="2.5" fill="#8AA9D6" opacity=".75" />
  <circle cx="24" cy="6" r="2" fill="#8AA9D6" opacity=".75" />
  <circle cx="6" cy="11" r="1.5" fill="#8AA9D6" opacity=".6" />
  <circle cx="26" cy="11" r="1.5" fill="#8AA9D6" opacity=".6" />
  <path d="M5 22 L8 16 L24 16 L27 22 L27 27 L5 27 Z" fill={dark(c)} />
  <path d="M5 21 L8 15 L24 15 L27 21 L27 26 L5 26 Z" fill={`url(#${id})`} />
  <circle cx="9" cy="27" r="2" fill={INK} /><circle cx="23" cy="27" r="2" fill={INK} />
</svg>;
I.bus = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="5" y="6" width="22" height="18" rx="3" fill={dark(c)} />
  <rect x="5" y="5" width="22" height="18" rx="3" fill={`url(#${id})`} />
  <rect x="7" y="8" width="6" height="5" rx="1" fill="white" opacity=".75" />
  <rect x="14" y="8" width="6" height="5" rx="1" fill="white" opacity=".75" />
  <rect x="21" y="8" width="4" height="5" rx="1" fill="white" opacity=".75" />
  <circle cx="10" cy="25" r="2.2" fill={INK} /><circle cx="22" cy="25" r="2.2" fill={INK} />
</svg>;
I.taxi = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="11" y="3" width="10" height="3" rx="0.5" fill={dark(c)} />
  <text x="16" y="5.5" textAnchor="middle" fontSize="2.5" fontWeight="900" fill="white">TAXI</text>
  <path d="M5 17 L8 11 L24 11 L27 17 L27 23 L5 23 Z" fill={dark(c)} />
  <path d="M5 16 L8 10 L24 10 L27 16 L27 22 L5 22 Z" fill={`url(#${id})`} />
  <rect x="9" y="12" width="6" height="4" rx="1" fill="white" opacity=".75" />
  <rect x="17" y="12" width="6" height="4" rx="1" fill="white" opacity=".75" />
  <circle cx="9" cy="23" r="2.5" fill={INK} /><circle cx="23" cy="23" r="2.5" fill={INK} />
</svg>;
I.train = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M6 7 Q6 4 9 4 L23 4 Q26 4 26 7 L26 22 Q26 25 23 25 L9 25 Q6 25 6 22 Z" fill={dark(c)} />
  <path d="M6 6 Q6 3 9 3 L23 3 Q26 3 26 6 L26 21 Q26 24 23 24 L9 24 Q6 24 6 21 Z" fill={`url(#${id})`} />
  <rect x="9" y="6" width="6" height="5" rx="1" fill="white" opacity=".8" />
  <rect x="17" y="6" width="6" height="5" rx="1" fill="white" opacity=".8" />
  <circle cx="11" cy="15" r="1" fill="white" />
  <circle cx="21" cy="15" r="1" fill="white" />
  <rect x="9" y="24" width="14" height="2" fill={INK} />
  <circle cx="10" cy="28" r="1.5" fill={INK} /><circle cx="22" cy="28" r="1.5" fill={INK} />
  <path d="M4 9 L6 9 M26 9 L28 9" stroke={dark(c)} strokeWidth="2" />
</svg>;

/* ─── TRAVEL ─── */
I.plane = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M16 4 L18 14 L29 17 L29 19 L18 18 L17 26 L20 28 L20 29 L13 27 L12 28 L8 27 L9 25 L11 24 L14 18 L4 19 L4 17 L14 14 Z" fill={dark(c)} />
  <path d="M16 3 L18 13 L29 16 L29 18 L18 17 L17 25 L20 27 L20 28 L13 26 L12 27 L8 26 L9 24 L11 23 L14 17 L4 18 L4 16 L14 13 Z" fill={`url(#${id})`} />
  <Hi cx={13} cy={9} rx={1.5} ry={2} />
</svg>;
I.bed = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="3" y="14" width="26" height="9" rx="2" fill={dark(c)} />
  <rect x="3" y="13" width="26" height="9" rx="2" fill={`url(#${id})`} />
  <rect x="5" y="9" width="8" height="6" rx="1.5" fill="white" opacity=".85" />
  <rect x="14" y="9" width="8" height="6" rx="1.5" fill="white" opacity=".85" />
  <rect x="3" y="22" width="3" height="5" fill={dark(c)} />
  <rect x="26" y="22" width="3" height="5" fill={dark(c)} />
</svg>;
I.suitcase = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="11" y="4" width="10" height="6" rx="1" stroke={dark(c)} strokeWidth="2" fill="none" />
  <rect x="4" y="10" width="24" height="17" rx="2" fill={dark(c)} />
  <rect x="4" y="9" width="24" height="17" rx="2" fill={`url(#${id})`} />
  <rect x="15" y="9" width="2" height="17" fill={INK} opacity=".55" />
  <Hi cx={8} cy={12} />
</svg>;

/* ─── HEALTH ─── */
I.heart = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M16 28 C8 23 4 17 4 13 A6 6 0 0 1 16 11 A6 6 0 0 1 28 13 C28 17 24 23 16 28 Z" fill={dark(c)} />
  <path d="M16 27 C8 22 4 16 4 12 A6 6 0 0 1 16 10 A6 6 0 0 1 28 12 C28 16 24 22 16 27 Z" fill={`url(#${id})`} />
  <rect x="14" y="12" width="4" height="10" rx="1" fill="white" opacity=".95" />
  <rect x="11" y="15" width="10" height="4" rx="1" fill="white" opacity=".95" />
  <Hi cx={10} cy={11} rx={2} ry={3} />
</svg>;
I.pill = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="3" y="11" width="26" height="10" rx="5" transform="rotate(-30 16 16)" fill={dark(c)} />
  <rect x="3" y="10" width="26" height="10" rx="5" transform="rotate(-30 16 15)" fill={`url(#${id})`} />
  <rect x="3" y="10" width="13" height="10" rx="5" transform="rotate(-30 16 15)" fill="white" opacity=".55" />
</svg>;
I.stethoscope = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M9 4 L9 12 Q9 18 15 18 Q21 18 21 12 L21 4" stroke={dark(c)} strokeWidth="3" fill="none" />
  <circle cx="9" cy="4" r="2" fill={dark(c)} />
  <circle cx="21" cy="4" r="2" fill={dark(c)} />
  <path d="M15 18 L15 22 Q15 26 20 26" stroke={dark(c)} strokeWidth="2.5" fill="none" />
  <circle cx="22" cy="26" r="4" fill={dark(c)} />
  <circle cx="22" cy="26" r="3.5" fill={`url(#${id})`} />
  <circle cx="22" cy="26" r="1.2" fill={INK} />
</svg>;
I.tooth = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M8 5 Q5 7 5 13 Q5 21 8 25 Q11 27 12 23 L14 19 Q16 17 18 19 L20 23 Q21 27 24 25 Q27 21 27 13 Q27 7 24 5 Q19 3 16 6 Q13 3 8 5 Z" fill={`url(#${id})`} />
  <Hi cx={10} cy={9} rx={1.5} ry={2} />
</svg>;
I.dumbbell = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="2" y="11" width="5" height="11" rx="1.5" fill={dark(c)} />
  <rect x="25" y="11" width="5" height="11" rx="1.5" fill={dark(c)} />
  <rect x="6" y="14" width="20" height="5" rx="1" fill={dark(c)} />
  <rect x="6" y="13" width="20" height="5" rx="1" fill={`url(#${id})`} />
  <rect x="3" y="9" width="5" height="13" rx="1.5" fill={`url(#${id})`} />
  <rect x="24" y="9" width="5" height="13" rx="1.5" fill={`url(#${id})`} />
</svg>;

/* ─── SHOPPING ─── */
I.shirt = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M4 11 L11 5 L13 7 Q16 9 19 7 L21 5 L28 11 L25 16 L22 14 L22 27 L10 27 L10 14 L7 16 Z" fill={dark(c)} />
  <path d="M4 10 L11 4 L13 6 Q16 8 19 6 L21 4 L28 10 L25 15 L22 13 L22 26 L10 26 L10 13 L7 15 Z" fill={`url(#${id})`} />
  <Hi cx={8} cy={9} />
</svg>;
I.laptop = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="6" y="6" width="20" height="14" rx="2" fill={dark(c)} />
  <rect x="6" y="5" width="20" height="14" rx="2" fill={`url(#${id})`} />
  <rect x="8" y="7" width="16" height="10" rx="1" fill={INK} opacity=".7" />
  <path d="M3 21 L29 21 L27 25 L5 25 Z" fill={dark(c)} />
  <Hi cx={9} cy={8} />
</svg>;
I.lipstick = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="12" y="15" width="8" height="13" rx="0.5" fill={dark(c)} />
  <rect x="12" y="14" width="8" height="13" rx="0.5" fill={`url(#${id})`} />
  <path d="M12 4 L20 4 L18 14 L14 14 Z" fill="#C9684E" />
  <path d="M12 3 L20 3 L18 13 L14 13 Z" fill="#E07A5F" />
  <rect x="12" y="13" width="8" height="3" rx="0.5" fill={INK} />
  <Hi cx={14} cy={17} />
</svg>;
I.online = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="4" y="6" width="24" height="17" rx="2" fill={dark(c)} />
  <rect x="4" y="5" width="24" height="17" rx="2" fill={`url(#${id})`} />
  <rect x="6" y="7" width="20" height="13" rx="1" fill={INK} opacity=".75" />
  <path d="M14 25 L18 25 L20 28 L12 28 Z" fill={dark(c)} />
  <path d="M9 10 L13 14 L15 12 L18 16 L22 12" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".7" />
  <Hi cx={8} cy={8} />
</svg>;
I.watch = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M11 4 L21 4 L20 10 L12 10 Z" fill={dark(c)} />
  <path d="M11 22 L21 22 L20 28 L12 28 Z" fill={dark(c)} />
  <rect x="7" y="10" width="18" height="14" rx="3" fill={dark(c)} />
  <rect x="7" y="9" width="18" height="14" rx="3" fill={`url(#${id})`} />
  <circle cx="16" cy="16" r="5" fill={INK} opacity=".6" />
  <path d="M16 14 L16 17 L18 17" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
</svg>;

/* ─── KIDS ─── */
I.ball = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="16" cy="17" r="11.5" fill={dark(c)} />
  <circle cx="16" cy="16" r="11.5" fill={`url(#${id})`} />
  <path d="M16 4.5 L19 8 L17 12 L13 11 L11 7 Z M5 13 L9 14 L11 18 L9 22 L5 21 M27 13 L23 14 L21 18 L23 22 L27 21 M11 27 L13 23 L17 22 L19 26 M16 12 L19 16 L17 21 L13 21 L11 16 Z" stroke={INK} strokeWidth="1" fill="none" opacity=".6" />
  <Hi cx={11} cy={11} />
</svg>;
I.backpack = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M12 5 Q12 3 16 3 Q20 3 20 5" stroke={dark(c)} strokeWidth="2" fill="none" />
  <rect x="6" y="6" width="20" height="22" rx="4" fill={dark(c)} />
  <rect x="6" y="5" width="20" height="22" rx="4" fill={`url(#${id})`} />
  <rect x="6" y="13" width="20" height="6" fill={INK} opacity=".18" />
  <rect x="11" y="14" width="10" height="4" rx="1" fill="white" opacity=".7" />
  <circle cx="16" cy="16" r="1" fill={INK} />
  <Hi cx={9} cy={9} />
</svg>;
I.teddy = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="9" cy="9" r="3" fill={dark(c)} />
  <circle cx="23" cy="9" r="3" fill={dark(c)} />
  <circle cx="16" cy="17" r="10" fill={dark(c)} />
  <circle cx="16" cy="16" r="10" fill={`url(#${id})`} />
  <circle cx="9" cy="8" r="2.5" fill={`url(#${id})`} />
  <circle cx="23" cy="8" r="2.5" fill={`url(#${id})`} />
  <ellipse cx="16" cy="20" rx="4" ry="3" fill="white" opacity=".75" />
  <circle cx="12" cy="14" r="1.3" fill={INK} /><circle cx="20" cy="14" r="1.3" fill={INK} />
  <ellipse cx="16" cy="18.5" rx="1.4" ry="1" fill={INK} />
</svg>;
I.book = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="5" y="5" width="22" height="22" rx="2" fill={dark(c)} />
  <rect x="5" y="4" width="22" height="22" rx="2" fill={`url(#${id})`} />
  <rect x="5" y="4" width="5" height="22" rx="2" fill={INK} opacity=".55" />
  <path d="M14 9 L23 9 M14 13 L23 13 M14 17 L21 17" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity=".85" />
  <Hi cx={8} cy={7} />
</svg>;
I.cap = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M3 14 L16 8 L29 14 L16 20 Z" fill={dark(c)} />
  <path d="M3 13 L16 7 L29 13 L16 19 Z" fill={`url(#${id})`} />
  <path d="M9 16 L9 22 Q9 25 16 25 Q23 25 23 22 L23 16" stroke={dark(c)} strokeWidth="2.5" fill="none" />
  <rect x="28" y="13" width="1.5" height="8" fill={INK} />
  <ellipse cx="28.5" cy="22" rx="2" ry="1.5" fill={INK} />
</svg>;
I.hands = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M16 26 C8 22 4 16 4 12 A6 6 0 0 1 16 10 A6 6 0 0 1 28 12 C28 16 24 22 16 26 Z" fill={dark(c)} />
  <path d="M16 25 C8 21 4 15 4 11 A6 6 0 0 1 16 9 A6 6 0 0 1 28 11 C28 15 24 21 16 25 Z" fill={`url(#${id})`} />
  <path d="M5 20 L10 22 L11 26 L7 27 L4 24 Z" fill="#D4A574" />
  <path d="M27 20 L22 22 L21 26 L25 27 L28 24 Z" fill="#D4A574" />
</svg>;

/* ─── GIFTS ─── */
I.cake = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="14" y="3" width="1" height="6" fill="#F2CC8F" />
  <path d="M14 3 Q13.5 1 14.5 1 Q15 2 14 3" fill="#E07A5F" />
  <rect x="6" y="12" width="20" height="6" fill={dark(c)} />
  <rect x="6" y="11" width="20" height="6" fill={`url(#${id})`} />
  <path d="M6 11 L8 9 L10 11 L12 9 L14 11 L16 9 L18 11 L20 9 L22 11 L24 9 L26 11" fill="white" opacity=".7" />
  <rect x="4" y="17" width="24" height="11" rx="1.5" fill={dark(c)} />
  <rect x="4" y="16" width="24" height="11" rx="1.5" fill={`url(#${id})`} />
  <Hi cx={8} cy={20} />
</svg>;
I.palm = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M16 6 Q14 4 11 4 Q14 6 14 8 Q12 7 9 8 Q12 8 14 11 Q12 11 10 14 Q13 12 16 12 Q19 12 22 14 Q20 11 18 11 Q20 8 23 8 Q20 7 18 8 Q18 6 21 4 Q18 4 16 6 Z" fill="#5A8B73" />
  <path d="M15 11 Q14 16 13 20 Q13 25 16 28 Q19 25 19 20 Q18 16 17 11 Z" fill={dark(c)} />
  <path d="M15 11 Q14 16 13 20 Q13 25 15 27 Q15 22 16 17 Q16 13 17 11 Z" fill="#8B6F4E" />
</svg>;

/* ─── ONLINE & DIGITAL ─── */
I.tv = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <rect x="3" y="6" width="26" height="18" rx="2.5" fill={dark(c)} />
  <rect x="3" y="5" width="26" height="18" rx="2.5" fill={`url(#${id})`} />
  <rect x="5" y="7" width="22" height="14" rx="1" fill={INK} opacity=".75" />
  <path d="M14 11 L20 14 L14 17 Z" fill="white" />
  <rect x="9" y="26" width="14" height="2" rx="1" fill={dark(c)} />
  <Hi cx={7} cy={9} />
</svg>;
I.controller = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M3 14 Q3 9 8 9 L24 9 Q29 9 29 14 L27 23 Q26 26 23 26 Q21 26 20 24 L19 22 L13 22 L12 24 Q11 26 9 26 Q6 26 5 23 Z" fill={dark(c)} />
  <path d="M3 13 Q3 8 8 8 L24 8 Q29 8 29 13 L27 22 Q26 25 23 25 Q21 25 20 23 L19 21 L13 21 L12 23 Q11 25 9 25 Q6 25 5 22 Z" fill={`url(#${id})`} />
  <circle cx="10" cy="15" r="1.4" fill={INK} />
  <rect x="8.5" y="13.5" width="3" height="3" rx="0.6" fill={INK} />
  <circle cx="22" cy="14" r="1.2" fill={INK} />
  <circle cx="24" cy="16" r="1.2" fill={INK} />
</svg>;
I.music = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M12 6 L25 4 L25 22 L23 22 L23 8 L14 9.5 L14 25 L12 25 Z" fill={dark(c)} />
  <path d="M12 5 L25 3 L25 21 L23 21 L23 7 L14 8.5 L14 24 L12 24 Z" fill={`url(#${id})`} />
  <ellipse cx="10" cy="25" rx="4" ry="3" fill={dark(c)} />
  <ellipse cx="10" cy="24.5" rx="4" ry="3" fill={`url(#${id})`} />
  <ellipse cx="21" cy="22" rx="4" ry="3" fill={dark(c)} />
  <ellipse cx="21" cy="21.5" rx="4" ry="3" fill={`url(#${id})`} />
</svg>;
I.cloud = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M9 24 Q3 24 3 18 Q3 13 9 12 Q11 6 17 6 Q23 6 25 12 Q30 13 30 18 Q30 24 24 24 Z" fill={dark(c)} />
  <path d="M9 23 Q3 23 3 17 Q3 12 9 11 Q11 5 17 5 Q23 5 25 11 Q30 12 30 17 Q30 23 24 23 Z" fill={`url(#${id})`} />
  <Hi cx={9} cy={14} />
</svg>;
I.headphones = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M5 19 Q5 6 16 6 Q27 6 27 19" stroke={dark(c)} strokeWidth="3" fill="none" strokeLinecap="round" />
  <rect x="3" y="17" width="7" height="11" rx="2" fill={dark(c)} />
  <rect x="3" y="16" width="7" height="11" rx="2" fill={`url(#${id})`} />
  <rect x="22" y="17" width="7" height="11" rx="2" fill={dark(c)} />
  <rect x="22" y="16" width="7" height="11" rx="2" fill={`url(#${id})`} />
  <Hi cx={5} cy={19} />
</svg>;

I.scissors = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <circle cx="10" cy="22" r="4.5" fill={dark(c)} /><circle cx="10" cy="22" r="4.5" fill={`url(#${id})`} />
  <circle cx="22" cy="22" r="4.5" fill={dark(c)} /><circle cx="22" cy="22" r="4.5" fill={`url(#${id})`} />
  <circle cx="10" cy="22" r="2" fill="white" opacity=".6" /><circle cx="22" cy="22" r="2" fill="white" opacity=".6" />
  <path d="M10 18 L20 8" stroke={dark(c)} strokeWidth="2.5" strokeLinecap="round" />
  <path d="M22 18 L12 8" stroke={dark(c)} strokeWidth="2.5" strokeLinecap="round" />
</svg>;
I.paw = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <ellipse cx="16" cy="20" rx="8" ry="7" fill={dark(c)} />
  <ellipse cx="16" cy="19" rx="8" ry="7" fill={`url(#${id})`} />
  <ellipse cx="8" cy="13" rx="3" ry="3.8" fill={dark(c)} /><ellipse cx="8" cy="12.5" rx="3" ry="3.8" fill={`url(#${id})`} />
  <ellipse cx="24" cy="13" rx="3" ry="3.8" fill={dark(c)} /><ellipse cx="24" cy="12.5" rx="3" ry="3.8" fill={`url(#${id})`} />
  <ellipse cx="12" cy="9" rx="2.5" ry="3.2" fill={dark(c)} /><ellipse cx="12" cy="8.5" rx="2.5" ry="3.2" fill={`url(#${id})`} />
  <ellipse cx="20" cy="9" rx="2.5" ry="3.2" fill={dark(c)} /><ellipse cx="20" cy="8.5" rx="2.5" ry="3.2" fill={`url(#${id})`} />
</svg>;

/* ─── OTHER ─── */
I.box = ({ c, id }) => <svg viewBox="0 0 32 32"><Defs id={id} c={c} />
  <path d="M5 11 L16 6 L27 11 L16 16 Z" fill={dark(c)} />
  <path d="M5 11 L16 16 L16 27 L5 22 Z" fill={dark(c)} opacity=".85" />
  <path d="M27 11 L16 16 L16 27 L27 22 Z" fill={`url(#${id})`} />
  <path d="M5 10 L16 5 L27 10 L16 15 Z" fill={`url(#${id})`} />
</svg>;
