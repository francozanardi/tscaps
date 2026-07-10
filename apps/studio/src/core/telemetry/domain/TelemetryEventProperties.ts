/**
 * Free-form bag of properties travelling alongside a telemetry event.
 * Values are scalar or array-of-scalar — telemetry backends serialize
 * properties as JSON and nested objects are discouraged because they
 * make per-property querying awkward.
 */
export type TelemetryEventProperties = Record<string, TelemetryEventPropertyValue>;

export type TelemetryEventPropertyValue =
  | string
  | number
  | boolean
  | null
  | readonly string[]
  | readonly number[];
