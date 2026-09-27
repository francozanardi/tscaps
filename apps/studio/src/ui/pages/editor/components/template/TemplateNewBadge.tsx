// Top-left because the other corners are taken: the favourite star sits
// top-right and the selection mark bottom-left. The top-left is only
// ever used by a saved template's rename and delete buttons, and a saved
// template is never marked as new.
const NEW_BADGE =
  'absolute top-1 left-1 inline-flex items-center py-0.5 px-1 rounded-pill pointer-events-none ' +
  'bg-accent/85 text-fg-on-accent text-3xs font-medium leading-none select-none';

/** The "New" mark laid over a gallery card's corner. */
export function TemplateNewBadge() {
  return <span className={NEW_BADGE}>New</span>;
}
