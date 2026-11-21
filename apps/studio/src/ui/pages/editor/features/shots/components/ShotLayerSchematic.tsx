import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { ShotLayerStagePreview } from '@presentation/shots/services/ShotLayerStagePreview';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';

// The layer is drawn alone, with no video to put in a frame.
const ORIGINAL_FRAME = OutputFrame.original();

interface ShotLayerSchematicProps {
  /** The layout drawn. */
  placement: ShotLayerPlacement;
  /** The video's width over its height, or null when not known yet (drawn square). */
  frameAspectRatio: number | null;
  /** The file's width over its height, or null when there is no one file to draw (a box then takes the frame's). */
  assetAspectRatio: number | null;
}

// The box the drawing fits inside: the picture slot of a choice card.
const MAX_WIDTH = 64;
const MAX_HEIGHT = 36;
// The stage is drawn at a frame of this height and scaled down, so the layout's lengths keep their proportions.
const STAGE_HEIGHT_PX = 1000;
const SCHEMATIC_LAYER_ID = 'schematic';

/**
 * A layout drawn small on the video's own shape: the frame, and the
 * file's box where the layout puts it. The box is laid out by the CSS
 * the layout's fields write, in the stylesheet the preview and the
 * export draw by, on the engine's stage, so the drawing is the layout as
 * it renders. Where the video floats in the box, the frame is drawn
 * filled, the file over all of it, and the box light, in the video's
 * shape: what floats is always the box.
 * Drawn in `currentColor`, so it takes the tone of the card it sits in.
 */
export const ShotLayerSchematic = memo(function ShotLayerSchematic({
  placement,
  frameAspectRatio,
  assetAspectRatio,
}: ShotLayerSchematicProps) {
  const { stageBuilder, layoutWriter } = useShots().services;
  const { footageStageBaseline } = useEngine();
  const stagePreview = useMemo(() => new ShotLayerStagePreview(footageStageBaseline), [footageStageBaseline]);
  const host = useRef<HTMLSpanElement>(null);
  const aspect = frameAspectRatio !== null && frameAspectRatio > 0 ? frameAspectRatio : 1;
  const width = Math.min(MAX_WIDTH, MAX_HEIGHT * aspect);
  const height = width / aspect;
  const floatsVideo = placement.kind === 'inset' && placement.subject === 'video';
  // The box drawn is where what floats goes, whichever it is; the video's shape is the frame's.
  const layout = JSON.stringify(floatsVideo ? { ...placement, subject: 'asset' } : placement);
  const boxAspectRatio = floatsVideo ? aspect : assetAspectRatio;
  const stage = useMemo(() => {
    const styles = layoutWriter.written(ElementStyles.empty(), SCHEMATIC_LAYER_ID, JSON.parse(layout) as ShotLayerPlacement);
    const frame = { width: Math.round(STAGE_HEIGHT_PX * aspect), height: STAGE_HEIGHT_PX };
    return stageBuilder.build([{ layerId: SCHEMATIC_LAYER_ID, assetAspectRatio: boxAspectRatio }], styles, frame, ORIGINAL_FRAME);
  }, [stageBuilder, layoutWriter, layout, aspect, boxAspectRatio]);

  useLayoutEffect(() => {
    if (host.current === null) return;
    stagePreview.render(host.current, stage, SCHEMATIC_LAYER_ID, null, width / stage.frameWidth);
  }, [stagePreview, stage, width]);

  return (
    <span className="relative inline-block" style={{ width, height }} aria-hidden="true">
      <svg className="absolute inset-0" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={2} fill="currentColor" fillOpacity={floatsVideo ? 0.55 : 0.12} stroke="currentColor" strokeOpacity={0.5} />
      </svg>
      <span ref={host} className={`absolute inset-0 overflow-hidden rounded-[2px] ${floatsVideo ? 'text-surface-2' : 'opacity-70'}`} />
    </span>
  );
});
