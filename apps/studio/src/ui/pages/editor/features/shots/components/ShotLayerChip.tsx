import type { MouseEvent } from 'react';
import { AlertTriangle, UploadCloud, type LucideIcon } from 'lucide-react';
import { useMediaAssetStatusView } from '@ui/pages/editor/features/media/hooks/useMediaAssetStatusView';
import { ShotAttachmentPill } from '@ui/pages/editor/features/shots/components/ShotAttachmentPill';

interface ShotLayerChipProps {
  mediaId: string;
  /** What the shot holds, as the pill names it: `B-roll`, `Picture`, `GIF`. */
  label: string;
  /** The mark for it while all is well. */
  icon: LucideIcon;
  /**
   * While the panel is picking layers: whether this one is picked, which
   * turns the pill into a check that a press toggles. Absent otherwise.
   */
  picked?: boolean | undefined;
  /** Where an earlier shot holds the layer and this one still shows it: what to say of that, `Continues from shot 2`. Absent on the layer's own shot. */
  continuesNote?: string | undefined;
  onOpen: (event: MouseEvent) => void;
}

/**
 * A layer a shot carries — its b-roll, a picture, a GIF — as a pill
 * under its card. While its file is prepared or sent the pill fills as
 * the step goes; when it needs the reader it turns to a warning.
 * Pressing it opens that layer's settings; while the panel is picking
 * layers, it picks the layer or lets it go instead. On a shot that only
 * goes on showing a layer an earlier shot holds, it says where from.
 */
export function ShotLayerChip({ mediaId, label, icon, picked, continuesNote, onOpen }: ShotLayerChipProps) {
  const view = useMediaAssetStatusView(mediaId);
  const shownIcon = view.tone === 'alert' ? AlertTriangle : view.step === 'uploading' ? UploadCloud : icon;
  return (
    <ShotAttachmentPill
      label={label}
      icon={shownIcon}
      tone={view.tone}
      progress={view.progress}
      note={view.note ?? continuesNote ?? null}
      picked={picked}
      continues={continuesNote !== undefined}
      onOpen={onOpen}
    />
  );
}
