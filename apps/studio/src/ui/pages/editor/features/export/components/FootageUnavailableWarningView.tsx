import { AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

interface FootageUnavailableWarningViewProps {
  fileNames: ReadonlyArray<string>;
  onContinue: () => void;
  onCancel: () => void;
}

export function FootageUnavailableWarningView({ fileNames, onContinue, onCancel }: FootageUnavailableWarningViewProps) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        {fileNames.length === 1 ? 'This clip could not be loaded' : 'These clips could not be loaded'}, so the
        export will show your video where {fileNames.length === 1 ? 'it goes' : 'they go'}:
      </p>
      <ul className="list-disc list-inside space-y-1 pl-1">
        {fileNames.map((name) => <li key={name} className="font-medium break-all">{name}</li>)}
      </ul>
      <p className="text-fg-secondary">To include {fileNames.length === 1 ? 'it' : 'them'}, add the file again to its shot.</p>
      <AppDialogActions>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY_SM} onClick={onContinue} autoFocus>
          Export without {fileNames.length === 1 ? 'it' : 'them'}
        </button>
      </AppDialogActions>
    </div>
  );
}
