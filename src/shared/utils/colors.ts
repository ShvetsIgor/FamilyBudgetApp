// Convert hex to HSL, shift hue/lightness, return hex
export function adjustColor(hex: string, index: number, total: number): string {
  if (total <= 1) return hex;

  // Parse hex
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  // Spread hue across range, keep saturation, vary lightness slightly
  const hueStep = 0.08; // 30° spread max
  const newH = (h + index * hueStep) % 1;
  const newL = Math.min(0.75, Math.max(0.3, l + (index % 2 === 0 ? 0 : 0.12)));

  return hslToHex(newH, s, newL);
}

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

function hslToHex(h: number, s: number, l: number): string {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return '#' + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}
