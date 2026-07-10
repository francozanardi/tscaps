import { useEffect, useState } from 'react';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportFeedbackController } from '@presentation/export/controllers/ExportFeedbackController';

export type EditorBranch = 'loading-project' | 'preprocessing' | 'exporting' | 'editor';

function selectBranch(store: EditorStore, feedback: ExportFeedbackController): EditorBranch {
  const snapshot = store.snapshot();
  if (snapshot.status === 'loading-project') return 'loading-project';
  if (snapshot.status === 'preprocessing') return 'preprocessing';
  if (feedback.phase !== null) return 'exporting';
  return 'editor';
}

/**
 * Subscribes to the editor store and the export feedback controller and
 * returns which top-level branch the editor route should render: a
 * project-loading splash while mode-scoped resources hydrate, the
 * preprocessing splash, the exporting splash (with its post-completion
 * 4-second hold), or the normal editor surface.
 *
 * Re-renders the consumer only when the branch itself flips —
 * intermediate per-frame mutations of either source do not propagate.
 */
export function useEditorBranch(
  store: EditorStore,
  feedback: ExportFeedbackController,
): EditorBranch {
  const [branch, setBranch] = useState<EditorBranch>(() => selectBranch(store, feedback));

  useEffect(() => {
    const update = () => {
      const next = selectBranch(store, feedback);
      setBranch((prev) => (prev === next ? prev : next));
    };
    store.addEventListener('change', update);
    feedback.addEventListener('change', update);
    update();
    return () => {
      store.removeEventListener('change', update);
      feedback.removeEventListener('change', update);
    };
  }, [store, feedback]);

  return branch;
}
