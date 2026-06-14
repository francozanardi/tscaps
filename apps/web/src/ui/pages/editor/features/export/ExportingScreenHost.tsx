import { useEffect, useState } from 'react';
import type {
  ExportFeedbackController,
  ExportPhase,
} from '@presentation/export/controllers/ExportFeedbackController';
import { useExport } from '@ui/_shared/contexts/modules/ExportContext';
import { useExportFeedback } from '@ui/pages/editor/contexts/ExportFeedbackContext';
import {
  ExportingScreen,
  type ExportingScreenPhase,
} from '@ui/pages/editor/features/export/components/ExportingScreen';

function useExportPhase(feedback: ExportFeedbackController): ExportPhase {
  const [phase, setPhase] = useState<ExportPhase>(() => feedback.phase);
  useEffect(() => {
    const update = () => setPhase(feedback.phase);
    feedback.addEventListener('change', update);
    update();
    return () => feedback.removeEventListener('change', update);
  }, [feedback]);
  return phase;
}

/**
 * Mounts the full-viewport export splash and feeds it the progress
 * store plus the current phase. Rendered only while the editor is in
 * the `exporting` branch; once the feedback controller's phase clears,
 * the shell unmounts this bridge entirely.
 */
export function ExportingScreenHost() {
  const exports = useExport();
  const exportFeedback = useExportFeedback();
  const phase = useExportPhase(exportFeedback);
  if (phase === null) return null;

  const screenPhase: ExportingScreenPhase = phase;

  return (
    <main className="flex flex-col items-center justify-center h-dvh overflow-hidden px-3 py-2 lg:px-6 lg:py-4">
      <ExportingScreen progressStore={exports.progressStore} phase={screenPhase} />
    </main>
  );
}
