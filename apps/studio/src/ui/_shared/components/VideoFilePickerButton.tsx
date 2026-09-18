import { useRef, type ReactElement } from 'react';
import { Loader2, Upload } from 'lucide-react';

interface VideoFilePickerButtonProps {
  readonly label: string;
  readonly className: string;
  readonly autoFocus?: boolean;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly onSelect: (file: File) => void;
}

/** Button that opens the file picker for a video and hands back what was chosen. */
export function VideoFilePickerButton({
  label,
  className,
  autoFocus = false,
  disabled = false,
  loading = false,
  onSelect,
}: VideoFilePickerButtonProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const isInteractive = !disabled && !loading;
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onSelect(file);
    // Both callers ask for a file the app already had, so picking the
    // same one again has to fire.
    event.target.value = '';
  };
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          if (isInteractive) inputRef.current?.click();
        }}
        autoFocus={autoFocus}
        disabled={!isInteractive}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        <span>{label}</span>
      </button>
      <input ref={inputRef} type="file" accept="video/*" onChange={handleChange} hidden />
    </>
  );
}
