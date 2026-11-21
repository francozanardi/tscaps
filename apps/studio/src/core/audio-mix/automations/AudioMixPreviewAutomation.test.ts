import { describe, expect, it, vi } from 'vitest';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { Decoration, Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { AudioMixPreviewAutomation } from '@core/audio-mix/automations/AudioMixPreviewAutomation';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioSourceFiles } from '@core/audio-mix/domain/AudioSourceFiles';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import { AudioMixLayerBuilder } from '@core/audio-mix/services/AudioMixLayerBuilder';
import { FootageSoundReader } from '@core/audio-mix/services/FootageSoundReader';
import { HeldAudioSourceFiles } from '@core/audio-mix/services/HeldAudioSourceFiles';
import { RenderAudioMixBuilder } from '@core/audio-mix/services/RenderAudioMixBuilder';
import { SpeechSpanReader } from '@core/audio-mix/services/SpeechSpanReader';
import { AudioMixPreviewStore } from '@core/audio-mix/store/AudioMixPreviewStore';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PreviewAudioMix } from '@core/preview/domain/PreviewAudioMix';
import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { EMOJI_GAP_DEFAULT, EMOJI_PLACEMENT_DEFAULT, EMOJI_SIZE_DEFAULT } from '@core/effect/domain/EffectConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import type { Template } from '@core/templates/domain/Template';
import { BODY_ONLY_MODES } from '@core/templates/domain/definition/TemplateMode';

/**
 * The preview plays the soundtrack the export would mix, resolved
 * against the edit as it stands: a clip follows its word through a cut,
 * and the video's own level goes with it. A file is read once and
 * handed over as the same object from one edit to the next, so the
 * surface never opens it again; a file still coming in joins once it
 * lands, and one that cannot be had stays silent and is named.
 */

const SPEECH = new Document({
  sections: [new Section({
    kind: 'main',
    segments: [new Segment({
      lines: [new Line({ words: [new Word({ id: 'there', text: 'there', time: new TimeFragment(4, 4.5) })] })],
    })],
  })],
});

function audioAsset(id: string): MediaAsset {
  return {
    id,
    type: 'audio',
    owner: { kind: 'library' },
    fileName: `${id}.mp3`,
    mimeType: 'audio/mpeg',
    sizeBytes: 3,
    widthPx: null,
    heightPx: null,
    durationSec: 0.5,
  };
}

const WHOOSH: AudioClip = {
  id: 'whoosh at there',
  role: 'effect',
  source: { kind: 'media', mediaId: 'whoosh' },
  start: { anchor: { kind: 'word', wordId: 'there', edge: 'start' }, offsetSec: 0 },
  end: null,
  inSec: 0,
  loop: false,
  volume: 1,
  fadeInSec: 0,
  fadeOutSec: 0,
  ducking: { enabled: false, depthDb: -12 },
};

/** Files read by hand: each read waits until the test lets it land, with the file or with nothing. */
class ControlledAudioSourceFiles implements AudioSourceFiles {
  readonly reads: string[] = [];
  private readonly pending = new Map<string, (file: Blob | null) => void>();

  load(source: AudioSourceRef): Promise<Blob | null> {
    const id = source.kind === 'media' ? source.mediaId : source.soundId;
    this.reads.push(id);
    return new Promise((resolve) => this.pending.set(id, resolve));
  }

  land(id: string, file: Blob | null): void {
    this.pending.get(id)?.(file);
    this.pending.delete(id);
  }
}

class RecordingSurface {
  mix: PreviewAudioMix | null = null;

  setAudioMix(mix: PreviewAudioMix): void {
    this.mix = mix;
  }
}

function harness() {
  const store = new EditorStore();
  store.patch({ document: SPEECH, cuts: CutRegistry.fromSnapshot([{ startSec: 2, endSec: 3 }]) });
  store.patchVideo({ duration: 10 });
  const assets = new MediaAssetStore();
  assets.put(audioAsset('whoosh'));
  const files = new ControlledAudioSourceFiles();
  const surface = new RecordingSurface();
  const preview = new AudioMixPreviewStore();
  const builtinSounds = new StaticFileBuiltinSoundCatalog([], '/');
  const automation = new AudioMixPreviewAutomation(
    store,
    surface as unknown as VideoPreviewSurface,
    new AudioMixLayerBuilder(new AudioAnchorTiming(new ShotLayerTiming(new ShotLayerAssetReader()), new ShotLayerSplitTransitions(), new ShotLayerInsetTransitions(), new ShotTransitionCuts(), new DecorationFilter(new DecorationVisibility())), new SpeechSpanReader(), new FootageSoundReader(new ShotLayerTiming(new ShotLayerAssetReader()))),
    new RenderAudioMixBuilder(),
    new HeldAudioSourceFiles(files),
    new OriginalCaptionTrackReader(),
    builtinSounds,
    assets,
    preview,
  );
  return { store, assets, files, surface, preview, automation };
}

const TEMPLATE = { styleControls: [], variants: [], metadata: { id: 't' }, effectConfigs: [], modes: BODY_ONLY_MODES } as unknown as Template;

/** The sheet the captions route to, with automatic emojis on or off. */
function sheetShowingEmojis(enabled: boolean): Sheet {
  return Sheet.fromTemplate('main', 'main', null, TEMPLATE, 'ltr').with({
    effectConfigs: [{ type: 'emoji', enabled, placement: EMOJI_PLACEMENT_DEFAULT, size: EMOJI_SIZE_DEFAULT, gap: EMOJI_GAP_DEFAULT }],
  });
}

function withClips(store: EditorStore, sourceVolume: number, ...clips: AudioClip[]): void {
  store.patch({ audio: clips.reduce((mix, clip) => mix.withClipAdded(clip), AudioMix.empty().withSourceVolume(sourceVolume)) });
}

describe('AudioMixPreviewAutomation', () => {
  it('plays a clip where the export places it, with the video at its level, once its file lands', async () => {
    const { store, files, surface, preview, automation } = harness();
    withClips(store, 0.5, WHOOSH);
    automation.start();

    await vi.waitFor(() => expect(surface.mix?.inputGain).toBe(0.5));
    expect(surface.mix?.layers).toEqual([]);
    expect(preview.snapshot()?.reading).toEqual([{ kind: 'media', mediaId: 'whoosh' }]);

    files.land('whoosh', new Blob(['whoosh']));

    await vi.waitFor(() => expect(surface.mix?.layers).toHaveLength(1));
    // "there" starts at 4 s, one second of cut before it.
    expect(surface.mix?.layers[0]).toMatchObject({ id: 'whoosh at there', outputStartSec: 3, outputEndSec: 3.5 });
    expect(surface.mix?.outputDurationSec).toBe(9);
    expect(preview.snapshot()?.layers.map((layer) => layer.id)).toEqual(['whoosh at there']);
  });

  it('hands over the same file after an edit, without reading it again', async () => {
    const { store, files, surface, automation } = harness();
    withClips(store, 1, WHOOSH);
    automation.start();
    files.land('whoosh', new Blob(['whoosh']));
    await vi.waitFor(() => expect(surface.mix?.layers).toHaveLength(1));
    const first = surface.mix!.layers[0]!.source;

    store.patch({ audio: store.snapshot().audio.withClipsPatched([WHOOSH.id], { volume: 0.3 }) });

    await vi.waitFor(() => expect(surface.mix?.layers[0]?.gain).toBe(0.3));
    expect(surface.mix?.layers[0]?.source).toBe(first);
    expect(files.reads).toEqual(['whoosh']);
  });

  it('plays a sound on an emoji once automatic emojis show it', async () => {
    const { store, files, surface, preview, automation } = harness();
    const there = SPEECH.getWords()[0]!.with({ decoration: new Decoration({ id: 'there:d', glyph: '🔥' }) });
    store.patch({
      document: new Document({ sections: [new Section({ kind: 'main', segments: [new Segment({ lines: [new Line({ words: [there] })] })] })] }),
      sheets: [sheetShowingEmojis(false)],
    });
    withClips(store, 1, { ...WHOOSH, start: { anchor: { kind: 'emoji', decorationId: 'there:d' }, offsetSec: 0 } });
    automation.start();
    await vi.waitFor(() => expect(surface.mix?.inputGain).toBe(1));
    expect(surface.mix?.layers).toEqual([]);
    expect(preview.snapshot()?.reading).toEqual([]);

    store.patch({ sheets: [sheetShowingEmojis(true)] });
    await vi.waitFor(() => expect(preview.snapshot()?.reading).toEqual([{ kind: 'media', mediaId: 'whoosh' }]));
    files.land('whoosh', new Blob(['whoosh']));

    await vi.waitFor(() => expect(surface.mix?.layers).toHaveLength(1));
    expect(surface.mix?.layers[0]).toMatchObject({ outputStartSec: 3 });
  });

  it('follows the cuts: a clip moves with its word', async () => {
    const { store, files, surface, automation } = harness();
    withClips(store, 1, WHOOSH);
    automation.start();
    files.land('whoosh', new Blob(['whoosh']));
    await vi.waitFor(() => expect(surface.mix?.layers[0]?.outputStartSec).toBe(3));

    store.patch({ cuts: CutRegistry.fromSnapshot([]) });

    await vi.waitFor(() => expect(surface.mix?.layers[0]?.outputStartSec).toBe(4));
  });

  it('leaves silent and names a file that cannot be had, and tries it again when the media catalog changes', async () => {
    const { store, assets, files, surface, preview, automation } = harness();
    withClips(store, 1, WHOOSH);
    automation.start();

    files.land('whoosh', null);

    await vi.waitFor(() => expect(preview.snapshot()?.unavailable).toEqual([{ kind: 'media', mediaId: 'whoosh' }]));
    expect(surface.mix?.layers).toEqual([]);

    assets.put({ ...audioAsset('whoosh'), fileName: 'renamed.mp3' });
    files.land('whoosh', new Blob(['whoosh']));

    await vi.waitFor(() => expect(surface.mix?.layers).toHaveLength(1));
    expect(files.reads).toEqual(['whoosh', 'whoosh']);
  });

  it('silences the preview when stopped', async () => {
    const { store, files, surface, preview, automation } = harness();
    withClips(store, 0.5, WHOOSH);
    automation.start();
    files.land('whoosh', new Blob(['whoosh']));
    await vi.waitFor(() => expect(surface.mix?.layers).toHaveLength(1));

    automation.stop();

    expect(surface.mix).toEqual({ layers: [], inputGain: 1, inputDucks: [], outputDurationSec: Number.POSITIVE_INFINITY });
    expect(preview.snapshot()).toBeNull();
  });
});
