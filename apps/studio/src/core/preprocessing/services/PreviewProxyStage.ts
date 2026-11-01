import type { Document } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyProgressCallback } from '@core/preview/domain/PreviewProxyGenerator';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type {
  PreviewProxyResolution,
  PreviewProxyResolver,
} from '@core/preview/services/PreviewProxyResolver';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { ProxyTiming } from '@core/preprocessing/domain/ProxyTiming';

/**
 * Outcome of the preview-proxy step. `proxy` is the freshly encoded
 * proxy worth persisting, or `null` when a cached one was reused or
 * the pipeline is disabled. `elapsedMs` is how long the encode took,
 * or `null` when it never ran — an unmeasured step reads differently
 * from an instant one. `skippedByPolicy` marks a run the generation
 * policy judged not worth its cost; the source plays as-is.
 */
export interface PreviewProxyRun {
  readonly proxy: PreviewProxy | null;
  readonly elapsedMs: number | null;
  readonly skippedByPolicy: boolean;
}

/**
 * The preview-proxy step of a preprocessing run: decides when the
 * encode may start relative to the transcription, publishes the blob
 * the editor plays, and durably stores a freshly encoded proxy.
 *
 * Whether a proxy is produced at all is fixed for the session. With
 * the pipeline disabled the source itself is published as the preview
 * and no encoding happens.
 */
export class PreviewProxyStage {
  constructor(
    private readonly store: EditorStore,
    private readonly proxyResolver: PreviewProxyResolver,
    private readonly proxyRepository: PreviewProxyRepository,
    private readonly progressStore: PreprocessingProgressStore,
    private readonly proxyTiming: ProxyTiming,
    private readonly enabled: boolean,
  ) {}

  /**
   * Publishes the preview proxy in step with the transcribe run.
   * Resolves once the transcription has settled and the proxy phase
   * is on screen, reporting the freshly generated proxy so the caller
   * may persist it after the project row is durable.
   *
   * A transcribe failure short-circuits this method so the error
   * surfaces immediately instead of waiting for the proxy encoder to
   * finish — the encoder can take minutes and the visitor sees the
   * splash frozen until it does. The orphaned encoding is left to
   * settle in the background; its rejection is caught so it does not
   * bubble up as an unhandled promise.
   *
   * Timing is tuned to the active surface via `proxyTiming`:
   *
   * - `parallel-with-transcribe`: starts encoding once the transcriber
   *   leaves its audio-extract phase, so proxy I/O over the source
   *   does not compete with audio extraction. Encoding then runs
   *   alongside the transcribe HTTP roundtrip.
   * - `sequential-after-transcribe`: waits for transcribe to finish
   *   before encoding — used when transcribe runs a browser-side
   *   worker that would compete with the encoder for the CPU.
   */
  async run(source: Blob, transcribeInFlight: Promise<Document>): Promise<PreviewProxyRun> {
    if (!this.enabled) {
      this.store.patchVideo({ preview: { kind: 'original', file: source, reason: 'pipeline-disabled' } });
      return { proxy: null, elapsedMs: null, skippedByPolicy: false };
    }
    const reportProgress = (progress: number) => this.progressStore.setPreviewProxyProgress(progress);
    const generation = this.encodeAtScheduledMoment(source, transcribeInFlight, reportProgress);
    generation.catch(() => undefined);
    await transcribeInFlight;
    this.progressStore.enterPreviewProxyPhase();
    return generation;
  }

  /**
   * Publishes a source converted in the browser as the preview, without
   * encoding a proxy from it: it is already in a format every browser
   * plays, with key frames close enough to scrub, and the encode would
   * add minutes to a run the conversion already made long. A proxy can
   * still be generated on demand.
   */
  publishConvertedSource(source: Blob): PreviewProxyRun {
    const reason = this.enabled ? 'converted-source' : 'pipeline-disabled';
    this.store.patchVideo({ preview: { kind: 'original', file: source, reason } });
    return { proxy: null, elapsedMs: null, skippedByPolicy: false };
  }

  /**
   * Fires the proxy persistence in the background. The editor is
   * already playing the freshly generated proxy locally; a failure
   * to durably store it only impacts the next open of this project.
   */
  storeInBackground(proxy: PreviewProxy): void {
    const projectId = this.store.snapshot().projectId;
    if (projectId === null) return;
    void this.proxyRepository.store(projectId, proxy).catch((error) => {
      console.error('[preprocess] preview-proxy store failed', error);
    });
  }

  private async encodeAtScheduledMoment(
    source: Blob,
    transcribeInFlight: Promise<Document>,
    reportProgress: PreviewProxyProgressCallback,
  ): Promise<PreviewProxyRun> {
    await this.waitForStartMoment(transcribeInFlight);
    return this.resolveAndPublish(source, reportProgress);
  }

  private waitForStartMoment(transcribeInFlight: Promise<Document>): Promise<void> {
    if (this.proxyTiming === 'parallel-with-transcribe') {
      return this.waitForAudioExtractToFinish(transcribeInFlight);
    }
    return this.settleTranscribe(transcribeInFlight);
  }

  private async resolveAndPublish(
    source: Blob,
    onProgress: PreviewProxyProgressCallback,
  ): Promise<PreviewProxyRun> {
    const startedAt = performance.now();
    const resolution = await this.proxyResolver.fromSource(source, onProgress);
    this.store.patchVideo({ preview: resolution.preview });
    const skippedByPolicy = this.wasSkippedByPolicy(resolution);
    return {
      proxy: resolution.freshProxy,
      // A skipped run only measured a metadata probe; its near-zero
      // elapsed would pollute the encode-time telemetry.
      elapsedMs: skippedByPolicy ? null : Math.round(performance.now() - startedAt),
      skippedByPolicy,
    };
  }

  private wasSkippedByPolicy(resolution: PreviewProxyResolution): boolean {
    const { preview } = resolution;
    return preview.kind === 'original' && preview.reason === 'policy-skipped';
  }

  /**
   * Resolves once the progress store reports the audio-extract phase
   * is past — covers transcribers that emit a later phase (e.g. one
   * that moves into `inferring`) and transcribers that never went
   * through audio-extract at all. Also resolves when the transcribe
   * promise settles for any other reason, so a failure before the
   * phase advances does not leave the pipeline waiting forever.
   */
  private waitForAudioExtractToFinish(transcribeInFlight: Promise<Document>): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.progressStore.removeEventListener('change', onPhaseChange);
        resolve();
      };
      const onPhaseChange = () => {
        if (this.progressStore.isPhasePast('audio-extract')) finish();
      };
      this.progressStore.addEventListener('change', onPhaseChange);
      onPhaseChange();
      void transcribeInFlight.then(finish, finish);
    });
  }

  private settleTranscribe(transcribeInFlight: Promise<Document>): Promise<void> {
    return transcribeInFlight.then(
      () => undefined,
      () => undefined,
    );
  }
}
