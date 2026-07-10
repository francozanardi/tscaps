import type { BoxEdges, BehindActorRequirement } from '@tscaps/engine';

/**
 * Preview-only switch for templates that consume the video frame.
 *
 * - `omit`: no live layer; the template handles preview itself if it
 *   wants any visual tied to the video (e.g. `backdrop-filter`).
 * - `live`: a `<video srcObject>` mirroring the main player is
 *   mounted as `.tscaps-video-frame-layer`, so one CSS rule lands in
 *   both preview and export.
 *
 * See `templates/AUTHORING.md §8.4` for the full contract.
 */
export type VideoFramePreviewMode = 'omit' | 'live';

/**
 * Declares whether a template's visuals depend on the video frame.
 * `jpegQuality` and `previewMode` are consulted only when `required`
 * is true.
 */
export interface VideoFrameRequirement {
  readonly required: boolean;
  /** JPEG quality in `[0, 1]`. */
  readonly jpegQuality: number;
  /** Default `'omit'`. */
  readonly previewMode: VideoFramePreviewMode;
}

/**
 * Template's rendering switches. Web-side counterpart of the
 * engine's `RenderingConfig` — narrowed at the boundary in
 * `ExportVideoAction`.
 */
export interface RenderingConfig {
  readonly splitWordsIntoLetters: boolean;
  readonly videoFrame: VideoFrameRequirement;
  readonly padding: BoxEdges | null;
  readonly behindActor: BehindActorRequirement;
}
