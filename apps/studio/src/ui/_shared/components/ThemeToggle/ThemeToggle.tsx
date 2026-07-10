import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import type {
  ThemeController,
  ThemeMode,
} from '@presentation/theme/controllers/ThemeController';

interface ThemeToggleProps {
  controller: ThemeController;
}

const BTN_CLASS =
  'inline-flex items-center justify-center w-8 h-8 bg-transparent border border-transparent rounded-xs text-fg-secondary ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-2 hover:border-edge-medium hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:border-accent';

const MODE_ICON: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const MODE_LABEL: Record<ThemeMode, string> = {
  light: 'light',
  dark: 'dark',
  system: 'system',
};

/**
 * Toolbar/header button that cycles the theme mode through
 * light → dark → system. Reads the current mode from the controller
 * and subscribes for re-render so multiple instances (e.g. one in the
 * editor toolbar and one on the dashboard) stay in sync if the theme
 * changes elsewhere, including OS-level changes while in `system` mode.
 *
 * The icon shows the *current* mode (Sun = light, Moon = dark,
 * Monitor = follows OS). The tooltip names the current mode so users
 * don't have to guess what comes next.
 */
export function ThemeToggle({ controller }: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>(() => controller.getMode());
  useEffect(() => {
    const update = () => setMode(controller.getMode());
    controller.addEventListener('change', update);
    update();
    return () => controller.removeEventListener('change', update);
  }, [controller]);

  const Icon = MODE_ICON[mode];
  const label = MODE_LABEL[mode];
  return (
    <Tooltip text={`Theme: ${label} (click to change)`} position="bottom">
      <button
        type="button"
        className={BTN_CLASS}
        onClick={() => controller.cycle()}
        aria-label={`Theme: ${label}. Click to change.`}
      >
        <Icon size={16} />
      </button>
    </Tooltip>
  );
}
