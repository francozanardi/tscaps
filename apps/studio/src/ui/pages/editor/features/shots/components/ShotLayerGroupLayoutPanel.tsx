import { useMemo } from 'react';
import type { ShotLayerPatch } from '@core/shots/domain/ShotLayerPatch';
import { ShotLayerGroupForm } from '@presentation/shots/services/ShotLayerGroupForm';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import type { InspectedShotLayerGroup } from '@ui/pages/editor/features/element/useInspectedElement';
import { ShotLayerPlacementEditor } from '@ui/pages/editor/features/shots/components/ShotLayerPlacementEditor';
import { ShotLayerTimingSection } from '@ui/pages/editor/features/shots/components/ShotLayerTimingSection';

interface ShotLayerGroupLayoutPanelProps {
  group: InspectedShotLayerGroup;
}

const GROUP_FORM = new ShotLayerGroupForm();

/**
 * How several shot layers sit in the frame, edited together: the same
 * blocks one layer is edited through, showing the first layer's values
 * and marking *Mixed* where the others differ. A change sets only the
 * field changed, on every layer, as one undo step; whatever else
 * differs between them stays as it was. *Timing* shows only when every
 * layer is a b-roll.
 *
 * Layers whose file is gone have no kind to lay out and are left out.
 */
export function ShotLayerGroupLayoutPanel({ group }: ShotLayerGroupLayoutPanelProps) {
  const { actions } = useShots();
  const { frameLayout, shots } = useEditorState();
  const known = useMemo(() => group.layers.filter((entry) => entry.kind !== null), [group]);
  const members = useMemo(
    () => known.map((entry) => ({ layer: entry.layer, placement: shots.placementOf(entry.layer.id) })),
    [known, shots],
  );
  const mixedFields = useMemo(() => GROUP_FORM.mixedFields(members), [members]);
  const layouts = useMemo(() => GROUP_FORM.layoutsOf(members), [members]);
  const first = members[0];
  if (first === undefined) return null;
  const layerIds = members.map((member) => member.layer.id);
  const patch = (change: ShotLayerPatch) => actions.patchLayers.execute(layerIds, change);
  const frameAspectRatio = frameLayout ? frameLayout.width / frameLayout.height : null;
  const durationSec = known[0]?.media?.durationSec ?? null;
  const allBrolls = known.every((entry) => entry.kind === 'video');
  return (
    <div className="flex flex-col">
      <ShotLayerPlacementEditor
        placement={first.placement}
        frameAspectRatio={frameAspectRatio}
        mixedFields={mixedFields}
        layouts={layouts}
        filesAreVideos={allBrolls}
        onChange={(edited) => {
          const placement = GROUP_FORM.placementPatch(first.placement, edited);

          if (placement !== null) patch({ placement });
        }}
      />
      {allBrolls && durationSec !== null && 'mediaId' in first.layer && (
        <ShotLayerTimingSection
          inSec={first.layer.inSec}
          outSec={first.layer.outSec}
          loop={first.layer.loop}
          durationSec={durationSec}
          mixedFields={mixedFields}
          onStartChange={(inSec) => patch({ timing: { inSec } })}
          onEndChange={(outSec) => patch({ timing: { outSec } })}
          onLoopChange={(loop) => patch({ timing: { loop } })}
        />
      )}
    </div>
  );
}
