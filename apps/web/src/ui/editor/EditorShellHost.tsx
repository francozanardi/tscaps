import { useEffect, useMemo, useState } from 'react';
import { WakeAndUnloadGuard } from '@presentation/editor/controllers/WakeAndUnloadGuard';
import { ExportFeedbackController } from '@presentation/export/controllers/ExportFeedbackController';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useExport } from '@ui/_shared/contexts/modules/ExportContext';
import { ExportFeedbackProvider } from '@ui/editor/ExportFeedbackContext';
import { useEditorBranch } from '@ui/_shared/hooks/useEditorBranch';
import { UnsavedChangesGuardInstaller } from '@ui/_shared/components/UnsavedChangesGuardInstaller';
import { EditorHost } from '@ui/editor/EditorHost';
import { LoadingSplash } from '@ui/_shared/components/LoadingSplash/LoadingSplash';
import { PreprocessingScreenHost } from '@ui/preprocessing/PreprocessingScreenHost';
import { StartFlowHost } from '@ui/preprocessing/StartFlowHost';
import { ExportingScreenHost } from '@ui/export/ExportingScreenHost';
import { ExportFlowHost } from '@ui/export/ExportFlowHost';

interface EditorShellHostProps {
  onBack: () => void;
}

/**
 * Picks which top-level subtree the editor route renders: the
 * preprocessing splash, the exporting splash, or the normal editor
 * surface. Each branch is mounted exclusively — switching tears down
 * the previous subtree so its subscriptions, controllers, and effects
 * are torn down with it.
 *
 * Owns the `ExportFeedbackController` (shared by all editor-route
 * branches) and exposes it through `<ExportFeedbackProvider>`. Hosts a
 * `WakeAndUnloadGuard` for the long-running branches and the
 * `settingsOpen` flag that coordinates between the toolbar's "Export"
 * button and the dialog mount.
 */
export function EditorShellHost({ onBack }: EditorShellHostProps) {
  const editor = useEditor();
  const exports = useExport();
  const exportFeedback = useMemo(
    () => new ExportFeedbackController(exports.runStore, editor.store),
    [exports.runStore, editor.store],
  );

  useEffect(() => {
    exportFeedback.start();
    return () => exportFeedback.stop();
  }, [exportFeedback]);

  const branch = useEditorBranch(editor.store, exportFeedback);
  const [exportSettingsOpen, setExportSettingsOpen] = useState(false);

  // Long-running branches need a guard that prevents the OS from
  // sleeping and prompts the user before they navigate away. The
  // editor branch already owns its own focus, so no guard runs there.
  useEffect(() => {
    if (branch === 'editor') return;
    const guard = new WakeAndUnloadGuard();
    guard.start();
    return () => guard.stop();
  }, [branch]);

  const branchTree = branch === 'loading-project' ? (
    <LoadingSplash label="Opening project…" />
  ) : branch === 'preprocessing' ? (
    <PreprocessingScreenHost />
  ) : branch === 'exporting' ? (
    <>
      <ExportingScreenHost />
      <ExportFlowHost
        settingsOpen={exportSettingsOpen}
        onSettingsOpenChange={setExportSettingsOpen}
      />
    </>
  ) : (
    <>
      <EditorHost
        onOpenExportSettings={() => setExportSettingsOpen(true)}
        onBack={onBack}
      />
      <StartFlowHost onBack={onBack} />
      <ExportFlowHost
        settingsOpen={exportSettingsOpen}
        onSettingsOpenChange={setExportSettingsOpen}
      />
    </>
  );

  const renderedBranch = branchTree;

  return (
    <ExportFeedbackProvider value={exportFeedback}>
      <UnsavedChangesGuardInstaller />
      {renderedBranch}
    </ExportFeedbackProvider>
  );
}
