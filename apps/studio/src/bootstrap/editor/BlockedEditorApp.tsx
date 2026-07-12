import { EditorBlockedDialog, type EditorBlockedReason } from '@ui/pages/editor/components/dialogs/EditorBlockedDialog';

interface BlockedEditorAppProps {
  reason: EditorBlockedReason;
}

/**
 * Renders the editor-blocked dialog for the given reason and nothing
 * else. No providers, no routes, no actions.
 */
export function BlockedEditorApp({ reason }: BlockedEditorAppProps) {
  return <EditorBlockedDialog reason={reason} />;
}
