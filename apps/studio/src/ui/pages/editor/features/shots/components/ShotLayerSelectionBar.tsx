import { useRef } from 'react';
import { X } from 'lucide-react';
import type { ShotLayerSelectOption } from '@presentation/shots/services/ShotLayerSelectMenu';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { ShotLayerSelectionActionsPopover } from '@ui/pages/editor/features/shots/components/ShotLayerSelectionActionsPopover';
import { useTextFits } from '@ui/pages/editor/features/shots/hooks/useTextFits';

interface ShotLayerSelectionBarProps {
  /** What is picked, counted: "3 b-rolls". */
  countLabel: string;
  selectionCount: number;
  /** The entries of the actions' *Select* screen, in order. */
  selectOptions: ReadonlyArray<ShotLayerSelectOption>;
  /** Replaces what is picked with `layerIds`. */
  onSelect: (layerIds: ReadonlyArray<string>) => void;
  onEditTogether: () => void;
  onRemove: () => void;
  onDone: () => void;
}

const DONE_BUTTON_CLASS =
  'inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-xs bg-transparent border-none cursor-pointer '
  + 'text-fg-secondary hover:text-fg-primary hover:bg-surface-3 '
  + 'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-3';

/**
 * The Shots panel's command surface while layers are being picked,
 * pinned under the list: one row with what is picked, the commands
 * behind its primary *Actions* button, and a close button that ends
 * the mode. The transcript's selection bar, for layers.
 *
 * Stays one row at any panel width: where the count with its kinds
 * (*2 pictures and GIFs selected*) does not fit, it says only how many
 * (*2 selected*), and the full count is its tooltip.
 */
export function ShotLayerSelectionBar(props: ShotLayerSelectionBarProps) {
  const fullCount = `${props.countLabel} selected`;
  const countBoxRef = useRef<HTMLSpanElement>(null);
  const fullCountRef = useRef<HTMLSpanElement>(null);
  const fullCountFits = useTextFits(countBoxRef, fullCountRef, fullCount);
  return (
    <div className="shot-layer-selection-bar sticky bottom-0 z-20 mt-2 bg-surface-2 border-t border-edge-medium shadow-[0_-6px_10px_-8px_rgba(0,0,0,0.35)]">
      <div className="flex items-stretch">
        <span className="w-[4px] shrink-0 bg-accent" aria-hidden />
        <div className="flex items-center gap-1 pl-3 pr-1 py-1 flex-1 min-w-0">
          <span
            ref={countBoxRef}
            className="relative text-2xs font-mono tabular-nums text-fg-secondary flex-1 min-w-0 truncate"
            title={fullCount}
            aria-live="polite"
          >
            {fullCountFits ? fullCount : `${props.selectionCount} selected`}
            {/* Laid out but never seen: what the full count would need, measured whichever one shows. */}
            <span ref={fullCountRef} className="invisible absolute left-0 top-0 whitespace-nowrap" aria-hidden>
              {fullCount}
            </span>
          </span>
          <ShotLayerSelectionActionsPopover
            hasSelection={props.selectionCount > 0}
            selectOptions={props.selectOptions}
            onEditTogether={props.onEditTogether}
            onSelect={props.onSelect}
            onRemove={props.onRemove}
          />
          <Tooltip text="Done">
            <button type="button" className={DONE_BUTTON_CLASS} aria-label="Done" onClick={props.onDone}>
              <X size={14} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
