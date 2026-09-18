import { VideoFilePickerButton } from '@ui/_shared/components/VideoFilePickerButton';

const ACTION =
  'shrink-0 self-center font-mono text-2xs uppercase tracking-[0.08em] ' +
  'inline-flex items-center gap-1.5 ' +
  'text-accent hover:text-accent-hover ' +
  'transition-colors duration-quick ease-standard cursor-pointer';

interface ReplacedVideoNoticeProps {
  readonly onSelect: (file: File) => void;
}

/**
 * Shown in the export settings once the reader has replaced an
 * unreadable original with a file of a different size, which proves it
 * is not the one the captions were timed against. It does not block:
 * a re-encode of the right video lands here too, and only the reader
 * knows which it is, so the way out is offered rather than demanded.
 */
export function ReplacedVideoNotice({ onSelect }: ReplacedVideoNoticeProps) {
  return (
    <div className="flex items-start gap-3 rounded-xs border border-accent/30 bg-accent/10 px-3 py-2.5">
      <p className="flex-1 text-xs leading-snug text-fg-secondary">
        This is not the same file as the original. If the video is different, the captions may not match it.
      </p>
      <VideoFilePickerButton label="Select video" className={ACTION} onSelect={onSelect} />
    </div>
  );
}
