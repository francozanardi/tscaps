import type { SegmentSplitter } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/ControlField';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

/**
 * A view of a splitter's user-facing controls after applying any runtime
 * transforms. `fields` may carry different bounds or defaults than the
 * descriptor's raw `controlsSchema`; `values` are keyed by field id and
 * line up with whatever `fields` ended up exposing.
 */
export interface SegmentSplitterDisplay {
  readonly fields: readonly ControlField[];
  readonly values: Readonly<Record<string, ControlValue>>;
}

/** Runtime context required by splitters whose cuts depend on rendered typography. */
export interface SegmentSplitterContext {
  /** Current sheet font-size in the same unit as `TypographyConfig.fontSize` (cqh). */
  fontSize: number;
  /** Template default font-size, used as the calibration baseline for size-aware limits. */
  referenceFontSize: number;
}

// Describes one concrete segment splitter: its type discriminator, its default
// config, which fields the user can edit, and how to build a splitter instance.
// One descriptor per splitter type lives in its own file and is registered in
// SegmentSplitterRegistry.
export interface SegmentSplitterDescriptor<TConfig extends SegmentSplitterConfig = SegmentSplitterConfig> {
  readonly type: TConfig['type'];
  readonly defaultConfig: TConfig;
  readonly controlsSchema: readonly ControlField[];
  build(config: TConfig, context: SegmentSplitterContext): SegmentSplitter;
  /**
   * Projects the raw stored config into the shape used for editing.
   * Implementations whose config is context-independent return their
   * schema and stored values unchanged; implementations that depend on
   * runtime context (e.g. current typography) may reshape values, bounds,
   * or defaults so they stay meaningful at the current rendering state.
   */
  toDisplay(config: TConfig, context: SegmentSplitterContext): SegmentSplitterDisplay;
  /**
   * Inverse of `toDisplay` for a single field: receives a value entered
   * against the projected schema and returns the raw-config patch that
   * persists it.
   */
  fromDisplay(fieldId: string, displayValue: ControlValue, context: SegmentSplitterContext): Partial<TConfig>;
}
