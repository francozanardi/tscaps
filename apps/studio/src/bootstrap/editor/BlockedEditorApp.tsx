import { UnsupportedBrowserDialog, type UnsupportedBrowserReason } from '@ui/pages/editor/components/dialogs/UnsupportedBrowserDialog';

interface BlockedEditorAppProps {
  reason: UnsupportedBrowserReason;
}

/**
 * Renders the unsupported-browser dialog for the given reason and
 * nothing else. No providers, no routes, no actions.
 */
export function BlockedEditorApp({ reason }: BlockedEditorAppProps) {
  return <UnsupportedBrowserDialog reason={reason} />;
}
