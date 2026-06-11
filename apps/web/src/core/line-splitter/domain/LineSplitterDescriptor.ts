import type { LineSplitter } from '@tscaps/engine';
import type { ControlField } from '@core/templates/domain/ControlField';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';

/** Runtime context required by splitters that measure actual pixel widths. */
export interface LineSplitterContext {
  /** Template CSS (raw, unscoped). Applied to the DOM probe for accurate measurement. */
  css: string;
  /** CSS custom properties computed from style controls (e.g. { '--tscaps-font-size': '5.56cqh' }). */
  cssVars: Record<string, string>;
  videoWidth: number;
  videoHeight: number;
}

// Describes one concrete line splitter: its type discriminator, default config,
// editable controls, and how to build a splitter instance.
export interface LineSplitterDescriptor<TConfig extends LineSplitterConfig = LineSplitterConfig> {
  readonly type: TConfig['type'];
  readonly defaultConfig: TConfig;
  readonly controlsSchema: readonly ControlField[];
  build(config: TConfig, context: LineSplitterContext): LineSplitter;
}
