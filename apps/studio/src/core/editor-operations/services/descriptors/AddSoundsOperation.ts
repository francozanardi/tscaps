import { z } from 'zod';
import type { Document } from '@tscaps/engine';
import type { AddAudioClipsAction } from '@core/audio-mix/actions/AddAudioClipsAction';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import { AudioMixSanitizer } from '@core/audio-mix/domain/AudioMixSanitizer';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import type { RenderTimeMapBuilder } from '@core/cuts/services/RenderTimeMapBuilder';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import { CrowdedSoundFinder, type CrowdedSound } from '@core/editor-operations/services/CrowdedSoundFinder';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

/** Where a run puts one sound: the anchor point, what it reads as for the caller, and what the caller should know. */
interface SoundPlacement {
  readonly point: AudioAnchorPoint;
  /** What the sound is on, as the caller names it: a ref, or `video`. */
  readonly on: string;
  readonly warnings: ReadonlyArray<string>;
}

/** Where one sound of the input is asked to play. */
interface SoundTarget {
  readonly word?: string | undefined;
  readonly decoration?: string | undefined;
  readonly shot?: string | undefined;
  readonly layer?: string | undefined;
  readonly sec?: number | undefined;
  readonly edge?: 'start' | 'end' | undefined;
  readonly moment?: string | undefined;
}

// Twice a sound's level under the voice (6 dB over it): louder, it starts to compete with the speech.
const LOUDEST_OVER_UNDER_VOICE = 2;
// A time this close to a word's edge is on that word, as far as the editor's nudge of a sound on a word reaches.
const NEAR_WORD_SEC = 1;
const LISTED_SOUNDS = 15;
const VIDEO_START: AudioAnchor = { kind: 'video', edge: 'start' };

/**
 * `add_sounds`: places bundled sound effects against the edit — on a
 * word of the original speech or an emoji on one, a shot's start or
 * end, a layer's entry or exit, or a time of the source video — as one
 * undo step. A sound on an emoji plays only while its captions show it.
 * A time is
 * pinned to the word whose edge is within a second of it, else to the
 * nearest edge of a shot, as the editor places a sound moved to the
 * playhead, so it keeps its place in the content when cuts change.
 * Warns about each sound added too close to another one, which blurs
 * the two into noise.
 */
export class AddSoundsOperation implements EditorOperation {
  /** What the description says about when sounds are added at all. */
  static readonly WHEN_TO_ADD = 'Only when the person asks for sound effects: the bundled pack is not curated yet, and a graphic preset or a camera move that brings its own sound is enough otherwise.';

  readonly name = 'add_sounds';
  readonly effect = 'edit';
  readonly description = [
    AddSoundsOperation.WHEN_TO_ADD,
    'Adds sound effects from the bundled pack, each played once from where it is placed: on a word of the original speech (it moves with the word through edits), at a shot\'s start or end, where a layer enters or leaves, on a moment a graphic declares (the instant its number lands), or at a time of the source video (pinned to the word or shot there, so it keeps its place when cuts change).',
    'A sound on something later cut away stays silent.',
    'Each sound plays at the volume that sits it under the voice unless given one.',
    `A sound less than ${CrowdedSoundFinder.MIN_GAP_SEC} s from another one comes back with a warning.`,
    'Answers each sound\'s ref (sound:<id>), which remove_sounds takes, and the volume it plays at; transitions and camera moves bring their own sounds, so do not add those again.',
  ].join(' ');

  private readonly input = new OperationInput({
    sounds: z.array(z.strictObject({
      sound: z.string().describe('A bundled sound id, such as pop-bloop, whoosh-soft, ding-chime or click (list_catalog sounds for all). Not a sound: ref.'),
      at: z.strictObject({
        word: z.string().optional().describe('word:<id>, a word of the original speech.'),
        decoration: z.string().optional().describe('decoration:<id> (get_transcript timed lists them), an emoji: it plays on its word only while the emoji shows.'),
        shot: z.string().optional().describe('shot:<id>.'),
        layer: z.string().optional().describe('layer:<id>.'),
        sec: z.number().min(0).optional().describe('A time of the source video, in seconds.'),
        edge: z.enum(['start', 'end']).optional().describe('The start (default) or the end of the word, shot or layer: a layer starts where it enters and ends where it leaves.'),
        moment: z.string().optional().describe('With layer, in place of edge: a moment the graphic on that layer declares (get_element lists its moments), such as the instant its number or key word lands; the sound moves with it.'),
      }).describe('Where it plays: exactly one of word, decoration, shot, layer or sec.'),
      volume: z.number().min(0).max(1).optional()
        .describe('Leave it out: each sound defaults to the level that sits it under the voice (underVoice, which list_catalog sounds with ids shows), which differs from sound to sound. Give one only when the person asks for a sound louder or softer. 1 is the file\'s own, far over a voice.'),
      offsetSec: z.number().min(-NEAR_WORD_SEC).max(NEAR_WORD_SEC).optional()
        .describe('Moves it earlier (negative) or later than where `at` puts it, in seconds.'),
    })).min(1).max(20).describe('The sounds to add, all in one undo step; one that cannot be placed refuses them all.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly shots: ShotRefResolver,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly originalCaptions: OriginalCaptionTrackReader,
    private readonly timing: AudioAnchorTiming,
    private readonly timeMaps: RenderTimeMapBuilder,
    private readonly media: MediaAssetStore,
    private readonly sounds: BuiltinSoundCatalog,
    private readonly addClips: AddAudioClipsAction,
    private readonly crowdedSounds: CrowdedSoundFinder,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const state = this.store.snapshot();
    const context = this.contextOf(state);
    const drafts: AudioClipDraft[] = [];
    const placements: SoundPlacement[] = [];
    const problems: OperationProblem[] = [];
    for (const [index, entry] of checked.value.sounds.entries()) {
      const path = `sounds.${index}`;
      const sound = this.sounds.find(entry.sound);
      if (sound === null) {
        problems.push(this.problem(`${path}.sound: "${entry.sound}" is not a bundled sound. Some: ${this.someSoundIds()}; list_catalog sounds for all.`));
        continue;
      }
      const placement = this.placementOf(entry.at, entry.offsetSec ?? 0, state, context, `${path}.at`);
      if (!placement.ok) {
        problems.push(placement.problem);
        continue;
      }
      placements.push(placement.value);
      drafts.push({ role: 'effect', source: { kind: 'builtin', soundId: entry.sound }, start: placement.value.point, volume: entry.volume ?? sound.underVoiceVolume });
    }
    if (problems.length > 0) return this.refused(problems);
    const ids = this.addClips.execute(drafts);
    const added = ids.map((id, index) => ({
      sound: this.parser.formatOf('sound', id),
      soundId: checked.value.sounds[index]?.sound,
      on: placements[index]?.on,
      atSec: this.sourceSecOf(placements[index]?.point, context),
      volume: drafts[index]?.volume,
    }));
    const warnings = placements.flatMap((placement, index) => placement.warnings.map((message): OperationProblem => ({
      severity: 'warning',
      message,
      ...(ids[index] === undefined ? {} : { ref: this.parser.formatOf('sound', ids[index]) }),
    })));
    const loud = ids.flatMap((id, index) => this.louderThanTheVoice(drafts[index], this.parser.formatOf('sound', id)));
    const crowded = this.crowdedSounds.find(this.store.snapshot().audio.clips(), new Set(ids), context)
      .map((crowd) => this.tooClose(crowd, context));
    return { ok: true, output: { added }, problems: [...warnings, ...loud, ...crowded] };
  }

  /** A warning that the sound of `crowd` plays too close to another one to be heard as its own moment. */
  private tooClose(crowd: CrowdedSound, context: AudioTimingContext): OperationProblem {
    const ref = this.parser.formatOf('sound', crowd.clip.id);
    const neighbour = this.parser.formatOf('sound', crowd.neighbour.id);
    const gapSec = this.rounded(Math.abs(crowd.outputSec - crowd.neighbourOutputSec));
    const side = crowd.outputSec < crowd.neighbourOutputSec ? 'before' : 'after';
    const neighbourAtSec = this.rounded(context.timeMap.toSourceTime(Math.max(0, crowd.neighbourOutputSec)));
    return {
      severity: 'warning',
      ref,
      message: `${ref}${this.soundNameOf(crowd.clip)} plays ${gapSec} s ${side} ${neighbour}${this.soundNameOf(crowd.neighbour)} at ${neighbourAtSec} s: `
        + `sounds less than ${CrowdedSoundFinder.MIN_GAP_SEC} s apart usually blur into noise rather than mark two moments. `
        + 'Unless the person asked for both, one of them on what matters most tends to sound better; if both stay, leave each on what it marks.',
    };
  }

  /** The bundled sound `clip` plays, in parentheses, or nothing for a file of the person's own. */
  private soundNameOf(clip: AudioClip): string {
    return clip.source.kind === 'builtin' ? ` (${clip.source.soundId})` : '';
  }

  /** A warning when `draft` plays loud enough to compete with the speech; none when it sits under it. */
  private louderThanTheVoice(draft: AudioClipDraft | undefined, ref: string): OperationProblem[] {
    if (draft === undefined || draft.source.kind !== 'builtin' || draft.volume === undefined) return [];
    const sound = this.sounds.find(draft.source.soundId);
    if (sound === null || draft.volume <= sound.underVoiceVolume * LOUDEST_OVER_UNDER_VOICE) return [];
    const overDb = Math.round(20 * Math.log10(draft.volume / sound.underVoiceVolume));
    return [{
      severity: 'warning',
      ref,
      message: `${ref} (${sound.id}) plays at ${draft.volume}, about ${overDb} dB over where it sits under the voice (${sound.underVoiceVolume}): it will sound louder than the speech. Unless the person asked for it louder, add it again without a volume.`,
    }];
  }

  private contextOf(state: EditorState): AudioTimingContext {
    const original = this.originalCaptions.read(state);
    return {
      originalDocument: original.document,
      originalSheets: original.sheets,
      originalDecorationOverrides: original.decorationOverrides,
      shots: this.materializer.materializeFrom(state),
      media: this.media.snapshot(),
      timeMap: this.timeMaps.build(state.cuts),
      videoDurationSec: state.video.duration,
    };
  }

  private placementOf(
    at: SoundTarget,
    offsetSec: number,
    state: EditorState,
    context: AudioTimingContext,
    path: string,
  ): ResolvedRef<SoundPlacement> {
    const named = (['word', 'decoration', 'shot', 'layer', 'sec'] as const).filter((key) => at[key] !== undefined);
    if (named.length !== 1) return this.unplaced(`${path}: give exactly one of word, decoration, shot, layer or sec.`);
    if (at.moment !== undefined) {
      if (at.layer === undefined) return this.unplaced(`${path}: moment is a moment of a graphic; give it with that graphic's layer.`);
      if (at.edge !== undefined) return this.unplaced(`${path}: give a moment or an edge of the layer, not both.`);
      return this.onMoment(at.layer, at.moment, offsetSec, context);
    }
    if (at.sec !== undefined) {
      if (at.edge !== undefined) return this.unplaced(`${path}: edge is for a word, a shot or a layer, not a time.`);
      return this.atTime(at.sec, offsetSec, context, path);
    }
    if (at.decoration !== undefined) {
      if (at.edge !== undefined) return this.unplaced(`${path}: edge is for a word, a shot or a layer; a sound on an emoji plays where its word starts.`);
      return this.onEmoji(at.decoration, offsetSec, state, context);
    }
    const edge = at.edge ?? 'start';
    if (at.word !== undefined) return this.onWord(at.word, edge, offsetSec, state, context);
    if (at.shot !== undefined) return this.onShot(at.shot, edge, offsetSec, context);
    return this.onLayer(at.layer ?? '', edge, offsetSec, context);
  }

  private onWord(ref: string, edge: 'start' | 'end', offsetSec: number, state: EditorState, context: AudioTimingContext): ResolvedRef<SoundPlacement> {
    const parsed = this.parser.parse(ref);
    if (parsed === null || parsed.kind !== 'word') return this.unplaced(`"${ref}" is not a word ref; word refs look like word:<id>.`, ref);
    if (!this.holdsWord(context.originalDocument, parsed.id)) {
      return this.unplaced(this.holdsWord(state.document, parsed.id)
        ? `${ref} is a word of a translation: sounds go on words of the original speech. Read the original transcript for its refs.`
        : `${ref} is not in the captions any more; read the transcript again for current refs.`, ref);
    }
    return this.placed({ anchor: { kind: 'word', wordId: parsed.id, edge }, offsetSec }, ref, context);
  }

  /** On the emoji `ref`, refused unless a word of the original speech holds it. */
  private onEmoji(ref: string, offsetSec: number, state: EditorState, context: AudioTimingContext): ResolvedRef<SoundPlacement> {
    const parsed = this.parser.parse(ref);
    if (parsed === null || parsed.kind !== 'decoration') return this.unplaced(`"${ref}" is not an emoji ref; emoji refs look like decoration:<id>.`, ref);
    const point: AudioAnchorPoint = { anchor: { kind: 'emoji', decorationId: parsed.id }, offsetSec };
    if (this.timing.resolve(point, context).kind === 'gone') {
      // An emoji removed stays on its word, so only another track's document can tell a translation's emoji apart.
      const onTranslation = state.document !== context.originalDocument && this.holdsEmoji(state.document, parsed.id);
      return this.unplaced(onTranslation
        ? `${ref} is an emoji of a translation: sounds go on emojis of the original speech. Read the original transcript for its refs.`
        : `${ref} is not in the captions any more; read the transcript again for current refs.`, ref);
    }
    return this.placed(point, ref, context);
  }

  private onShot(ref: string, edge: 'start' | 'end', offsetSec: number, context: AudioTimingContext): ResolvedRef<SoundPlacement> {
    const shot = this.shots.resolveShot(ref);
    if (!shot.ok) return shot;
    return this.placed({ anchor: { kind: 'shot', shotId: shot.value.shot.id, edge }, offsetSec }, shot.value.ref, context);
  }

  private onLayer(ref: string, edge: 'start' | 'end', offsetSec: number, context: AudioTimingContext): ResolvedRef<SoundPlacement> {
    const layer = this.shots.resolveLayer(ref);
    if (!layer.ok) return layer;
    const anchor: AudioAnchor = { kind: 'layer', layerId: layer.value.layer.id, edge: edge === 'start' ? 'entry' : 'exit' };
    return this.placed({ anchor, offsetSec }, layer.value.ref, context);
  }

  /** On the moment `momentId` of the graphic on the layer `ref`, refused unless that graphic declares it. */
  private onMoment(ref: string, momentId: string, offsetSec: number, context: AudioTimingContext): ResolvedRef<SoundPlacement> {
    const layer = this.shots.resolveLayer(ref);
    if (!layer.ok) return layer;
    if (!('graphic' in layer.value.layer)) return this.unplaced(`${ref} is not a graphic, so it has no moments; place the sound on its entry instead.`, ref);
    const moments = layer.value.layer.graphic.moments;
    if (!moments.some((moment) => moment.id === momentId)) {
      const declared = moments.map((moment) => moment.id).join(', ');
      return this.unplaced(`${ref} declares no moment "${momentId}"; ${declared === '' ? 'it declares none: place the sound on its entry instead' : `it declares ${declared}`}.`, ref);
    }
    const anchor: AudioAnchor = { kind: 'layer-moment', layerId: layer.value.layer.id, momentId };
    return this.placed({ anchor, offsetSec }, layer.value.ref, context);
  }

  /** `point` on what `on` names, with a warning where that is cut away or an emoji not on screen. */
  private placed(point: AudioAnchorPoint, on: string, context: AudioTimingContext): ResolvedRef<SoundPlacement> {
    return { ok: true, value: { point, on, warnings: this.silenceOf(point, on, context) } };
  }

  private silenceOf(point: AudioAnchorPoint, on: string, context: AudioTimingContext): string[] {
    switch (this.timing.resolve(point, context).kind) {
      case 'at':
        return [];
      case 'hidden':
        return [`${on} is not on screen: the sound stays silent until it shows.`];
      case 'in-cut':
      case 'gone':
        return [`${on} is cut away: the sound stays silent while it is.`];
    }
  }

  /**
   * The point a time of the source video lands on, `offsetSec` later on
   * the output: on the edge of the word within a second of it, else on
   * the nearest edge of a shot, else on the video's start.
   */
  private atTime(sec: number, offsetSec: number, context: AudioTimingContext, path: string): ResolvedRef<SoundPlacement> {
    const durationSec = context.videoDurationSec;
    if (!(durationSec > 0)) return this.unplaced(`${path}: the video's length is not known yet; place the sound on a word instead.`);
    if (sec > durationSec) return this.unplaced(`${path}: ${sec} s is past the video's end (${this.rounded(durationSec)} s).`);
    const outputSec = context.timeMap.toOutputTime(sec) + offsetSec;
    const point = this.nearestPoint(outputSec, context);
    if (point === null) return this.unplaced(`${path}: no word or shot near ${sec} s to place the sound on; place it on a word or a shot.`);
    const on = this.onOf(point.anchor);
    const warnings = context.timeMap.isSkipped(sec) ? [`${sec} s is inside a cut: the sound plays where the cut joins.`] : [];
    return { ok: true, value: { point, on, warnings } };
  }

  private nearestPoint(outputSec: number, context: AudioTimingContext): AudioAnchorPoint | null {
    const words = (context.originalDocument?.getWords() ?? []).flatMap((word): AudioAnchor[] => [
      { kind: 'word', wordId: word.id, edge: 'start' },
      { kind: 'word', wordId: word.id, edge: 'end' },
    ]);
    const onWord = this.nearestOf(words, outputSec, context);
    if (onWord !== null && Math.abs(onWord.offsetSec) <= NEAR_WORD_SEC) return onWord;
    const shots = context.shots.list().flatMap((shot): AudioAnchor[] => [
      { kind: 'shot', shotId: shot.id, edge: 'start' },
      { kind: 'shot', shotId: shot.id, edge: 'end' },
    ]);
    const onShot = this.nearestOf(shots, outputSec, context);
    if (onShot !== null && Math.abs(onShot.offsetSec) <= AudioMixSanitizer.MAX_OFFSET_SEC) return onShot;
    return outputSec <= AudioMixSanitizer.MAX_OFFSET_SEC ? { anchor: VIDEO_START, offsetSec: this.rounded(outputSec) } : null;
  }

  /** Of `anchors`, the one that plays nearest `outputSec`, with the offset that lands on it; null where none plays. */
  private nearestOf(anchors: ReadonlyArray<AudioAnchor>, outputSec: number, context: AudioTimingContext): AudioAnchorPoint | null {
    let nearest: AudioAnchorPoint | null = null;
    for (const anchor of anchors) {
      const landing = this.timing.resolve({ anchor, offsetSec: 0 }, context);
      if (landing.kind !== 'at') continue;
      const offsetSec = this.rounded(outputSec - landing.outputSec);
      if (nearest === null || Math.abs(offsetSec) < Math.abs(nearest.offsetSec)) nearest = { anchor, offsetSec };
    }
    return nearest;
  }

  /** What a point placed from a time is on, as the caller names it: a word or shot ref, or `video` for its start. */
  private onOf(anchor: AudioAnchor): string {
    if (anchor.kind === 'word') return this.parser.formatOf('word', anchor.wordId);
    if (anchor.kind === 'shot') return this.parser.formatOf('shot', anchor.shotId);
    return 'video';
  }

  /** Where `point` plays, in seconds of the source video; null where it is cut away or gone. */
  private sourceSecOf(point: AudioAnchorPoint | undefined, context: AudioTimingContext): number | null {
    if (point === undefined) return null;
    const landing = this.timing.resolve(point, context);
    return landing.kind === 'at' ? this.rounded(context.timeMap.toSourceTime(Math.max(0, landing.outputSec))) : null;
  }

  private holdsWord(document: Document | null, wordId: string): boolean {
    return document?.getWords().some((word) => word.id === wordId) ?? false;
  }

  private holdsEmoji(document: Document | null, decorationId: string): boolean {
    return document?.getWords().some((word) => word.decoration?.id === decorationId) ?? false;
  }

  private someSoundIds(): string {
    return this.sounds.list().slice(0, LISTED_SOUNDS).map((sound) => sound.id).join(', ');
  }

  private rounded(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private unplaced(message: string, ref?: string): ResolvedRef<SoundPlacement> {
    return { ok: false, problem: this.problem(message, ref) };
  }

  private problem(message: string, ref?: string): OperationProblem {
    return ref === undefined ? { severity: 'error', message } : { severity: 'error', message, ref };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
