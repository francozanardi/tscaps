import { ChevronRight } from 'lucide-react';
import { ExportSettingsFooter } from '@ui/pages/editor/features/export/components/ExportSettingsFooter';

interface OtherExportFormatsProps {
  onChooseSubtitles: () => void;
  onChooseCaptionsOnly: () => void;
  onBackToVideo: () => void;
  onCancel: () => void;
}

const CHOICE =
  'group w-full flex items-center gap-3 p-3 rounded-sm border border-edge-subtle bg-surface-2 text-left '
  + 'cursor-pointer transition-colors duration-quick ease-standard outline-none '
  + 'hover:border-edge-medium focus-visible:ring-2 focus-visible:ring-accent/40';

/**
 * The exports a minority of people come for, one step away from the
 * video export so they never take room in it.
 */
export function OtherExportFormats({
  onChooseSubtitles,
  onChooseCaptionsOnly,
  onBackToVideo,
  onCancel,
}: OtherExportFormatsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Choice
          title="Subtitle file"
          legend="The words and their timings as SRT, VTT, ASS or plain text. Your caption design is not included."
          onClick={onChooseSubtitles}
        />
        <Choice
          title="Captions as a video"
          legend="A video of the animated captions on a transparent or solid background."
          onClick={onChooseCaptionsOnly}
        />
      </div>
      <ExportSettingsFooter
        alternateLabel="Export full video instead"
        onAlternate={onBackToVideo}
        onCancel={onCancel}
      />
    </div>
  );
}

function Choice({ title, legend, onClick }: { title: string; legend: string; onClick: () => void }) {
  return (
    <button type="button" className={CHOICE} onClick={onClick}>
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-sm text-fg-primary">{title}</span>
        <span className="text-xs text-fg-faint">{legend}</span>
      </span>
      <ChevronRight aria-hidden size={16} className="shrink-0 text-fg-faint group-hover:text-fg-secondary" />
    </button>
  );
}
