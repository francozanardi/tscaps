/**
 * Exhaustive set of telemetry event names the app emits. New events
 * are added here first so call sites are typo-checked at compile time
 * and the taxonomy stays discoverable from a single place.
 *
 * Each name is snake_case, past-tense for completed effects
 * (`export_completed`) and present-tense for intents
 * (`video_dropped`). Event-specific properties travel alongside the
 * name in the `capture` call.
 */
export type TelemetryEventName =
  | 'landing_viewed'
  | 'video_dropped'
  | 'preprocessing_started'
  | 'preprocessing_completed'
  | 'preprocessing_failed'
  | 'template_selected'
  | 'export_started'
  | 'export_completed'
  | 'export_failed'
  | 'template_used_at_export';
