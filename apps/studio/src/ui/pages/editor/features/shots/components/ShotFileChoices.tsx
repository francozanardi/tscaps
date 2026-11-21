import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { BrowserSupportGate } from '@ui/_shared/components/BrowserSupportGate/BrowserSupportGate';
import { useMediaAssetStatusView } from '@ui/pages/editor/features/media/hooks/useMediaAssetStatusView';
import { MEDIA_ASSET_TYPE_ICONS } from '@ui/pages/editor/features/media/mediaAssetTypeIcons';
import { POPOVER_ITEM } from '@ui/pages/editor/features/transcript/transcript-classes';

interface ShotFileChoicesProps {
  /** The files to offer, the project's and the library's alike. */
  choices: ReadonlyArray<MediaAsset>;
  onPick: (mediaId: string) => void;
}

/**
 * The files a shot layer can be picked from: the project's own first,
 * then the library's, each under its label and marked with its type.
 * Nothing for a group with no files in it. A file this browser cannot
 * play stays listed but cannot be picked, and says why.
 */
export function ShotFileChoices({ choices, onPick }: ShotFileChoicesProps) {
  return (
    <>
      <ChoiceGroup label="In this project" choices={choices.filter((media) => media.owner.kind !== 'library')} onPick={onPick} />
      <ChoiceGroup label="In your library" choices={choices.filter((media) => media.owner.kind === 'library')} onPick={onPick} />
    </>
  );
}

function ChoiceGroup({ label, choices, onPick }: ShotFileChoicesProps & { label: string }) {
  if (choices.length === 0) return null;
  return (
    <>
      <span className="px-2 pt-0.5 pb-1 text-3xs text-fg-faint">{label}</span>
      {choices.map((media) => <Choice key={media.id} media={media} onPick={onPick} />)}
    </>
  );
}

function Choice({ media, onPick }: { media: MediaAsset; onPick: (mediaId: string) => void }) {
  const view = useMediaAssetStatusView(media.id);
  const Icon = MEDIA_ASSET_TYPE_ICONS[media.type];
  return (
    <BrowserSupportGate supported={view.state !== 'unplayable'} message={view.note ?? ''}>
      <button className={POPOVER_ITEM} onClick={() => onPick(media.id)}>
        <Icon size={13} className="shrink-0" />
        <span className="truncate">{media.fileName}</span>
      </button>
    </BrowserSupportGate>
  );
}
