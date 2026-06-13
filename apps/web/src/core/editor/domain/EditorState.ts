import type { Document } from '@tscaps/engine';
import type { AppError } from '@core/_shared/domain/AppError';
import type { Template } from '@core/templates/domain/Template';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/editor/domain/SegmentOverrides';
import type { VideoState } from '@core/editor/domain/VideoState';

export type EditorStatus = 'idle' | 'preprocessing' | 'ready' | 'loading-project';

/**
 * Immutable snapshot of the editor state. This is what the UI consumes.
 *
 * Styling is partitioned across Sheets: each Sheet owns a Template and the
 * derived state for its part of the document (styleValues, splitter configs,
 * alignment). Sheet assignment lives in the raw Document itself: each raw
 * `Section.kind` holds a Sheet id, and the deriver runs that Sheet's
 * pipeline over the section's raw segments to build the corresponding
 * derived Section (also tagged with `kind`).
 *
 * The `project*` fields identify the persisted Project this state belongs
 * to. They are null/empty until a Project is created (currently triggered
 * at the start of the preprocessing pipeline) or until an existing one is
 * loaded via LoadProjectAction. Save actions gate persistence on
 * `projectId !== null`.
 */
export interface EditorState {
  readonly video: VideoState;
  readonly document: Document | null;
  readonly availableTemplates: Template[];
  readonly status: EditorStatus;
  /**
   * Typed error from the most recent failed editor-level operation
   * (export, transcription, project save, project load). Shared bucket
   * — only one operation can run at a time, so a single slot is
   * enough. The UI selects copy by inspecting the concrete error class.
   * Distinct from `video.loadError` which is specific to the `<video>`
   * element.
   */
  readonly error: AppError | null;
  readonly transcribePreference: TranscribePreference;
  // Sheets and the one currently being edited in the StyleTab. `sheets` is
  // empty until the editor is initialized; `main` is always the first entry
  // afterwards.
  readonly sheets: Sheet[];
  readonly activeSheetId: string | null;
  readonly wordStyleOverrides: WordStyleOverrideRegistry;
  readonly segmentOverrides: SegmentOverrides;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  // Persisted-project identity. null/empty until the project exists.
  readonly projectId: string | null;
  readonly projectName: string;
  readonly projectCreatedAt: Date | null;
  readonly projectThumbnail: Blob | null;
  /**
   * `true` when the current editor state has edits that have not been
   * persisted. Cleared by a successful save or a fresh load; raised by
   * any user-driven edit (undo/redo included).
   */
  readonly dirty: boolean;
}
