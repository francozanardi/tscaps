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

// Edges are a tint composited over whatever is behind them rather than
// a colour of their own, so a border holds its strength at any
// elevation. The opacity modifier still works: `<alpha-value>` is `1`
// when none is given, and scales the token's own alpha when one is.
const edge = (alphaName) =>
  `rgb(var(--color-edge-tint) / calc(var(${alphaName}) * <alpha-value>))`;

// A dialog that closes towards a corner flies for this long, and spends
// the last of it fading out where it lands.
const DIALOG_FLIGHT_MS = 320;
const DIALOG_FLIGHT_FADE_FROM = 0.85;

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

        'edge-faint': edge('--edge-faint-alpha'),
        'edge-subtle': edge('--edge-subtle-alpha'),
        'edge-medium': edge('--edge-medium-alpha'),
        'edge-strong': edge('--edge-strong-alpha'),

        'fg-primary': c('--color-fg-primary'),
        'fg-secondary': c('--color-fg-secondary'),
        'fg-muted': c('--color-fg-muted'),
        'fg-faint': c('--color-fg-faint'),
        'fg-on-accent': c('--color-fg-on-accent'),

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
        'indeterminate-bounce': {
          '0%, 100%': { transform: 'translateX(0%)' },
          '50%':      { transform: 'translateX(233%)' },
        },
        // A toast lands over content it has nothing to do with, so it
        // travels further than an in-flow element would: the movement is
        // what tells someone looking elsewhere on screen that it arrived.
        'toast-in-from-top': {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in-from-bottom': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'toast-timer': {
          from: { transform: 'scaleX(1)' },
          to: { transform: 'scaleX(0)' },
        },
        // Leaves towards the corner panel the work carries on in, and
        // is why it travels the whole viewport: the point is to be
        // followed by eyes that were on the button. `10rem` is the
        // panel's half-width plus the stack's inset from the edge;
        // `4rem` is inside it whatever its height. It ends smaller
        // than the panel, so it reads as landing in it rather than
        // covering it. Opacity holds until the tail so what is seen is
        // the flight and not the fade.
        'dialog-out-to-bottom-right': {
          '0%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          [`${DIALOG_FLIGHT_FADE_FROM * 100}%`]: { opacity: '0.9' },
          '100%': {
            opacity: '0',
            transform: 'translate(calc(-50% + 50vw - 10rem), calc(-50% + 50vh - 4rem)) scale(0.2)',
          },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.12s ease',
        'fade-out': 'fade-out 0.08s ease',
        'dot-blink': 'wordmark-dot-blink 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
        'caption-paint': 'wordmark-caption-paint 560ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'indeterminate-bounce': 'indeterminate-bounce 1.6s cubic-bezier(0.65, 0, 0.35, 1) infinite',
        // `backwards` rather than `both`: the toast carries an inline
        // transform and opacity for the swipe gesture, and a persisted
        // end state would outrank them once the entrance is over.
        'toast-in-from-top': 'toast-in-from-top 220ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'toast-in-from-bottom': 'toast-in-from-bottom 220ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'toast-out': 'toast-out 150ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        // Duration is supplied per toast; the shorthand only names the
        // curve so the countdown reads as elapsed time rather than motion.
        'toast-timer': 'toast-timer linear forwards',
        'dialog-out-to-bottom-right':
          `dialog-out-to-bottom-right ${DIALOG_FLIGHT_MS}ms var(--ease-travel) forwards`,
      },
    },
  },
  plugins: [],
};
