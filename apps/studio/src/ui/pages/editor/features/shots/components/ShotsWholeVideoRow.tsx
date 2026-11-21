import type { MouseEvent } from 'react';
import { FileX, Film, Image, ImagePlay, Shapes } from 'lucide-react';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { ShotAttachmentPill } from '@ui/pages/editor/features/shots/components/ShotAttachmentPill';
import { ShotLayerChip } from '@ui/pages/editor/features/shots/components/ShotLayerChip';
import type { ShotSettingsScreen } from '@ui/pages/editor/features/shots/components/ShotSettingsPopover';
import { ShotRunBar } from '@ui/pages/editor/features/shots/components/ShotRunBar';

interface ShotsWholeVideoRowProps {
  /** The layers showing over the whole video, bottom to top. */
  layers: ReadonlyArray<ShotLayer>;
  /** Every shot of the video, in order, by how long it plays in the output, in seconds. */
  shotLengthsSec: ReadonlyArray<number>;
  /** How long the whole video plays, in seconds. */
  durationSec: number;
  /** Opens a layer's settings on the screen about it, where its pill was pressed. */
  onOpen: (layerId: string, screen: ShotSettingsScreen, point: { x: number; y: number }) => void;
}

const LABELS = new ShotLayerLabels();
const ICONS = { video: Film, image: Image, gif: ImagePlay, graphic: Shapes } as const;
const SCREENS = { video: 'broll', image: 'picture', gif: 'picture', graphic: 'graphic' } as const;
// The shell of a shot's card, so the whole video reads as one more card above the shots, the one spanning them all.
const CARD_CLASS = 'mb-2.5 p-2 rounded-sm bg-surface-2 border border-edge-medium flex flex-col gap-1.5';
const TITLE_CLASS = 'font-mono text-3xs text-fg-faint uppercase tracking-[0.06em]';
const DURATION_CLASS = 'font-mono text-2xs text-fg-secondary tabular-nums';

/**
 * What shows over the whole video, said once above the shots rather
 * than on every card: a card of its own with the video's length, a line
 * of every shot filled end to end, and one pill per layer, each opening
 * the settings its card's pill would. Nothing where no layer does.
 */
export function ShotsWholeVideoRow({ layers, shotLengthsSec, durationSec, onOpen }: ShotsWholeVideoRowProps) {
  const { services } = useShots();
  const media = useMediaAssets();
  if (layers.length === 0) return null;
  const press = (layerId: string, screen: ShotSettingsScreen) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onOpen(layerId, screen, { x: event.clientX, y: event.clientY });
  };
  return (
    <div className={CARD_CLASS} role="group" aria-label="Over the whole video">
      <span className="flex items-center justify-between gap-2">
        <span className={TITLE_CLASS}>Whole video</span>
        <span className={DURATION_CLASS}>{durationSec.toFixed(1)}s</span>
      </span>
      <ShotRunBar shotLengthsSec={shotLengthsSec} covered={{ fromIndex: 0, throughIndex: shotLengthsSec.length - 1 }} tone="quiet" />
      <span className="flex flex-wrap gap-1 pt-0.5">
        {layers.map((layer) => {
          const kind = services.layerAssets.assetOf(layer, media)?.kind ?? null;
          const screen = kind === null ? 'missing' : SCREENS[kind];
          const icon = kind === null ? FileX : ICONS[kind];
          return 'mediaId' in layer ? (
            <ShotLayerChip key={layer.id} mediaId={layer.mediaId} label={LABELS.labelOf(kind)} icon={icon} onOpen={press(layer.id, screen)} />
          ) : (
            <ShotAttachmentPill key={layer.id} label={LABELS.labelOf(kind)} icon={icon} tone="ready" progress={null} note={null} onOpen={press(layer.id, screen)} />
          );
        })}
      </span>
    </div>
  );
}
