import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Reports which parts of the editor a visit reaches: each mode, each tab
 * of the Video mode, each page of the inspector for each kind of
 * element, the first time it opens; the first search of the graphic
 * presets, and the first time the media library is shown shut.
 *
 * Once per value for as long as the instance lives, which is meant to be
 * the page load: what these answer is whether a visit found a part of the
 * editor at all, and a visitor moving back and forth between two tabs
 * would otherwise outweigh every visitor who opened each once.
 */
export class EditorNavigationTelemetryReporter {
  private readonly reported = new Set<string>();

  constructor(private readonly telemetry: Telemetry) {}

  modeOpened(mode: string): void {
    if (!this.firstTime(`mode:${mode}`)) return;
    this.telemetry.capture('editor_mode_opened', { mode });
  }

  videoTabOpened(tab: string): void {
    if (!this.firstTime(`video-tab:${tab}`)) return;
    this.telemetry.capture('video_tab_opened', { tab });
  }

  /** `elementKind` names what the inspector is open on (`shot`, `graphic`, `word`…), `tab` the page shown. */
  inspectorTabOpened(elementKind: string, tab: string): void {
    if (!this.firstTime(`inspector:${elementKind}:${tab}`)) return;
    this.telemetry.capture('inspector_tab_opened', { element_kind: elementKind, tab });
  }

  /** The graphic presets were searched; `resultsEmpty` says the search found none. Never the words searched. */
  graphicPresetsSearched(resultsEmpty: boolean): void {
    if (!this.firstTime('graphic-presets-searched')) return;
    this.telemetry.capture('graphic_presets_searched', { results_empty: resultsEmpty });
  }

  /** The media library was shown shut behind the sign-up it needs. */
  mediaLibraryGateShown(): void {
    if (!this.firstTime('media-library-gate')) return;
    this.telemetry.capture('media_library_gate_shown', {});
  }

  private firstTime(key: string): boolean {
    if (this.reported.has(key)) return false;
    this.reported.add(key);
    return true;
  }
}
