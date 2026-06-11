/**
 * Tailwind CSS configuration.
 *
 * Colors are stored in `:root` / `[data-theme]` as **space-separated RGB
 * channels** (e.g. `--color-surface-0: 10 10 10`). The theme entries below
 * wrap each channel in `rgb(... / <alpha-value>)` so that opacity modifiers
 * (`bg-surface-1/40`, `border-danger/20`, etc.) work end-to-end with CSS
 * variables. Direct `var(--color-X)` references in legacy CSS must be wrapped
 * in `rgb()` themselves — see `globals.css` for the pattern.
 *
 * Light/dark themes are handled entirely via `[data-theme]` overriding the
 * channel variables; no `dark:` modifier needed in markup.
 */
const c = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{tsx,jsx,ts,js,html}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        'surface-0': c('--color-surface-0'),
        'surface-1': c('--color-surface-1'),
        'surface-2': c('--color-surface-2'),
        'surface-3': c('--color-surface-3'),

        'edge-subtle': c('--color-edge-subtle'),
        'edge-medium': c('--color-edge-medium'),
        'edge-strong': c('--color-edge-strong'),

        'fg-primary': c('--color-fg-primary'),
        'fg-secondary': c('--color-fg-secondary'),
        'fg-muted': c('--color-fg-muted'),
        'fg-faint': c('--color-fg-faint'),

        'accent': c('--color-accent'),
        'accent-hover': c('--color-accent-hover'),

        'danger': c('--color-danger'),
        'warning': c('--color-warning'),
        'info': c('--color-info'),
      },
      fontFamily: {
        sans: ['Inter Variable', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Each entry is `[fontSize, { lineHeight }]` so Tailwind emits both
        // properties together. The line-heights are tuned for editor density:
        // smaller body sizes get tighter leading; display sizes loosen up.
        '3xs':  ['0.6875rem', { lineHeight: '1' }],     // 11px — pill badges (TierBadge, StatusPill, ProjectCard pills) and tight nested marker labels (rail labels under icons, ProBadge inside a tab). Inter is wider than system fonts; pair with `tracking-tighter` where the container is fixed-width (e.g. the editor rail's `w-16`).
        '2xs':  ['0.75rem',   { lineHeight: '1.15' }],  // 12px — section headers, tiny labels
        'xs':   ['0.8125rem', { lineHeight: '1.3' }],   // 13px — secondary labels
        'sm':   ['0.875rem',  { lineHeight: '1.4' }],   // 14px — small body
        'base': ['1rem',      { lineHeight: '1.5' }],   // 16px — default body
        'md':   ['1.125rem',  { lineHeight: '1.4' }],   // 18px — emphasized body
        'lg':   ['1.25rem',   { lineHeight: '1.35' }],  // 20px — minor headings
        'xl':   ['1.375rem',  { lineHeight: '1.3' }],   // 22px — section headings
        '2xl':  ['1.625rem',  { lineHeight: '1.2' }],   // 26px — page titles
        '3xl':  ['1.875rem',  { lineHeight: '1.15' }],  // 30px — hero / dashboard title
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'pill': '9999px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.35)',
        'md': '0 6px 16px rgba(0, 0, 0, 0.45)',
        'lg': '0 12px 32px rgba(0, 0, 0, 0.6)',
        // Inset top highlight + drop shadow — fakes a "raised" sheen on
        // dark surfaces for active tabs and chips.
        'raised': '0 1px 2px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      transitionDuration: {
        'instant': '80ms',
        'quick': '150ms',
        'base': '220ms',
        'soft': '320ms',
        'stage': '560ms',
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        'emphasized': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-soft': 'cubic-bezier(0.16, 1, 0.3, 1)', // legacy alias
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'wordmark-dot-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        'wordmark-caption-paint': {
          from: { color: 'rgb(var(--color-fg-primary))' },
          to: { color: 'rgb(var(--color-accent))' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.12s ease',
        'fade-out': 'fade-out 0.08s ease',
        'dot-blink': 'wordmark-dot-blink 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
        'caption-paint': 'wordmark-caption-paint 560ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
