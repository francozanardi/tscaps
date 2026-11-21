/* The editor toolbar's own buttons, beside the app's canonical ones (`@ui/_shared/styles/buttons`): an icon in
   chrome that shows its box only on hover, and the toolbar's quiet text action (Save), filled one step up from the
   bar so it reads as a button without competing with the one accent action (Export). */

export const TOOLBAR_ICON_BUTTON =
  'inline-flex items-center justify-center w-8 h-8 bg-transparent border border-transparent rounded-xs text-fg-secondary ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'enabled:hover:bg-surface-2 enabled:hover:border-edge-medium enabled:hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:border-accent ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

export const TOOLBAR_BUTTON =
  'inline-flex items-center gap-1.5 px-3 py-1 lg:py-1.5 rounded-xs border border-edge-medium text-sm font-medium ' +
  'text-fg-primary bg-surface-2 ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'enabled:hover:bg-surface-3 enabled:hover:border-accent ' +
  'focus-visible:outline-none focus-visible:border-accent ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';
