import * as Engine from '@tscaps/engine';
import * as EngineAdvanced from '@tscaps/engine/advanced';
import { profiler } from '@tscaps/engine/advanced';
import type { ExportStore } from '@core/export/store/ExportStore';

// Render-pipeline classes we want timed. Other engine classes are skipped to
// keep the report focused and to avoid profiler overhead on hot per-word /
// per-letter code paths in the document model.
//
// Only names the engine exports reach `wrapNamespace`, which reads the
// namespace object. A class kept internal has to carry its own
// `profiler.time` calls instead, and listing it here does nothing.
const PROFILED_CLASSES = new Set([
  'MediaBunnyVideoRenderer',
  'BrowserSubtitleFrameRenderer',
  'BrowserOverlayFrameRenderer',
  'LayeredFrameCompositor',
  'RenderJobFramePainter',
  'ComposedSubtitleLayerSource',
  'BatchedSubtitleLayerSource',
  'VideoBoundSubtitleLayerSource',
  'MediaBunnyCanvasVideoTrackEncoder',
  'WebCodecsVideoFrameDecoder',
  'HtmlVideoElementVideoFrameDecoder',
  'PassthroughAudioTrackBridge',
  'TranscodeAudioTrackBridge',
  'DiscardAudioTrackBridge',
  'BrowserCssResourceEmbedder',
  'CssScoper',
  'DefaultCodecPolicy',
  'MediaBunnyOutputTargetBuilder',
]);

/**
 * Profiling toggles off URL `?profile` or `localStorage['tscaps:profile']`.
 * Read once at boot — flipping the flag at runtime requires a reload.
 */
export function isProfilingEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('profile') ||
      localStorage.getItem('tscaps:profile') === '1');
}

/**
 * Wraps both engine entries' namespaces so the configured render-pipeline classes
 * report timings, and exposes the profiler on `window.__profiler` so it
 * can be poked from devtools mid-session.
 */
export function setupProfiler(): void {
  profiler.measureMemory = new URLSearchParams(window.location.search).has('memory');
  const options = { classFilter: (name: string) => PROFILED_CLASSES.has(name) };
  const touched = [
    ...profiler.wrapNamespace(Engine, options),
    ...profiler.wrapNamespace(EngineAdvanced, options),
  ];
  (window as unknown as { __profiler: typeof profiler }).__profiler = profiler;
  console.info('[tscaps profiler] instrumented:', touched, 'memory:', profiler.measureMemory);
}

/**
 * Watches the export store and prints the profiler report whenever an
 * export run finishes (transition from running to idle). Called from the
 * composition root only when profiling is enabled.
 */
export function instrumentExportLifecycle(exportStore: ExportStore): void {
  let wasExporting = exportStore.run !== null;
  exportStore.addEventListener('change', () => {
    const isExporting = exportStore.run !== null;
    if (wasExporting && !isExporting) profiler.printReport();
    wasExporting = isExporting;
  });
}
