import type { UnreadableReason } from '@core/preprocessing/domain/VideoValidationStatus';

interface UnreadableVideoNoticeProps {
  readonly reason: UnreadableReason;
}

/**
 * Tells the visitor the loaded file could not be measured, and what to
 * do about it. The two reasons need opposite remedies: a file whose
 * bytes never arrived is fine and only has to be picked again, while a
 * file that was read and not understood needs to be a different file.
 */
export function UnreadableVideoNotice({ reason }: UnreadableVideoNoticeProps) {
  return (
    <div
      data-testid="unreadable-video-notice"
      data-reason={reason}
      className="rounded-sm border border-danger/40 bg-danger/10 p-3"
    >
      <p className="text-xs text-fg-primary leading-snug m-0">
        {reason === 'source-unreadable'
          ? "We couldn't read this file from your device. Nothing is wrong with the video. "
            + 'Pick it again, or copy it somewhere else first and pick that copy.'
          : "We couldn't read this video. The file may be damaged or use a format "
            + 'this browser can\'t open. Try re-exporting it as MP4, or drop a different file.'}
      </p>
    </div>
  );
}
