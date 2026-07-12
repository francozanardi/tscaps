import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';

export type EditorBlockedReason = 'webcodecs' | 'no-templates' | 'db-blocked';

interface EditorBlockedDialogProps {
  reason: EditorBlockedReason;
}

const TITLES: Record<EditorBlockedReason, string> = {
  webcodecs: "Your browser can't export video",
  'no-templates': "Your browser can't render any caption template",
  'db-blocked': 'tscaps is already open in another tab',
};

const DESCRIPTIONS: Record<EditorBlockedReason, string> = {
  webcodecs:
    "tscaps relies on WebCodecs to encode the exported video, and your browser doesn't support it. " +
    'Please open this page in a Chromium-based browser (Chrome, Edge, Brave, Arc) on a recent device.',
  'no-templates':
    'None of the caption templates render correctly in this browser. ' +
    'Please open this page in a Chromium-based browser (Chrome, Edge, Brave, Arc) on a recent device.',
  'db-blocked':
    'Another tab is holding an older version of tscaps open and blocking this one from starting. ' +
    'Close every other tscaps tab in this browser and reload this page.',
};

/**
 * Locked dialog with no dismiss path, explaining why the editor
 * cannot boot in this session. `reason` picks the copy and, for
 * self-recoverable states, exposes a Reload action.
 */
export function EditorBlockedDialog({ reason }: EditorBlockedDialogProps) {
  return (
    <AppDialog
      open
      onClose={() => { /* blocking, no dismiss path */ }}
      locked
      size="md"
      title={TITLES[reason]}
      description={DESCRIPTIONS[reason]}
    >
      {reason === 'db-blocked' ? <ReloadButton /> : <div />}
    </AppDialog>
  );
}

function ReloadButton() {
  return (
    <div className="flex justify-end pt-2">
      <button
        type="button"
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-fg-on-accent hover:opacity-90"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </div>
  );
}
