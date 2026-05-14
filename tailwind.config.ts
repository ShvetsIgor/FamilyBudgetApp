import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        // Design system tokens: 12 / 16 / 22 / 26 / 32 px
        DEFAULT: '1rem',    // 16 px base
        sm:    '0.75rem',   // 12 px — chips, badges
        md:    '1rem',      // 16 px — inputs, buttons
        lg:    '1.375rem',  // 22 px — cards
        xl:    '1.625rem',  // 26 px — large cards
        '2xl': '2rem',      // 32 px — hero, modals
        '3xl': '2.5rem',    // 40 px — extra large
        pill:  '9999px',
      },
      fontFamily: {
        sans: ['var(--font-nunito)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(61,44,31,.04)',
        md: '0 6px 16px rgba(61,44,31,.06)',
        lg: '0 16px 30px rgba(61,44,31,.12)',
      },
    },
  },
  plugins: [],
};

export default config;
