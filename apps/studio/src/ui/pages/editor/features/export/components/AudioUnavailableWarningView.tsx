import { AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

interface AudioUnavailableWarningViewProps {
  fileNames: ReadonlyArray<string>;
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * Asks whether to export without the sounds that could not be read: a
 * file that could not be had or decoded, or a bundled sound this version
 * no longer ships. The remedy fits both, a sound picked anew from the
 * Audio tab.
 */
export function AudioUnavailableWarningView({ fileNames, onContinue, onCancel }: AudioUnavailableWarningViewProps) {
  const one = fileNames.length === 1;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>{one ? 'This sound could not be loaded' : 'These sounds could not be loaded'}:</p>
      <ul className="list-disc list-inside space-y-1 pl-1">
        {fileNames.map((name) => <li key={name} className="font-medium break-all">{name}</li>)}
      </ul>
      <p className="text-fg-secondary">
        The export will have your other sounds and the sound of your video. To replace {one ? 'it' : 'them'}, use
        Change sound on {one ? 'it' : 'each'} in the Audio tab.
      </p>
      <AppDialogActions>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY_SM} onClick={onContinue} autoFocus>
          Export without {one ? 'it' : 'them'}
        </button>
      </AppDialogActions>
    </div>
  );
}
