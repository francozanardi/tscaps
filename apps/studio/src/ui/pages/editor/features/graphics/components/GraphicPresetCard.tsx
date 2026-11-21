import { memo, useState } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import { GraphicPresetThumbnailView } from '@ui/pages/editor/features/graphics/components/GraphicPresetThumbnailView';

const CARD_CLASS =
  'w-full h-full flex flex-col items-start gap-1 p-1.5 rounded-sm border text-left cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const CARD_AT_REST_CLASS = 'border-edge-subtle bg-surface-1 hover:border-edge-strong';
const CARD_PICKED_CLASS = 'border-accent bg-accent/5';
const MANAGE_BUTTON_CLASS =
  'p-1 rounded-xs bg-surface-1/70 backdrop-blur-sm border border-edge-medium text-fg-faint cursor-pointer '
  + '[@media(hover:hover)]:opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 '
  + 'transition-[opacity,color,background-color] duration-quick ease-standard hover:bg-surface-1 focus-visible:outline-none focus-visible:bg-surface-1';

interface GraphicPresetCardProps {
  preset: GraphicPreset;
  picked: boolean;
  onPick: () => void;
  /** Renames the preset; given for one the user saved, so only those offer it. */
  onRename?: (() => void) | undefined;
  /** Deletes the preset; given for one the user saved, so only those offer it. */
  onDelete?: (() => void) | undefined;
}

/**
 * A preset to pick: its thumbnail, still at rest and playing while hovered
 * or focused, and its name; what it is for shows as the card's tooltip.
 * One the user saved can be renamed or deleted from buttons over its
 * corner.
 */
export const GraphicPresetCard = memo(function GraphicPresetCard({ preset, picked, onPick, onRename, onDelete }: GraphicPresetCardProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative group/card h-full" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        type="button"
        aria-pressed={picked}
        title={preset.description === '' ? undefined : preset.description}
        className={`${CARD_CLASS} ${picked ? CARD_PICKED_CLASS : CARD_AT_REST_CLASS}`}
        onClick={onPick}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <GraphicPresetThumbnailView preset={preset} playing={hovered || focused} />
        <span className="pt-0.5 text-2xs font-medium leading-snug text-fg-primary line-clamp-2 break-words max-w-full">{preset.name}</span>
      </button>
      {picked && (
        <span className="absolute top-2.5 right-2.5 grid place-items-center w-4 h-4 rounded-full bg-accent text-white pointer-events-none">
          <Check size={10} aria-hidden />
        </span>
      )}
      {(onRename !== undefined || onDelete !== undefined) && (
        <div className="absolute top-2.5 left-2.5 flex gap-1">
          {onRename !== undefined && (
            <button type="button" onClick={onRename} aria-label={`Rename ${preset.name}`} title="Rename" className={`${MANAGE_BUTTON_CLASS} hover:text-fg-primary`}>
              <Pencil size={12} strokeWidth={2.25} />
            </button>
          )}
          {onDelete !== undefined && (
            <button type="button" onClick={onDelete} aria-label={`Delete ${preset.name}`} title="Delete" className={`${MANAGE_BUTTON_CLASS} hover:text-danger`}>
              <Trash2 size={12} strokeWidth={2.25} />
            </button>
          )}
        </div>
      )}
    </div>
  );
});
