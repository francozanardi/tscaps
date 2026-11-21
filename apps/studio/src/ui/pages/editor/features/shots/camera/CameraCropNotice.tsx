import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface CameraCropNoticeProps {
  /** What the camera does that the crop above it cannot move. */
  message: string;
  /** Gives the axis back to the crop; left out where the camera travels along it, which only its own panel can change. */
  onFollow?: (() => void) | undefined;
  /** Opens the camera that holds the position. */
  onEditCamera: () => void;
}

const NOTICE_CLASS = 'flex flex-col gap-1.5 rounded-sm bg-surface-2 px-2.5 py-2 text-xs text-fg-secondary';
const NOTICE_ACTION_CLASS =
  'bg-transparent border-none p-0 text-xs text-accent cursor-pointer hover:underline focus-visible:outline-none focus-visible:underline';

/**
 * Says, under a crop picker, that a camera keeps a position of its own
 * on the axis the crop moves, so the crop picked there does not move
 * the picture: with a way to make the camera follow the crop again, and
 * one to open the camera.
 */
export const CameraCropNotice = memo(function CameraCropNotice({ message, onFollow, onEditCamera }: CameraCropNoticeProps) {
  return (
    <div className={NOTICE_CLASS} role="status">
      <span className="flex items-start gap-1.5">
        <AlertTriangle size={13} strokeWidth={2} className="shrink-0 mt-px text-warning" aria-hidden />
        <span>{message}</span>
      </span>
      <span className="flex gap-3 pl-5">
        {onFollow !== undefined && (
          <button type="button" className={NOTICE_ACTION_CLASS} onClick={onFollow}>
            Use this position
          </button>
        )}
        <button type="button" className={NOTICE_ACTION_CLASS} onClick={onEditCamera}>
          Edit camera
        </button>
      </span>
    </div>
  );
});
