import { Plus } from 'lucide-react';

interface AddSceneButtonProps {
  onClick: () => void;
  label: string;
}

const WRAP = 'group/add-scene flex w-full items-center gap-2 py-1 pointer-events-none';
const BTN =
  'inline-flex items-center cursor-pointer bg-transparent border-none p-0 text-fg-faint opacity-50 pointer-events-auto ' +
  'transition-opacity duration-quick ease-standard ' +
  'hover:opacity-100 focus-visible:outline-none focus-visible:opacity-100';
const RULE =
  'flex-1 h-px bg-edge-subtle transition-colors duration-quick ease-standard group-hover/add-scene:bg-edge-medium group-focus-visible/add-scene:bg-edge-medium';
// Grid trick: animate `grid-template-columns` from 0fr → 1fr. The inner
// span has `overflow-hidden`, so the label collapses cleanly to zero width
// at idle and expands to its natural size on hover, with the surrounding
// rules taking up the slack on either side.
const LABEL_WRAP =
  'grid grid-cols-[0fr] transition-[grid-template-columns] duration-base ease-emphasized group-hover/add-scene:grid-cols-[1fr] group-focus-visible/add-scene:grid-cols-[1fr]';
const LABEL_CLIP = 'overflow-hidden font-mono text-2xs uppercase tracking-[0.06em] whitespace-nowrap';
const LABEL_INNER = 'pl-1';

export function AddSceneButton({ onClick, label }: AddSceneButtonProps) {
  return (
    <div className={WRAP}>
      <span className={RULE} />
      <button
        type="button"
        className={BTN}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <Plus size={11} />
        <span className={LABEL_WRAP}>
          <span className={LABEL_CLIP}>
            <span className={LABEL_INNER}>{label}</span>
          </span>
        </span>
      </button>
      <span className={RULE} />
    </div>
  );
}
