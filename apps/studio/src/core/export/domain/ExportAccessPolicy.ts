import type { EditorState } from '@core/editor/domain/EditorState';

export type PlanGatedExportFeature = 'translations';

export type ExportAccess =
  | { readonly available: true }
  | {
      readonly available: false;
      readonly reason: { readonly kind: 'outside-plan'; readonly feature: PlanGatedExportFeature };
    };

/** Decides whether the editor's current output may leave the app. */
export interface ExportAccessPolicy {
  access(state: EditorState): ExportAccess;
}
