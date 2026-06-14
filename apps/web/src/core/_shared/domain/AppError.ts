import type { AppErrorName } from '@core/_shared/domain/AppErrorName';

/**
 * Marker base class for typed errors in the app's domain hierarchy.
 *
 * Subclasses describe *what* failed in their own terms — never the
 * pipeline stage or the caller. The `message` field carries technical
 * text intended for support and telemetry, not user-facing copy. UI
 * copy lives at the rendering boundary and is selected by switching
 * on the `name` field; that field is typed to the closed `AppErrorName`
 * union so the dispatch sites get exhaustiveness checking and renames
 * propagate as compile errors instead of silent fallthroughs.
 *
 * `AppErrorClassifier.wrap` is the only sanctioned way to promote an
 * arbitrary thrown value into this hierarchy, so the store and the
 * UI can rely on every error being an `AppError`.
 */
export abstract class AppError extends Error {
  abstract override readonly name: AppErrorName;
}
