import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument-sans',
  // Only the Press theme binds this family (globals.css), so preloading it put
  // ~97 kB of woff2 on the critical path of every Mist user for a face they
  // never render. It also only covers latin, so a Russian Press user falls back
  // to system-ui for Cyrillic regardless.
  preload: false,
});

export const metadata: Metadata = {
  title: 'Family Budget',
  description: 'Track your family expenses and income',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Family Budget',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximumScale: pinch-zoom must stay available (WCAG 1.4.4). Inputs are
  // already 16px in globals.css, so iOS has no reason to auto-zoom on focus —
  // which is the only thing locking the scale ever bought us.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#5B6CFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1422' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="mist" suppressHydrationWarning>
      <body className={`${inter.variable} ${instrumentSans.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
