import { useRef, useState, type ChangeEvent } from 'react';
import { Replace, Trash2, Upload } from 'lucide-react';
import type { AppError } from '@core/errors/domain/AppError';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';
import { useErrors } from '@ui/_shared/contexts/modules/ErrorsContext';
import type { InspectedShotLayer } from '@ui/pages/editor/features/element/useInspectedElement';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { ShotFileChoices } from '@ui/pages/editor/features/shots/components/ShotFileChoices';
import { useShotLayerRole } from '@ui/pages/editor/features/shots/hooks/useShotLayerRole';
import {
  PICTURE_FILE_ACCEPT, PICTURE_FILE_TYPES, VIDEO_FILE_ACCEPT, VIDEO_FILE_TYPES,
} from '@ui/pages/editor/features/shots/shotFileAccept';
import { POPOVER_ITEM, POPOVER_MENU_SHAPE } from '@ui/pages/editor/features/transcript/transcript-classes';

interface ShotLayerFileActionsProps {
  element: InspectedShotLayer;
}

const ICON_BUTTON_CLASS =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border-none '
  + 'text-fg-faint cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-secondary hover:bg-surface-2 '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';
const DANGER_ICON_BUTTON_CLASS = `${ICON_BUTTON_CLASS} hover:text-danger`;
const ICON_SIZE = 15;

/**
 * What can be done to a shot layer's file as a whole, beside its name:
 * put another file of the same kind in its place, or take the layer off
 * its shot. A layer whose file is gone, or a graphic, can only be taken
 * off.
 *
 * A picture or a GIF is replaced only by another picture or GIF, a
 * b-roll only by a video, so a layer keeps its role.
 */
export function ShotLayerFileActions({ element }: ShotLayerFileActionsProps) {
  const { actions } = useShots();
  const mediaId = 'mediaId' in element.layer ? element.layer.mediaId : null;
  const role = useShotLayerRole(mediaId);
  return (
    <div className="shrink-0 flex items-center">
      {role !== null && mediaId !== null && (
        <ShotLayerReplaceButton layerId={element.layer.id} currentMediaId={mediaId} isPicture={role === 'picture'} />
      )}
      <Tooltip text="Remove from the shot">
        <button
          type="button"
          aria-label="Remove from the shot"
          className={DANGER_ICON_BUTTON_CLASS}
          onClick={() => actions.removeLayers.execute([element.layer.id], 'inspector')}
        >
          <Trash2 size={ICON_SIZE} />
        </button>
      </Tooltip>
    </div>
  );
}

interface ShotLayerReplaceProps {
  layerId: string;
  currentMediaId: string;
  /** Offers pictures and GIFs where true, videos where false. */
  isPicture: boolean;
}

/** Offers another file of the layer's kind: a new one first, then those the project and the library hold. */
function ShotLayerReplaceButton({ layerId, currentMediaId, isPicture }: ShotLayerReplaceProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      align="end"
      triggerTooltip="Replace the file"
      trigger={(
        <button type="button" aria-label="Replace the file" className={ICON_BUTTON_CLASS}>
          <Replace size={ICON_SIZE} />
        </button>
      )}
      screens={{ pick: <ShotLayerFilePickScreen layerId={layerId} currentMediaId={currentMediaId} isPicture={isPicture} /> }}
    />
  );
}

function ShotLayerFilePickScreen({ layerId, currentMediaId, isPicture }: ShotLayerReplaceProps) {
  const { close } = usePopoverNav();
  const { actions } = useShots();
  const mediaModule = useMedia();
  const { appNoticeChannel } = useErrors();
  const catalog = useMediaAssets();
  const inputRef = useRef<HTMLInputElement>(null);
  const choices = catalog.list()
    .filter((media) => (isPicture ? PICTURE_FILE_TYPES : VIDEO_FILE_TYPES).includes(media.type) && media.id !== currentMediaId);
  // Replacing only ever rejects with its own failure, which carries its copy.
  const publish = (error: unknown) => appNoticeChannel.publish(error as AppError);
  const pick = (mediaId: string) => {
    actions.replaceLayerFile.execute(layerId, mediaId).catch(publish);
    close();
  };
  // The popover stays open while the system picker is up: closing it
  // would take the input, and the file it is about to hand over, with it.
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    mediaModule.actions.import.execute(file, 'project', 'layer-replace-upload', isPicture ? PICTURE_FILE_TYPES : VIDEO_FILE_TYPES).then(
      (added) => actions.replaceLayerFile.execute(layerId, added.id).catch(publish),
      // The import only ever rejects with its own failure, which carries its copy.
      publish,
    );
    close();
  };
  return (
    <div className={`${POPOVER_MENU_SHAPE} max-w-[260px]`}>
      <button className={POPOVER_ITEM} onClick={() => inputRef.current?.click()}>
        <Upload size={13} /> {isPicture ? 'Upload a picture or GIF' : 'Upload a video'}
      </button>
      <input ref={inputRef} type="file" accept={isPicture ? PICTURE_FILE_ACCEPT : VIDEO_FILE_ACCEPT} onChange={handleFile} hidden />
      {choices.length > 0 && (
        <>
          <div className="mx-2 my-1 border-t border-edge-subtle" />
          <div className="flex flex-col gap-0.5 max-h-[240px] overflow-y-auto">
            <ShotFileChoices choices={choices} onPick={pick} />
          </div>
        </>
      )}
    </div>
  );
}
