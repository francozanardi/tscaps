import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioAnchorResolution } from '@core/audio-mix/domain/AudioAnchorResolution';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import type { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';

/** A layer as its anchor names it: what kind of file it shows, and the number of its shot. */
interface LayerSubject {
  readonly label: string;
  readonly shotNumber: number;
}

/** An emoji as its anchor names it: its glyph, and the text of the word it is on. */
interface EmojiSubject {
  readonly glyph: string;
  readonly wordText: string;
}

/** What anchors can name in one context, by id, as they are called on screen. */
interface AnchorSubjects {
  readonly wordTexts: ReadonlyMap<string, string>;
  readonly emojis: ReadonlyMap<string, EmojiSubject>;
  readonly shotNumbers: ReadonlyMap<string, number>;
  readonly layers: ReadonlyMap<string, LayerSubject>;
}

/**
 * Says what a sound is on, the way a list of sounds names it: a word by
 * its text and where it plays (*“amazing” · 0:12.4*), an emoji by its
 * glyph and its word (*🔥 on “amazing” · 0:12.4*), a shot by its
 * number (*Shot 3 starts*), a layer by its kind and its shot (*B-roll
 * enters · Shot 3*), the video by its edge (*Video ends*). A word in a
 * cut, or an emoji that does not show, reads without a time, since it
 * plays nowhere; something gone says what it was.
 *
 * Shots are numbered from 1 in the order they play; a layer whose file
 * is not listed is a *Layer*.
 */
export class AudioAnchorLabels {
  private readonly subjectsByContext = new WeakMap<AudioTimingContext, AnchorSubjects>();

  constructor(
    private readonly layerAssets: ShotLayerAssetReader,
    private readonly layerLabels: ShotLayerLabels,
  ) {}

  /** What `anchor` names in `context`, where it lands as `resolution` says. */
  describe(anchor: AudioAnchor, resolution: AudioAnchorResolution, context: AudioTimingContext): string {
    const subjects = this.subjectsOf(context);
    switch (anchor.kind) {
      case 'word':
        return this.wordLabel(subjects.wordTexts.get(anchor.wordId), anchor.edge, resolution);
      case 'emoji':
        return this.emojiLabel(subjects.emojis.get(anchor.decorationId), resolution);
      case 'shot':
        return this.shotLabel(subjects.shotNumbers.get(anchor.shotId), anchor.edge, resolution);
      case 'transition':
        return this.transitionLabel(subjects.shotNumbers.get(anchor.shotId), resolution);
      case 'camera':
        return this.cameraLabel(subjects.shotNumbers.get(anchor.shotId), resolution);
      case 'layer-camera':
        return this.layerCameraLabel(subjects.layers.get(anchor.layerId), resolution);
      case 'layer':
        return this.layerLabel(subjects.layers.get(anchor.layerId), anchor.edge, resolution);
      case 'layer-transition':
        return this.layerTransitionLabel(subjects.layers.get(anchor.layerId), anchor, resolution, context);
      case 'layer-moment':
        return this.layerMomentLabel(subjects.layers.get(anchor.layerId), anchor, resolution, context);
      case 'video':
        return anchor.edge === 'start' ? 'Video starts' : 'Video ends';
    }
  }

  /** `seconds` as minutes, seconds and tenths: `0:12.4`, `1:05.0`. */
  clockOf(seconds: number): string {
    const tenths = Math.round(Math.max(0, seconds) * 10);
    const minutes = Math.floor(tenths / 600);
    const rest = (tenths - minutes * 600) / 10;
    return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
  }

  private wordLabel(text: string | undefined, edge: 'start' | 'end', resolution: AudioAnchorResolution): string {
    if (text === undefined || resolution.kind === 'gone') return 'Its word is gone';
    const quoted = `“${text}”`;
    const word = edge === 'start' ? quoted : `End of ${quoted}`;
    return resolution.kind === 'at' ? `${word} · ${this.clockOf(resolution.outputSec)}` : word;
  }

  private emojiLabel(emoji: EmojiSubject | undefined, resolution: AudioAnchorResolution): string {
    if (emoji === undefined || resolution.kind === 'gone') return 'Its emoji is gone';
    const label = `${emoji.glyph} on “${emoji.wordText}”`;
    return resolution.kind === 'at' ? `${label} · ${this.clockOf(resolution.outputSec)}` : label;
  }

  private shotLabel(shotNumber: number | undefined, edge: 'start' | 'end', resolution: AudioAnchorResolution): string {
    if (shotNumber === undefined || resolution.kind === 'gone') return 'Its shot is gone';
    return `Shot ${shotNumber} ${edge === 'start' ? 'starts' : 'ends'}`;
  }

  private transitionLabel(shotNumber: number | undefined, resolution: AudioAnchorResolution): string {
    if (shotNumber === undefined || resolution.kind === 'gone') return 'Its transition is gone';
    return `Transition into shot ${shotNumber}`;
  }

  private cameraLabel(shotNumber: number | undefined, resolution: AudioAnchorResolution): string {
    if (shotNumber === undefined || resolution.kind === 'gone') return 'Its camera is gone';
    return `Camera of shot ${shotNumber}`;
  }

  /** Named by the transition first, `Split line` or `Picture in picture`, then the layer and its end. */
  private layerTransitionLabel(
    layer: LayerSubject | undefined,
    anchor: Extract<AudioAnchor, { kind: 'layer-transition' }>,
    resolution: AudioAnchorResolution,
    context: AudioTimingContext,
  ): string {
    if (layer === undefined) return 'Its layer is gone';
    if (resolution.kind === 'gone') return 'Its transition is gone';
    const transition = context.shots.placementOf(anchor.layerId).kind === 'split' ? 'Split line' : 'Picture in picture';
    return `${transition} · ${layer.label} ${anchor.edge === 'entrance' ? 'enters' : 'exits'} · Shot ${layer.shotNumber}`;
  }

  /** Named by the moment, then the layer: `Button pressed · Graphic · Shot 2`. */
  private layerMomentLabel(
    layer: LayerSubject | undefined,
    anchor: Extract<AudioAnchor, { kind: 'layer-moment' }>,
    resolution: AudioAnchorResolution,
    context: AudioTimingContext,
  ): string {
    if (layer === undefined) return 'Its layer is gone';
    const shown = context.shots.findLayer(anchor.layerId);
    const moment = shown !== null && 'graphic' in shown ? shown.graphic.moments.find((candidate) => candidate.id === anchor.momentId) : undefined;
    if (moment === undefined) return `Its moment “${anchor.momentId}” is gone`;
    if (resolution.kind === 'gone') return `${moment.label} · after the ${layer.label.toLowerCase()} ends`;
    return `${moment.label} · ${layer.label} · Shot ${layer.shotNumber}`;
  }

  private layerCameraLabel(layer: LayerSubject | undefined, resolution: AudioAnchorResolution): string {
    if (layer === undefined) return 'Its layer is gone';
    if (resolution.kind === 'gone') return 'Its camera is gone';
    return `Camera of ${layer.label.toLowerCase()} · Shot ${layer.shotNumber}`;
  }

  private layerLabel(layer: LayerSubject | undefined, edge: 'entry' | 'exit', resolution: AudioAnchorResolution): string {
    if (layer === undefined || resolution.kind === 'gone') return 'Its layer is gone';
    return `${layer.label} ${edge === 'entry' ? 'enters' : 'exits'} · Shot ${layer.shotNumber}`;
  }

  private subjectsOf(context: AudioTimingContext): AnchorSubjects {
    const known = this.subjectsByContext.get(context);
    if (known !== undefined) return known;
    const subjects: AnchorSubjects = {
      wordTexts: this.wordTextsOf(context),
      emojis: this.emojisOf(context),
      shotNumbers: new Map(context.shots.list().map((shot, index) => [shot.id, index + 1])),
      layers: this.layersOf(context),
    };
    this.subjectsByContext.set(context, subjects);
    return subjects;
  }

  private wordTextsOf(context: AudioTimingContext): ReadonlyMap<string, string> {
    return new Map((context.originalDocument?.getWords() ?? []).map((word) => [word.id, word.text.trim()]));
  }

  /** The emojis on the Original track's words, by id, under the glyph the person may have changed them to. */
  private emojisOf(context: AudioTimingContext): ReadonlyMap<string, EmojiSubject> {
    return new Map((context.originalDocument?.getWords() ?? []).flatMap((word) => {
      if (word.decoration === null) return [];
      const glyph = context.originalDecorationOverrides.get(word.decoration.id).glyph ?? word.decoration.glyph;
      return [[word.decoration.id, { glyph, wordText: word.text.trim() }] as const];
    }));
  }

  private layersOf(context: AudioTimingContext): ReadonlyMap<string, LayerSubject> {
    return new Map(context.shots.list().flatMap((shot, index) => shot.layers.map((layer) => {
      const kind = this.layerAssets.assetOf(layer, context.media)?.kind ?? null;
      const label = kind === null ? 'Layer' : this.layerLabels.labelOf(kind);
      return [layer.id, { label, shotNumber: index + 1 }] as const;
    })));
  }
}
