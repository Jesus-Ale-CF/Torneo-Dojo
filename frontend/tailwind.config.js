/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Zen Kaku Gothic New"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // tokens semánticos (definidos como variables CSS en index.css)
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        shu: 'rgb(var(--c-shu) / <alpha-value>)',      // rojo bermellón (acción, esquina roja)
        ai: 'rgb(var(--c-ai) / <alpha-value>)',        // índigo (esquina azul, enlaces)
        tatami: 'rgb(var(--c-tatami) / <alpha-value>)',// verde tatami (ok, en curso)
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
        silver: 'rgb(var(--c-silver) / <alpha-value>)',
        bronze: 'rgb(var(--c-bronze) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        'on-accent': 'rgb(var(--c-on-accent) / <alpha-value>)',
      },
      borderRadius: { dojo: '10px' },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 4px 16px -8px rgb(0 0 0 / 0.12)',
        lift: '0 8px 30px -12px rgb(0 0 0 / 0.25)',
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
};
