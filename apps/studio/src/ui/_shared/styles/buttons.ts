/* Canonical button classnames. Reach for one of these before inventing
   a new variant — the identity wins from disciplined reuse. Spec lives
   in docs/DESIGN_IDENTITY.md §Chrome rules.

   Two sizes, three intents:
     intent: primary    accent fill, the "do the thing"
             secondary  transparent fill, alternate / cancel
             danger     subtle red tint, destructive

     size:   sm         28px tall — dense rows, dialog footers
             md         36px tall — page primary actions, toolbar export

   Plus `BTN_GHOST` for icon buttons inside chrome (no border, hover-only). */

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-xs border text-sm font-medium ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 ' +
  'active:duration-instant disabled:opacity-40 disabled:cursor-not-allowed';

const SIZE_SM = 'px-3 py-1.5';
const SIZE_MD = 'px-3.5 py-2';

const PRIMARY = 'bg-accent border-accent text-fg-on-accent hover:bg-accent-hover hover:border-accent-hover';
const SECONDARY =
  'bg-transparent border-edge-medium text-fg-secondary hover:bg-surface-2 hover:border-edge-strong hover:text-fg-primary';
const DANGER = 'bg-danger/10 border-danger/40 text-danger hover:bg-danger/20 hover:border-danger/60';

export const BTN_PRIMARY_SM = `${BASE} ${SIZE_SM} ${PRIMARY}`;
export const BTN_PRIMARY = `${BASE} ${SIZE_MD} ${PRIMARY}`;

export const BTN_SECONDARY_SM = `${BASE} ${SIZE_SM} ${SECONDARY}`;
export const BTN_SECONDARY = `${BASE} ${SIZE_MD} ${SECONDARY}`;

export const BTN_DANGER_SM = `${BASE} ${SIZE_SM} ${DANGER}`;
export const BTN_DANGER = `${BASE} ${SIZE_MD} ${DANGER}`;

export const BTN_GHOST =
  `${BASE} ${SIZE_SM} bg-transparent border-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary`;
