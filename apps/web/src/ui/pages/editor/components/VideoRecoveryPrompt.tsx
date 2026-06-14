import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

interface VideoRecoveryPromptProps {
  projectName: string;
  videoFileName: string;
  onSelect: (file: File) => void;
  onCancel: () => void;
}

/**
 * Shown after LoadProjectAction succeeds but the video Blob has been
 * evicted by the LRU cache. Names the original file so the user can
 * recognise which one to re-pick. Cancel returns to the dashboard.
 */
export function VideoRecoveryPrompt({ projectName, videoFileName, onSelect, onCancel }: VideoRecoveryPromptProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = () => inputRef.current?.click();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
    e.target.value = '';
  };

  return (
    <AppDialog
      open
      onClose={onCancel}
      size="md"
      title={projectName}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm text-fg-secondary leading-normal m-0">
          The source video was removed from this browser's cache (only the last
          few projects keep their video on hand).
        </p>
        <p className="text-sm text-fg-secondary leading-normal m-0">
          Re-select <strong className="text-fg-primary">{videoFileName}</strong> to keep editing — your
          captions, sheets, and styles are intact.
        </p>
      </div>
      <AppDialogActions>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Back to dashboard</button>
        <button type="button" className={BTN_PRIMARY_SM} onClick={handleClick} autoFocus>
          <Upload size={14} />
          <span>Re-select video</span>
        </button>
        <input ref={inputRef} type="file" accept="video/*" onChange={handleChange} hidden />
      </AppDialogActions>
    </AppDialog>
  );
}
