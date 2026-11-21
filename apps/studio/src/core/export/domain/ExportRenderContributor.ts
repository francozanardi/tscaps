import type { Document, RenderAudioMix, RenderFootage } from '@tscaps/engine';
import type { TopLayerSource } from '@tscaps/engine/advanced';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import type { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

/**
 * Snapshot of the render inputs a contributor may consult while
 * preparing its contribution. `document` is the render document, with
 * the words cuts remove already dropped; its times, like `shots` and
 * `cuts`, are in source time, as the project holds them.
 * `originalDocument` is what is said in the video, the Original
 * track's words in source time whatever caption track is active, and
 * `originalSheets` and `originalDecorationOverrides` decide which of its
 * emojis show; `audio` is the soundtrack this export carries, the empty
 * mix when it leaves the sound out.
 */
export interface ExportRenderContext {
  readonly document: Document;
  readonly originalDocument: Document | null;
  readonly originalSheets: ReadonlyArray<Sheet>;
  readonly originalDecorationOverrides: DecorationOverrideRegistry;
  readonly sheets: Sheet[];
  readonly behindActorOverrides: BehindActorOverrideRegistry;
  readonly projectId: string | null;
  readonly shots: ShotPartition;
  readonly media: MediaAssetCatalog;
  readonly cuts: CutRegistry;
  readonly audio: AudioMix;
  /** How long the source video runs, or null when that is not known. */
  readonly videoDurationSec: number | null;
  /** The output frame's size, which shot layers are laid out on, or null when that is not known. */
  readonly frameLayout: VideoLayout | null;
  /** The frame the video is exported in, and how the video sits in it. */
  readonly outputFrame: OutputFrame;
  /** The colour grade of the whole picture beneath the captions. */
  readonly colorGrade: ColorGrade;
  /**
   * Aborts when the run is abandoned. A contributor waiting on something
   * — a file coming down — stops waiting and rejects with the signal's
   * reason, an `AbortError`.
   */
  readonly signal: AbortSignal;
}

/**
 * What a contributor adds to the render. `segmentClasses` are extra
 * classes appended to each segment element's class list, keyed by
 * segment id; `topLayer` is an optional layer painted above the
 * captions; `elementsUnderTopLayer` are words and glyphs painted under
 * that layer while the rest of their caption paints over it;
 * `footage` is what is drawn on the video over stretches of the output,
 * and how each of its layers is drawn frame by frame, or null for none;
 * `unavailableFootage` names the files a layer was meant to show and
 * that could not be had, so the render can say it goes without them;
 * `audioMix` is what is mixed with the video's own sound, or null for
 * nothing; `unavailableAudio` names the sound files that could not be
 * had and are left out of it.
 * All may be empty when the contributor has nothing to add for this
 * export.
 */
export interface ExportRenderContribution {
  readonly segmentClasses: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly topLayer: TopLayerSource | null;
  readonly elementsUnderTopLayer: ReadonlySet<string>;
  readonly footage: RenderFootage | null;
  readonly unavailableFootage: ReadonlyArray<string>;
  readonly audioMix: RenderAudioMix | null;
  readonly unavailableAudio: ReadonlyArray<string>;
  /** What each layer of `audioMix` plays, by layer id, named as `unavailableAudio` names a file; empty without a mix. */
  readonly audioLayerFileNames: ReadonlyMap<string, string>;
}

/**
 * A feature that augments the export render without the export flow
 * knowing the feature exists. `prepare` runs once per export before
 * rendering starts and may perform async work (cache loads,
 * precomputation), which it gives up once the context's signal aborts; the returned contribution is consumed through the
 * generic channels only. At most one contributor per export may
 * return a `topLayer`, at most one `footage`, and at most one `audioMix`.
 */
export interface ExportRenderContributor {
  prepare(context: ExportRenderContext): Promise<ExportRenderContribution>;
}
