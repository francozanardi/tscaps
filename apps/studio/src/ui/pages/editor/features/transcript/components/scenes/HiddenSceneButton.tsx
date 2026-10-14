import { EyeOff } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const BUTTON =
  'inline-flex items-center justify-center w-4 h-4 rounded-xs bg-transparent border-none p-0 shrink-0 cursor-pointer ' +
  'text-fg-faint transition-colors duration-quick ease-standard ' +
  'hover:text-fg-secondary hover:bg-surface-3 focus-visible:outline-none focus-visible:text-fg-secondary focus-visible:bg-surface-3';

/** Marks a scene the video leaves out; pressing it shows the scene, however brief. */
export function HiddenSceneButton({ onShow }: { onShow: () => void }) {
  return (
    <Tooltip text="Hidden from the video. Click to show it." position="top">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onShow(); }}
        aria-label="Show scene in the video"
        className={BUTTON}
      >
        <EyeOff size={11} />
      </button>
    </Tooltip>
  );
}
