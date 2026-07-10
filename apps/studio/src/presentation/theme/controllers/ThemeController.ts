export type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'system';

const STORAGE_KEY = 'tscaps:theme';
const ATTR = 'data-theme';
const TRANSITION_CLASS = 'theme-transitioning';
const TRANSITION_MS = 250;
const OS_DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Owns the document-level theme state. The initial theme is set inline
 * in `index.html` (before any CSS loads, to avoid a light/dark flash on
 * page load); this controller takes over after boot for runtime changes
 * and persistence.
 *
 * State is two-layered: a user *mode* (`light` | `dark` | `system`) is
 * persisted in `localStorage`, and a resolved *theme* (`light` | `dark`)
 * is reflected on `<html data-theme="...">` so CSS can react via
 * `[data-theme='...']` selectors. When mode is `system`, the resolved
 * theme follows `prefers-color-scheme` and re-applies automatically if
 * the OS preference changes.
 *
 * Switching the theme briefly applies a `theme-transitioning` class on
 * `<html>` so that any element animates its color/background/border
 * change smoothly. Without this, only the body transitions and the rest
 * of the UI snaps. The class is removed after `TRANSITION_MS` so hover
 * transitions stay scoped to their own components.
 *
 * Subscribers listen for `'change'` and read `getMode()` / `getTheme()`.
 * The event fires both for explicit mode changes and for OS-driven
 * theme flips while in `system` mode.
 */
export class ThemeController extends EventTarget {
  private transitionTimer: number | null = null;
  private readonly osQuery: MediaQueryList = window.matchMedia(OS_DARK_QUERY);
  private mode: ThemeMode = this.readPersistedMode();

  constructor() {
    super();
    this.osQuery.addEventListener('change', this.handleOsChange);
  }

  /** Effective theme currently applied to the document. */
  getTheme(): Theme {
    return this.resolve(this.mode);
  }

  /** User's preference: an explicit theme or `system` (follows OS). */
  getMode(): ThemeMode {
    return this.mode;
  }

  setMode(mode: ThemeMode): void {
    if (mode === this.mode) return;
    const prevTheme = this.getTheme();
    this.mode = mode;
    this.persistMode(mode);
    if (this.resolve(mode) !== prevTheme) {
      this.applyResolvedTheme();
    }
    this.dispatchEvent(new Event('change'));
  }

  /** Cycle through `light` → `dark` → `system`. */
  cycle(): void {
    const next: Record<ThemeMode, ThemeMode> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    this.setMode(next[this.mode]);
  }

  private handleOsChange = (): void => {
    if (this.mode !== 'system') return;
    this.applyResolvedTheme();
    this.dispatchEvent(new Event('change'));
  };

  private applyResolvedTheme(): void {
    const theme = this.getTheme();
    if (document.documentElement.getAttribute(ATTR) === theme) return;
    document.documentElement.classList.add(TRANSITION_CLASS);
    document.documentElement.setAttribute(ATTR, theme);
    this.armTransitionCleanup();
  }

  private resolve(mode: ThemeMode): Theme {
    if (mode === 'light' || mode === 'dark') return mode;
    return this.osQuery.matches ? 'dark' : 'light';
  }

  private readPersistedMode(): ThemeMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
      // localStorage may be unavailable (private mode, disabled).
    }
    return 'system';
  }

  private armTransitionCleanup(): void {
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.transitionTimer = window.setTimeout(() => {
      document.documentElement.classList.remove(TRANSITION_CLASS);
      this.transitionTimer = null;
    }, TRANSITION_MS);
  }

  private persistMode(mode: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage may be unavailable (private mode, disabled). Theme
      // still applies for the session even if it can't be persisted.
    }
  }
}
