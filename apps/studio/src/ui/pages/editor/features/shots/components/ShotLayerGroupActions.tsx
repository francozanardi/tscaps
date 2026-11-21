import { Trash2 } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useOverlaySelectionController } from '@ui/pages/editor/contexts/OverlaySelectionContext';
import type { InspectedShotLayerGroup } from '@ui/pages/editor/features/element/useInspectedElement';

interface ShotLayerGroupActionsProps {
  group: InspectedShotLayerGroup;
}

const DANGER_ICON_BUTTON_CLASS =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border-none '
  + 'text-fg-faint cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-danger hover:bg-surface-2 '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

/**
 * What can be done to several shot layers as a whole, beside their
 * count: take every one of them off its shot, as one undo step. Letting
 * go of the pick after closes the inspector, which has nothing left to
 * edit.
 */
export function ShotLayerGroupActions({ group }: ShotLayerGroupActionsProps) {
  const { actions } = useShots();
  const selection = useOverlaySelectionController();
  const remove = () => {
    actions.removeLayers.execute(group.layers.map((entry) => entry.layer.id), 'inspector');
    selection.clearSelection();
  };
  return (
    <Tooltip text="Remove from their shots">
      <button type="button" aria-label="Remove from their shots" className={DANGER_ICON_BUTTON_CLASS} onClick={remove}>
        <Trash2 size={15} />
      </button>
    </Tooltip>
  );
}
