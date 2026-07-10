import { useEffect, useMemo, useState } from 'react';
import { ScreenWakeLock } from '@presentation/editor/controllers/ScreenWakeLock';
import { BeforeUnloadPrompt } from '@presentation/editor/controllers/BeforeUnloadPrompt';
import { ExportFeedbackController } from '@presentation/export/controllers/ExportFeedbackController';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useExport } from '@ui/_shared/contexts/modules/ExportContext';
import { ExportFeedbackProvider } from '@ui/pages/editor/contexts/ExportFeedbackContext';
import { useEditorBranch } from '@ui/_shared/hooks/useEditorBranch';
import { UnsavedChangesGuardInstaller } from '@ui/_shared/components/UnsavedChangesGuardInstaller';
import { EditorHost } from '@ui/pages/editor/EditorHost';
import { LoadingSplash } from '@ui/_shared/components/LoadingSplash/LoadingSplash';
import { PreprocessingScreenHost } from '@ui/pages/editor/features/preprocessing/PreprocessingScreenHost';
import { StartFlowHost } from '@ui/pages/editor/features/preprocessing/StartFlowHost';
import { PersonSegmentationDialogHost } from '@ui/pages/editor/features/person-segmentation/PersonSegmentationDialogHost';
import { ExportingScreenHost } from '@ui/pages/editor/features/export/ExportingScreenHost';
import { ExportFlowHost } from '@ui/pages/editor/features/export/ExportFlowHost';

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
 * branches) and exposes it through `<ExportFeedbackProvider>`. Holds
 * the screen awake and blocks accidental unloads on the long-running
 * branches, and owns the `settingsOpen` flag that coordinates between
 * the toolbar's "Export" button and the dialog mount.
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

  // Long-running branches need to keep the screen awake and block
  // accidental tab closes. The editor branch runs its own dirty-aware
  // unload guard and its own playback wake lock, so neither runs here.
  useEffect(() => {
    if (branch === 'editor') return;
    const wakeLock = new ScreenWakeLock();
    const unloadPrompt = new BeforeUnloadPrompt();
    wakeLock.start();
    unloadPrompt.start();
    return () => {
      wakeLock.stop();
      unloadPrompt.stop();
    };
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
      <PersonSegmentationDialogHost />
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
