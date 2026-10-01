import { FileText } from 'lucide-react';
import type { SubtitleFile } from '@core/transcription/domain/SubtitleFile';

const LABEL = 'text-xs font-medium text-fg-secondary m-0';
const FILE_ROW =
  'flex items-center gap-2 rounded-xs border border-edge-subtle bg-surface-2 px-3 py-2 min-w-0';
const FILE_NAME = 'text-sm text-fg-primary truncate m-0 flex-1 min-w-0';
const CHANGE_BUTTON =
  'shrink-0 text-xs text-fg-muted bg-transparent border-0 p-0 cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary';
const WARNING = 'rounded-sm border border-warning/40 bg-warning/10 p-3 text-xs text-fg-primary leading-snug m-0';

interface SubtitleFileFieldProps {
  readonly file: SubtitleFile;
  readonly onChange: () => void;
}

/**
 * Shows the subtitle file whose captions are used instead of
 * transcribing the audio, and warns before the run starts that its word
 * timing is estimated: a caption file times lines, not words, and
 * templates that animate word by word show the difference.
 */
export function SubtitleFileField({ file, onChange }: SubtitleFileFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className={LABEL}>Subtitle file</p>
      <div className={FILE_ROW}>
        <FileText size={14} className="shrink-0 text-fg-muted" aria-hidden />
        <p className={FILE_NAME} title={file.name}>{file.name}</p>
        <button type="button" className={CHANGE_BUTTON} onClick={onChange}>
          Change
        </button>
      </div>
      <p className={WARNING} data-testid="subtitle-file-timing-warning">
        Word timing is estimated, so word-by-word animations may not match the voice.
      </p>
    </div>
  );
}
