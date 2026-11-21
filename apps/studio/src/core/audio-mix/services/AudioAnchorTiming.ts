import type { Document, Word } from '@tscaps/engine';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioAnchorResolution } from '@core/audio-mix/domain/AudioAnchorResolution';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { DecorationFilter } from '@core/captions/services/DecorationFilter';
import type { ShotLayerStretch } from '@core/shots/domain/ShotLayerStretch';
import type { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import type { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import type { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import type { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { OUTPUT_TIME_TOLERANCE_SEC } from '@core/cuts/domain/OutputTimeTolerance';

/** A stretch of source time, in seconds. */
interface SourceSpan {
  readonly startSec: number;
  readonly endSec: number;
}

/** A layer as an anchor reads it: where its shot opens, and when it shows, or null where it is cut away. */
interface LayerTarget {
  readonly shotStartSec: number;
  readonly stretch: ShotLayerStretch | null;
}

/** An emoji as an anchor reads it: the word it is on, and whether its captions show it. */
interface EmojiTarget {
  readonly word: Word;
  readonly shown: boolean;
}

/** Everything an anchor can name in one context, by id. */
interface AnchorTargets {
  readonly words: ReadonlyMap<string, Word>;
  readonly shots: ReadonlyMap<string, SourceSpan>;
  /** The shots whose transition plays, and the cut of the output it plays over. */
  readonly playedTransitions: ReadonlyMap<string, number>;
  /** The shots that have a transition, playing or not. */
  readonly transitions: ReadonlySet<string>;
  readonly layers: ReadonlyMap<string, LayerTarget>;
}

/**
 * Answers where an anchor point lands on the output, in one place, so
 * the preview, the export and the lists that show a clip cannot
 * disagree.
 *
 * - A word of the Original track: its source time at the chosen edge,
 *   through the cuts. A word whose start is cut away is in a cut at
 *   either edge; a cut that takes only its tail moves its end to where
 *   the cut starts.
 * - An emoji of the Original track: its word's start, as above, while
 *   the Original track's captions show it ({@link DecorationFilter}'s
 *   rule, in a caption that is not hidden); hidden otherwise, which a
 *   change of template, layout or setting can undo. Gone where no word
 *   holds it or it was removed.
 * - A shot: where it opens or ends, through the cuts. One cut away
 *   whole is in a cut. Only a partition somebody edited has shots to
 *   name; a proposal's are gone.
 * - The transition into a shot: the cut it plays over, as
 *   {@link ShotTransitionCuts} says, so a shot cut away whole does not
 *   silence the transition that still plays between the shots around
 *   it. One that does not play is in a cut; gone where the shot has no
 *   transition (any more).
 * - A shot layer's layout transition (a split's line, a box's way from
 *   or to the whole frame): the middle of it, where it moves fastest, as
 *   long as the layer's CSS plays it (at most half the layer); gone
 *   where that end is a cut, or the layout has no such transition.
 * - A shot layer: where it enters or exits, as {@link ShotLayerTiming}
 *   lays it out for the preview and the export. One that shows nothing
 *   is in a cut, collapsed to where its shot opens.
 * - A graphic layer's moment: that many seconds after the layer enters,
 *   as its code last declared it; gone where the layer is not a graphic,
 *   its code declares no such moment, or the moment falls at or past the
 *   layer's end.
 * - The video: zero, or the output's length.
 *
 * Then the offset, on output time. Nothing is clamped to the output:
 * whoever plays the point decides what a point before zero means.
 */
export class AudioAnchorTiming {
  private readonly targetsByContext = new WeakMap<AudioTimingContext, AnchorTargets>();
  // Apart from the other targets, since filtering the captions is paid only by a context an emoji is resolved against.
  private readonly emojisByContext = new WeakMap<AudioTimingContext, ReadonlyMap<string, EmojiTarget>>();

  constructor(
    private readonly layerTiming: ShotLayerTiming,
    private readonly splitTransitions: ShotLayerSplitTransitions,
    private readonly insetTransitions: ShotLayerInsetTransitions,
    private readonly transitionCuts: ShotTransitionCuts,
    private readonly decorationFilter: DecorationFilter,
  ) {}

  /** Where `point` lands on the output of `context`. */
  resolve(point: AudioAnchorPoint, context: AudioTimingContext): AudioAnchorResolution {
    const landing = this.landingOf(point.anchor, context);
    if (landing.kind === 'gone') return landing;
    return { kind: landing.kind, outputSec: landing.outputSec + point.offsetSec };
  }

  private landingOf(anchor: AudioAnchor, context: AudioTimingContext): AudioAnchorResolution {
    switch (anchor.kind) {
      case 'word':
        return this.wordLanding(anchor.wordId, anchor.edge, context);
      case 'emoji':
        return this.emojiLanding(anchor.decorationId, context);
      case 'shot':
        return this.shotLanding(anchor.shotId, anchor.edge, context);
      case 'transition':
        return this.transitionLanding(anchor.shotId, context);
      case 'camera':
        return context.shots.hasCamera(anchor.shotId) ? this.shotLanding(anchor.shotId, 'start', context) : { kind: 'gone' };
      case 'layer-camera':
        return context.shots.hasLayerCamera(anchor.layerId) ? this.layerLanding(anchor.layerId, 'entry', context) : { kind: 'gone' };
      case 'layer':
        return this.layerLanding(anchor.layerId, anchor.edge, context);
      case 'layer-transition':
        return this.layerTransitionLanding(anchor.layerId, anchor.edge, context);
      case 'layer-moment':
        return this.layerMomentLanding(anchor.layerId, anchor.momentId, context);
      case 'video':
        return { kind: 'at', outputSec: anchor.edge === 'start' ? 0 : context.timeMap.toOutputTime(this.sourceEndOf(context)) };
    }
  }

  private wordLanding(wordId: string, edge: 'start' | 'end', context: AudioTimingContext): AudioAnchorResolution {
    const word = this.targetsOf(context).words.get(wordId);
    if (word === undefined) return { kind: 'gone' };
    const outputSec = context.timeMap.toOutputTime(edge === 'start' ? word.time.start : word.time.end);
    return { kind: context.timeMap.isSkipped(word.time.start) ? 'in-cut' : 'at', outputSec };
  }

  private emojiLanding(decorationId: string, context: AudioTimingContext): AudioAnchorResolution {
    const emoji = this.emojisOf(context).get(decorationId);
    if (emoji === undefined) return { kind: 'gone' };
    const outputSec = context.timeMap.toOutputTime(emoji.word.time.start);
    if (context.timeMap.isSkipped(emoji.word.time.start)) return { kind: 'in-cut', outputSec };
    return { kind: emoji.shown ? 'at' : 'hidden', outputSec };
  }

  private shotLanding(shotId: string, edge: 'start' | 'end', context: AudioTimingContext): AudioAnchorResolution {
    const span = this.targetsOf(context).shots.get(shotId);
    if (span === undefined) return { kind: 'gone' };
    const outputStartSec = context.timeMap.toOutputTime(span.startSec);
    const outputEndSec = context.timeMap.toOutputTime(span.endSec);
    if (!(outputEndSec - outputStartSec >= OUTPUT_TIME_TOLERANCE_SEC)) return { kind: 'in-cut', outputSec: outputStartSec };
    return { kind: 'at', outputSec: edge === 'start' ? outputStartSec : outputEndSec };
  }

  private transitionLanding(shotId: string, context: AudioTimingContext): AudioAnchorResolution {
    const targets = this.targetsOf(context);
    const cutSec = targets.playedTransitions.get(shotId);
    if (cutSec !== undefined) return { kind: 'at', outputSec: cutSec };
    const shot = targets.shots.get(shotId);
    if (!targets.transitions.has(shotId) || shot === undefined) return { kind: 'gone' };
    return { kind: 'in-cut', outputSec: context.timeMap.toOutputTime(shot.startSec) };
  }

  private layerLanding(layerId: string, edge: 'entry' | 'exit', context: AudioTimingContext): AudioAnchorResolution {
    const layer = this.targetsOf(context).layers.get(layerId);
    if (layer === undefined) return { kind: 'gone' };
    if (layer.stretch === null) return { kind: 'in-cut', outputSec: context.timeMap.toOutputTime(layer.shotStartSec) };
    return { kind: 'at', outputSec: edge === 'entry' ? layer.stretch.outputStartSec : layer.stretch.outputEndSec };
  }

  private layerTransitionLanding(layerId: string, edge: 'entrance' | 'exit', context: AudioTimingContext): AudioAnchorResolution {
    const layer = this.targetsOf(context).layers.get(layerId);
    const lengthSec = this.layoutTransitionSecOf(layerId, edge, context);
    if (layer === undefined || lengthSec === null) return { kind: 'gone' };
    if (layer.stretch === null) return { kind: 'in-cut', outputSec: context.timeMap.toOutputTime(layer.shotStartSec) };
    const { outputStartSec, outputEndSec } = layer.stretch;
    const playedSec = Math.min(lengthSec, (outputEndSec - outputStartSec) / 2);
    return { kind: 'at', outputSec: edge === 'entrance' ? outputStartSec + playedSec / 2 : outputEndSec - playedSec / 2 };
  }

  private layerMomentLanding(layerId: string, momentId: string, context: AudioTimingContext): AudioAnchorResolution {
    const layer = this.targetsOf(context).layers.get(layerId);
    const shown = context.shots.findLayer(layerId);
    const moment = shown !== null && 'graphic' in shown ? shown.graphic.moments.find((candidate) => candidate.id === momentId) : undefined;
    if (layer === undefined || moment === undefined) return { kind: 'gone' };
    if (layer.stretch === null) return { kind: 'in-cut', outputSec: context.timeMap.toOutputTime(layer.shotStartSec) };
    const { outputStartSec, outputEndSec } = layer.stretch;
    const outputSec = outputStartSec + moment.sec;
    return outputSec < outputEndSec ? { kind: 'at', outputSec } : { kind: 'gone' };
  }

  /** How long the layer's layout transition at `edge` is set to take, or null where it plays none. */
  private layoutTransitionSecOf(layerId: string, edge: 'entrance' | 'exit', context: AudioTimingContext): number | null {
    const fields = context.shots.layerStyles.get(layerId)?.fields;
    switch (context.shots.placementOf(layerId).kind) {
      case 'split':
        return this.splitTransitions.kindOf(fields, edge) === 'cut' ? null : this.splitTransitions.durationSecOf(fields, edge);
      case 'inset':
        return this.insetTransitions.kindOf(fields, edge) === 'cut' ? null : this.insetTransitions.durationSecOf(fields, edge);
      case 'full':
        return null;
    }
  }

  /** Where the source ends; open while its length is not known. */
  private sourceEndOf(context: AudioTimingContext): number {
    return context.videoDurationSec > 0 ? context.videoDurationSec : Infinity;
  }

  private targetsOf(context: AudioTimingContext): AnchorTargets {
    const known = this.targetsByContext.get(context);
    if (known !== undefined) return known;
    const targets: AnchorTargets = {
      words: this.wordsOf(context),
      shots: this.shotsOf(context),
      playedTransitions: new Map(this.transitionCuts.played(context.shots, context.timeMap).map(({ shotId, cutSec }) => [shotId, cutSec])),
      transitions: new Set(context.shots.list().filter((shot) => shot.transition !== undefined).map((shot) => shot.id)),
      layers: this.layersOf(context),
    };
    this.targetsByContext.set(context, targets);
    return targets;
  }

  private wordsOf(context: AudioTimingContext): ReadonlyMap<string, Word> {
    return new Map((context.originalDocument?.getWords() ?? []).map((word) => [word.id, word]));
  }

  /** The emojis on the Original track's words by id, the ones removed left out. */
  private emojisOf(context: AudioTimingContext): ReadonlyMap<string, EmojiTarget> {
    const known = this.emojisByContext.get(context);
    if (known !== undefined) return known;
    const emojis = context.originalDocument === null ? new Map<string, EmojiTarget>() : this.emojisIn(context.originalDocument, context);
    this.emojisByContext.set(context, emojis);
    return emojis;
  }

  private emojisIn(document: Document, context: AudioTimingContext): ReadonlyMap<string, EmojiTarget> {
    const shownIds = this.shownEmojiIdsIn(document, context);
    return new Map(document.getWords().flatMap((word) => {
      const decoration = word.decoration;
      if (decoration === null || context.originalDecorationOverrides.get(decoration.id).removed) return [];
      return [[decoration.id, { word, shown: shownIds.has(decoration.id) }] as const];
    }));
  }

  /** The emojis the captions paint: those the visibility rule keeps, in a caption that is not hidden. */
  private shownEmojiIdsIn(document: Document, context: AudioTimingContext): ReadonlySet<string> {
    const shown = this.decorationFilter.filterDocument(document, context.originalSheets, context.originalDecorationOverrides);
    return new Set(shown.sections.flatMap((section) => section.segments)
      .filter((segment) => !segment.hidden)
      .flatMap((segment) => segment.getWords())
      .flatMap((word) => (word.decoration === null ? [] : [word.decoration.id])));
  }

  private shotsOf(context: AudioTimingContext): ReadonlyMap<string, SourceSpan> {
    const shots = context.shots.list();
    return new Map(shots.map((shot, index) => [
      shot.id,
      { startSec: shot.startSec, endSec: shots[index + 1]?.startSec ?? this.sourceEndOf(context) },
    ]));
  }

  private layersOf(context: AudioTimingContext): ReadonlyMap<string, LayerTarget> {
    const scheduled = new Map(
      this.layerTiming
        .scheduleAll(context.shots, context.media, context.timeMap, context.videoDurationSec > 0 ? context.videoDurationSec : null)
        .map(({ layer, stretch }) => [layer.id, stretch]),
    );
    return new Map(context.shots.list().flatMap((shot) => shot.layers.map((layer) => [
      layer.id,
      { shotStartSec: shot.startSec, stretch: scheduled.get(layer.id) ?? null },
    ])));
  }
}
