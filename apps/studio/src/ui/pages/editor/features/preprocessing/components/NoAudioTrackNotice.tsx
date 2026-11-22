/**
 * Tells the visitor the loaded video has no audio track. Starting is
 * still allowed — separate audio can be transcribed, or the editor
 * can open with an empty transcript for captions written by hand.
 */
export function NoAudioTrackNotice() {
  return (
    <div
      data-testid="no-audio-track-notice"
      className="rounded-sm border border-warning/40 bg-warning/10 p-3"
    >
      <p className="text-xs text-fg-primary leading-snug m-0">
        This video has no audio track. A separate audio file can be used for transcription;
        otherwise you can open the editor and add captions by hand.
      </p>
    </div>
  );
}
