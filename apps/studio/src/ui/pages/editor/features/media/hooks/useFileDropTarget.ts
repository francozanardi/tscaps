import { useRef, useState, type DragEvent } from 'react';

interface FileDropTarget {
  /** Whether files are being dragged over the target right now. */
  readonly isDragging: boolean;
  readonly handlers: {
    readonly onDragEnter: (event: DragEvent) => void;
    readonly onDragOver: (event: DragEvent) => void;
    readonly onDragLeave: (event: DragEvent) => void;
    readonly onDrop: (event: DragEvent) => void;
  };
}

/**
 * Makes an element take files dropped on it, handing them over in the
 * order they came. A drag that carries no file is left alone, and a
 * drop taken here goes no further up the page.
 */
export function useFileDropTarget(onFiles: (files: readonly File[]) => void): FileDropTarget {
  const [isDragging, setIsDragging] = useState(false);
  // Entering and leaving also fire when the pointer crosses a child, so the
  // drag is tracked by depth rather than toggled on each pair.
  const depthRef = useRef(0);
  const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');
  return {
    isDragging,
    handlers: {
      onDragEnter: (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        depthRef.current += 1;
        setIsDragging(true);
      },
      onDragOver: (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDragLeave: (event) => {
        if (!carriesFiles(event)) return;
        depthRef.current = Math.max(0, depthRef.current - 1);
        if (depthRef.current === 0) setIsDragging(false);
      },
      onDrop: (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        depthRef.current = 0;
        setIsDragging(false);
        onFiles([...event.dataTransfer.files]);
      },
    },
  };
}
