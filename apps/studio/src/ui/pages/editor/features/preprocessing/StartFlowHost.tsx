import { useEffect, useState } from 'react';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PreprocessingFlowStore } from '@core/preprocessing/store/PreprocessingFlowStore';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useTranscription } from '@ui/_shared/contexts/modules/TranscriptionContext';
import { usePreprocessing } from '@ui/_shared/contexts/modules/PreprocessingContext';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import { StartDialog } from '@ui/pages/editor/features/preprocessing/StartDialog';

interface StartFlowHostProps {
  onBack: () => void;
}


function useDialogOpen(flow: PreprocessingFlowStore): boolean {
  const [open, setOpen] = useState<boolean>(() => flow.dialogOpen);
  useEffect(() => {
    const update = () => setOpen(flow.dialogOpen);
    flow.addEventListener('change', update);
    update();
    return () => flow.removeEventListener('change', update);
  }, [flow]);
  return open;
}

function useEditorSnapshot(store: EditorStore): EditorState {
  const [state, setState] = useState(() => store.snapshot());
  useEffect(() => {
    const update = () => setState(store.snapshot());
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [store]);
  return state;
}

/**
 * Hosts the start-video dialog. Listens to the derived `dialogOpen`
 * flag and mounts the dialog only while it is true. Cancel composes
 * "clear the loaded video" with the navigation callback supplied by
 * the route so the user lands back where the flow started.
 */
export function StartFlowHost({ onBack }: StartFlowHostProps) {
  const editor = useEditor();
  const transcription = useTranscription();
  const preprocessing = usePreprocessing();
  const { userAgentInspector } = useUtils();
  const open = useDialogOpen(preprocessing.flow);
  const state = useEditorSnapshot(editor.store);

  if (!open) return null;

  const handleCancel = () => {
    editor.actions.video.clear.execute();
    onBack();
  };


  return (
    <StartDialog
      open
      preference={state.transcribePreference}
      isMobileDevice={userAgentInspector.isMobile()}
      error={state.error}
      preprocessVideo={preprocessing.actions.preprocessVideo}
      updatePreference={transcription.actions.updatePreference}
      onCancel={handleCancel}
    />
  );
}

