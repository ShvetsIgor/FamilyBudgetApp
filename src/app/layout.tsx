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
  maximumScale: 1,
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
