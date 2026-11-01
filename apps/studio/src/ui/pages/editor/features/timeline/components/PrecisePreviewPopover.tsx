import { Popover } from '@ui/_shared/components/Popover/Popover';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';
import { PrecisePreviewButton } from '@ui/pages/editor/features/timeline/components/PrecisePreviewButton';
import type { PreviewProxyGenerationPhase } from '@core/preview/store/PreviewProxyGenerationStore';
import type { OriginalPreviewReason } from '@core/preview/domain/VideoPreview';

interface PrecisePreviewPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Decides the opening line; the rest of the copy is the same either way. */
  reason: OriginalPreviewReason;
  phase: PreviewProxyGenerationPhase;
  percent: number;
  /** False while the original bytes are not at hand yet (still downloading). */
  canGenerate: boolean;
  onGenerate: () => void;
}

/** Why this video is in fast mode, in the reader's terms. */
function openingLine(reason: OriginalPreviewReason): string {
  switch (reason) {
    case 'generation-abandoned':
      return 'Preparing this video was taking a long time, so it was skipped.';
    case 'none-stored':
      return 'This project has no prepared video saved.';
    case 'converted-source':
      return 'This video was converted in your browser, so preparing it again was skipped to save time.';
    default:
      return 'This video is too large to prepare on this device.';
  }
}

/**
 * Explains fast preview mode and offers the switch to a precise one.
 * The preview plays the original video directly, which costs exact cut
 * placement on screen and the behind-subject effect; the button
 * generates the optimized preview that restores both, with progress
 * rendered in place.
 */
export function PrecisePreviewPopover({
  open,
  onOpenChange,
  reason,
  phase,
  percent,
  canGenerate,
  onGenerate,
}: PrecisePreviewPopoverProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={<PrecisePreviewButton />}
      screens={{
        main: (
          <div className="w-72 p-3 flex flex-col gap-2">
            <p className="text-sm font-medium text-fg-primary m-0">Fast preview mode</p>
            <p className="text-xs text-fg-secondary m-0">
              {openingLine(reason)} It plays in fast mode instead: cut edits can look
              a frame or two off on screen, and templates that place captions behind
              the subject are not available. Your export is always frame-perfect.
            </p>
            {phase === 'generating' ? (
              <GenerationProgress percent={percent} />
            ) : (
              <>
                <p className="text-xs text-fg-secondary m-0">
                  Want exact cuts and the behind-subject effect? Generate a precise
                  preview. It takes a few minutes, and you can keep editing while it runs.
                </p>
                {phase === 'failed' && (
                  <p className="text-xs text-danger m-0">
                    That didn't work. Your video still plays fine in fast mode.
                  </p>
                )}
                {!canGenerate && (
                  <p className="text-xs text-fg-faint m-0">
                    Your original video is still downloading.
                  </p>
                )}
                <button type="button" className={BTN_PRIMARY_SM} disabled={!canGenerate} onClick={onGenerate}>
                  {phase === 'failed' ? 'Try again' : 'Generate precise preview'}
                </button>
              </>
            )}
          </div>
        ),
      }}
      align="end"
    />
  );
}

function GenerationProgress({ percent }: { percent: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-fg-secondary m-0">Generating precise preview... {percent}%</p>
      <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="h-full bg-accent transition-[width] duration-quick ease-standard"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
