/**
 * Returns an accessible foreground for a user/category supplied hex colour.
 * Category colours are intentionally pastel, so white text is frequently
 * unreadable on them. The threshold follows WCAG AA for normal text.
 */
export function getReadableForeground(hex: string): '#FFFFFF' | '#111827' {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#111827';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = [r, g, b]
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const whiteContrast = 1.05 / (luminance + 0.05);
  return whiteContrast >= 4.5 ? '#FFFFFF' : '#111827';
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}
