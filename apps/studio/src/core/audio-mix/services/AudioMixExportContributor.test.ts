import { describe, expect, it } from 'vitest';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioSourceFiles } from '@core/audio-mix/domain/AudioSourceFiles';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import { AudioMixExportContributor } from '@core/audio-mix/services/AudioMixExportContributor';
import { AudioMixLayerBuilder } from '@core/audio-mix/services/AudioMixLayerBuilder';
import { FootageSoundReader } from '@core/audio-mix/services/FootageSoundReader';
import { RenderAudioMixBuilder } from '@core/audio-mix/services/RenderAudioMixBuilder';
import { SpeechSpanReader } from '@core/audio-mix/services/SpeechSpanReader';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { ExportRenderContext } from '@core/export/domain/ExportRenderContributor';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';

/**
 * The export mixes every clip as the edit places it, from the files as
 * they were added, each read once however many clips play it. A file
 * that cannot be had is left out and named once, by the name the reader
 * gave it, and the rest of the soundtrack goes on.
 */

const SPEECH = new Document({
  sections: [new Section({
    kind: 'main',
    segments: [new Segment({
      lines: [new Line({ words: [
        new Word({ id: 'hello', text: 'hello', time: new TimeFragment(1, 1.5) }),
        new Word({ id: 'there', text: 'there', time: new TimeFragment(4, 4.5) }),
      ] })],
    })],
  })],
});

function audioAsset(id: string, durationSec: number): MediaAsset {
  return {
    id,
    type: 'audio',
    owner: { kind: 'library' },
    fileName: `${id}.mp3`,
    mimeType: 'audio/mpeg',
    sizeBytes: 3,
    widthPx: null,
    heightPx: null,
    durationSec,
  };
}

/** Holds the files named; counts every read. */
class InMemoryAudioSourceFiles implements AudioSourceFiles {
  readonly reads: string[] = [];

  constructor(private readonly held: ReadonlySet<string>) {}

  async load(source: AudioSourceRef): Promise<Blob | null> {
    const id = source.kind === 'media' ? source.mediaId : source.soundId;
    this.reads.push(id);
    return this.held.has(id) ? new Blob([id]) : null;
  }
}

/** A device still waiting for every file to come down. */
class NeverLandingAudioSourceFiles implements AudioSourceFiles {
  load(): Promise<Blob | null> {
    return new Promise(() => {});
  }
}

function contributorReading(files: AudioSourceFiles): AudioMixExportContributor {
  return new AudioMixExportContributor(
    new AudioMixLayerBuilder(new AudioAnchorTiming(new ShotLayerTiming(new ShotLayerAssetReader()), new ShotLayerSplitTransitions(), new ShotLayerInsetTransitions(), new ShotTransitionCuts(), new DecorationFilter(new DecorationVisibility())), new SpeechSpanReader(), new FootageSoundReader(new ShotLayerTiming(new ShotLayerAssetReader()))),
    new RenderAudioMixBuilder(),
    files,
    new StaticFileBuiltinSoundCatalog([{ id: 'pop-01', name: 'Pop', category: 'pop', lengthSec: 0.3, description: '', underVoiceVolume: 0.15 }], '/'),
  );
}

function clip(id: string, overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id,
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
    ...overrides,
  };
}

const MUSIC = clip('music', {
  role: 'music',
  source: { kind: 'media', mediaId: 'song' },
  start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 },
  end: { anchor: { kind: 'video', edge: 'end' }, offsetSec: 0 },
  loop: true,
  volume: 0.5,
  ducking: { enabled: true, depthDb: -12 },
});

function contextWith(
  clips: ReadonlyArray<AudioClip>,
  signal: AbortSignal = new AbortController().signal,
  sourceVolume = 0.8,
): ExportRenderContext {
  const audio = clips.reduce((mix, added) => mix.withClipAdded(added), AudioMix.empty().withSourceVolume(sourceVolume));
  return {
    document: SPEECH,
    originalDocument: SPEECH,
    originalSheets: [],
    originalDecorationOverrides: DecorationOverrideRegistry.empty(),
    sheets: [],
    behindActorOverrides: BehindActorOverrideRegistry.empty(),
    projectId: 'project',
    shots: ShotPartition.empty(),
    media: MediaAssetCatalog.of([audioAsset('whoosh', 0.5), audioAsset('song', 3), audioAsset('gone', 2)]),
    cuts: CutRegistry.fromSnapshot([{ startSec: 2, endSec: 3 }]),
    audio,
    videoDurationSec: 10,
    frameLayout: { width: 1080, height: 1920 },
    outputFrame: OutputFrame.original(),
    colorGrade: ColorGrade.neutral(),
    signal,
  };
}

describe('AudioMixExportContributor', () => {
  it('mixes each clip where the edit places it, with the video at its own level', async () => {
    const contribution = await contributorReading(new InMemoryAudioSourceFiles(new Set(['whoosh', 'song'])))
      .prepare(contextWith([clip('whoosh at there'), MUSIC]));

    const mix = contribution.audioMix;
    expect(mix?.inputGain).toBe(0.8);
    const effect = mix?.layers.find((layer) => layer.id === 'whoosh at there');
    // "there" starts at 4 s, one second of cut before it.
    expect(effect?.outputStartSec).toBe(3);
    expect(effect?.outputEndSec).toBe(3.5);
    const music = mix?.layers.find((layer) => layer.id === 'music');
    expect(music?.outputEndSec).toBe(9);
    expect(music?.sourcePassSec).toBe(3);
    expect(music?.duck?.ranges).toEqual([{ startSec: 1, endSec: 1.5 }, { startSec: 3, endSec: 3.5 }]);
    expect(await music?.source.text()).toBe('song');
  });

  it('reads a file once however many clips play it, and hands every clip the same file', async () => {
    const files = new InMemoryAudioSourceFiles(new Set(['whoosh']));
    const contribution = await contributorReading(files).prepare(contextWith([
      clip('first'),
      clip('second', { start: { anchor: { kind: 'word', wordId: 'hello', edge: 'start' }, offsetSec: 0 } }),
    ]));

    expect(files.reads).toEqual(['whoosh']);
    const [first, second] = contribution.audioMix?.layers ?? [];
    expect(first?.source).toBe(second?.source);
  });

  it('leaves out a file that cannot be had, names it once by its file name, and mixes the rest', async () => {
    const contribution = await contributorReading(new InMemoryAudioSourceFiles(new Set(['whoosh']))).prepare(contextWith([
      clip('whoosh at there'),
      clip('gone once', { source: { kind: 'media', mediaId: 'gone' } }),
      clip('gone twice', { source: { kind: 'media', mediaId: 'gone' }, start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 } }),
    ]));

    expect(contribution.unavailableAudio).toEqual(['gone.mp3']);
    expect(contribution.audioMix?.layers.map((layer) => layer.id)).toEqual(['whoosh at there']);
  });

  it('names a bundled sound it has no file for by its name, and contributes no mix when nothing is left to hear', async () => {
    const contribution = await contributorReading(new InMemoryAudioSourceFiles(new Set())).prepare(contextWith(
      [clip('pop', { source: { kind: 'builtin', soundId: 'pop-01' } })],
      undefined,
      1,
    ));

    expect(contribution.unavailableAudio).toEqual(['Pop']);
    expect(contribution.audioMix).toBeNull();
  });

  it('plays a bundled sound for the length the pack gives it', async () => {
    const contribution = await contributorReading(new InMemoryAudioSourceFiles(new Set(['pop-01']))).prepare(contextWith([
      clip('pop', { source: { kind: 'builtin', soundId: 'pop-01' } }),
    ]));

    const [pop] = contribution.audioMix?.layers ?? [];
    expect(pop?.outputStartSec).toBe(3);
    expect(pop?.outputEndSec).toBeCloseTo(3.3);
  });

  it('contributes nothing and reads nothing for a project with no clip and the video at its own level', async () => {
    const files = new InMemoryAudioSourceFiles(new Set(['whoosh']));
    const contribution = await contributorReading(files).prepare(contextWith([], undefined, 1));

    expect(contribution.audioMix).toBeNull();
    expect(contribution.unavailableAudio).toEqual([]);
    expect(files.reads).toEqual([]);
  });

  it('contributes the video at another level alone, reading nothing, when no clip is heard', async () => {
    const files = new InMemoryAudioSourceFiles(new Set(['whoosh']));
    const contribution = await contributorReading(files).prepare(contextWith([], undefined, 1.5));

    expect(contribution.audioMix).toEqual({ layers: [], inputGain: 1.5, inputDucks: [] });
    expect(files.reads).toEqual([]);
  });

  it('stops waiting for a file once the run is abandoned', async () => {
    const run = new AbortController();
    const prepared = contributorReading(new NeverLandingAudioSourceFiles()).prepare(contextWith([MUSIC], run.signal));

    run.abort(new DOMException('The export was cancelled.', 'AbortError'));

    await expect(prepared).rejects.toMatchObject({ name: 'AbortError' });
  });
});
