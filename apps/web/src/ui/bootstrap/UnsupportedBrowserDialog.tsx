import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';

export type UnsupportedBrowserReason = 'webcodecs' | 'no-templates';

interface UnsupportedBrowserDialogProps {
  reason: UnsupportedBrowserReason;
}

const TITLES: Record<UnsupportedBrowserReason, string> = {
  webcodecs: "Your browser can't export video",
  'no-templates': "Your browser can't render any caption template",
};

const DESCRIPTIONS: Record<UnsupportedBrowserReason, string> = {
  webcodecs:
    "tscaps relies on WebCodecs to encode the exported video, and your browser doesn't support it. " +
    'Please open this page in a Chromium-based browser (Chrome, Edge, Brave, Arc) on a recent device.',
  'no-templates':
    "None of the caption templates render correctly in this browser. " +
    'Please open this page in a Chromium-based browser (Chrome, Edge, Brave, Arc) on a recent device.',
};

/**
 * Locked dialog with no dismiss path, explaining why the app cannot
 * run in the current browser. `reason` selects between the
 * "video can't be encoded" and the "no template renders" messages.
 */
export function UnsupportedBrowserDialog({ reason }: UnsupportedBrowserDialogProps) {
  return (
    <AppDialog
      open
      onClose={() => { /* blocking, no dismiss path */ }}
      locked
      size="md"
      title={TITLES[reason]}
      description={DESCRIPTIONS[reason]}
    >
      <div />
    </AppDialog>
  );
}
