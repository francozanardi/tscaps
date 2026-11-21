import type { Document } from '@tscaps/engine';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ExportRenderPlanRequest } from '@core/export/services/ExportRenderPlanner';
import type { Sheet } from '@core/sheets/domain/Sheet';

/** What each host decides for itself about a plan, rather than reading it off the editor's state. */
export interface ExportRenderPlanHostInputs {
  /** What the soundtrack's word anchors read, or null where nothing in the plan reads it. */
  readonly originalDocument: Document | null;
  /** With the emoji edits below, which of the Original track's emojis show, for the soundtrack's emoji anchors; empty where nothing reads them. */
  readonly originalSheets: ReadonlyArray<Sheet>;
  readonly originalDecorationOverrides: DecorationOverrideRegistry;
  /** The soundtrack the render carries; the empty mix where it carries none. */
  readonly audio: AudioMix;
  /** The media files the shots may show. */
  readonly media: MediaAssetCatalog;
  readonly signal: AbortSignal;
}

/**
 * Reads what a plan needs out of the editor's state, the same way for
 * every host that plans a render of it, so no host plans from a field
 * another one leaves out.
 */
export class ExportRenderPlanRequestBuilder {

  /** Throws when the state holds no document, since there is nothing to plan. */
  build(state: EditorState, host: ExportRenderPlanHostInputs): ExportRenderPlanRequest {
    if (state.document === null) throw new Error('A render cannot be planned without a document.');
    return {
      document: state.document,
      originalDocument: host.originalDocument,
      originalSheets: host.originalSheets,
      originalDecorationOverrides: host.originalDecorationOverrides,
      sheets: state.sheets,
      elementStyles: state.elementStyles,
      decorationOverrides: state.decorationOverrides,
      cuts: state.cuts,
      behindActorOverrides: state.behindActorOverrides,
      projectId: state.projectId,
      frameLayout: state.frameLayout,
      outputFrame: state.outputFrame,
      colorGrade: state.colorGrade,
      shots: state.shots,
      media: host.media,
      audio: host.audio,
      videoDurationSec: state.video.duration > 0 ? state.video.duration : null,
      signal: host.signal,
    };
  }
}
