import { useCallback, useEffect, useRef, useState } from 'react';

const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ERROR_TIMEOUT_MS = 4000;

interface VideoDropzoneProps {
  onFile: (file: File) => void;
}

const ZONE =
  'border border-dashed border-edge-medium rounded-md py-16 px-20 lg:px-24 text-center cursor-pointer ' +
  'transition-colors duration-base ease-standard ' +
  'hover:border-edge-strong hover:bg-surface-1 ' +
  'focus-within:border-accent focus-within:bg-surface-1';

const ZONE_TITLE = 'text-md font-semibold tracking-[-0.022em] text-fg-primary m-0';
const ZONE_HINT = 'text-sm text-fg-muted m-0 mt-1';
const BROWSE_LINK =
  'text-accent transition-colors duration-quick ease-standard hover:text-accent-hover underline-offset-2 hover:underline cursor-pointer';

const ERROR_BOX =
  'text-xs text-danger bg-danger/10 border border-danger/40 rounded-xs px-3 py-2';

export function VideoDropzone({ onFile }: VideoDropzoneProps) {
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  // Clear any pending auto-dismiss when the component unmounts. Without
  // this a successful upload that navigates away would still try to
  // clear an already-unmounted state.
  useEffect(() => () => {
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
  }, []);

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, ERROR_TIMEOUT_MS);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        showError('Unsupported format. Please upload MP4, WebM, or MOV.');
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile, showError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={ZONE}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <p className={ZONE_TITLE}>Drop your video here</p>
        <label className={ZONE_HINT}>
          or <span className={BROWSE_LINK}>browse files</span>
          <input
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleInputChange}
            hidden
          />
        </label>
      </div>
      {error && (
        <p
          className={ERROR_BOX}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}
