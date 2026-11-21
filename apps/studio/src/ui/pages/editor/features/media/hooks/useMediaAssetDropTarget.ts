import { useRef, useState, type DragEvent } from 'react';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { MediaAssetDragFormat } from '@presentation/media/services/MediaAssetDragFormat';

interface MediaAssetDropTarget {
  /** Whether a file this target takes is being held over it right now. */
  readonly isOver: boolean;
  readonly handlers: {
    readonly onDragEnter: (event: DragEvent) => void;
    readonly onDragOver: (event: DragEvent) => void;
    readonly onDragLeave: (event: DragEvent) => void;
    readonly onDrop: (event: DragEvent) => void;
  };
}

/**
 * Makes an element take a media file of one of `accepted` dragged from
 * the media bin, handing over its id. A drag carrying anything else —
 * another type of file, files from outside the page — is left alone, so
 * the browser shows it cannot be dropped here.
 */
export function useMediaAssetDropTarget(
  format: MediaAssetDragFormat,
  accepted: readonly MediaAssetType[],
  onDrop: (mediaId: string) => void,
): MediaAssetDropTarget {
  const [isOver, setIsOver] = useState(false);
  // Entering and leaving also fire when the pointer crosses a child, so the
  // drag is tracked by depth rather than toggled on each pair.
  const depthRef = useRef(0);
  const takes = (event: DragEvent) => format.carries(event.dataTransfer.types, accepted);
  return {
    isOver,
    handlers: {
      onDragEnter: (event) => {
        if (!takes(event)) return;
        event.preventDefault();
        depthRef.current += 1;
        setIsOver(true);
      },
      onDragOver: (event) => {
        if (!takes(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDragLeave: (event) => {
        if (!takes(event)) return;
        depthRef.current = Math.max(0, depthRef.current - 1);
        if (depthRef.current === 0) setIsOver(false);
      },
      onDrop: (event) => {
        if (!takes(event)) return;
        event.preventDefault();
        event.stopPropagation();
        depthRef.current = 0;
        setIsOver(false);
        const mediaId = format.read(event.dataTransfer, accepted);
        if (mediaId !== null) onDrop(mediaId);
      },
    },
  };
}
