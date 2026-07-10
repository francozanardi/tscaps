import * as Engine from '@tscaps/engine';
import { profiler } from '@tscaps/engine';
import type { ExportStore } from '@core/export/store/ExportStore';

// Render-pipeline classes we want timed. Other engine classes are skipped to
// keep the report focused and to avoid profiler overhead on hot per-word /
// per-letter code paths in the document model.
const PROFILED_CLASSES = new Set([
  'MediaBunnyVideoRenderer',
  'BrowserSubtitleFrameRenderer',
  'LayeredFrameCompositor',
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
 * Wraps the engine namespace so the configured render-pipeline classes
 * report timings, and exposes the profiler on `window.__profiler` so it
 * can be poked from devtools mid-session.
 */
export function setupProfiler(): void {
  profiler.measureMemory = new URLSearchParams(window.location.search).has('memory');
  const touched = profiler.wrapNamespace(Engine, {
    classFilter: (name) => PROFILED_CLASSES.has(name),
  });
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
