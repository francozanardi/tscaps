import type { CaptionlessSpan } from '@core/captions/domain/CaptionlessSpan';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles, type ElementStylesSnapshot } from '@core/elements/domain/ElementStyles';
import { HELD_CAMERA_PRESET_ID } from '@core/shots/domain/HeldCameraPreset';
import { PICTURE_LAYER_PLACEMENT } from '@core/shots/domain/PictureLayerPlacement';
import type { Shot } from '@core/shots/domain/Shot';
import type { ShotFollow } from '@core/shots/domain/ShotFollow';
import { ShotFollowSanitizer } from '@core/shots/domain/ShotFollowSanitizer';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { ShotLayerLayoutFields, type ShotLayerLayoutValues } from '@core/shots/domain/ShotLayerLayoutFields';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';
import type { ShotLayerRole } from '@core/shots/domain/ShotLayerRole';
import { ShotLayerSanitizer } from '@core/shots/domain/ShotLayerSanitizer';
import type { ShotLengthBudget } from '@core/shots/domain/ShotLengthBudget';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { ShotTransition } from '@core/shots/domain/ShotTransition';
import { ShotTransitionSanitizer } from '@core/shots/domain/ShotTransitionSanitizer';

export interface ShotSnapshot {
  readonly id: string;
  readonly startSec: number;
  readonly layers?: ReadonlyArray<ShotLayer>;
  readonly videoThroughShotId?: string;
  readonly follow?: ShotFollow;
  readonly transition?: ShotTransition;
}

/**
 * Per role, the layout the layer of that role edited last was left
 * with: what a new layer of the role starts with.
 */
type ShotLayerLastEditedPlacements = Readonly<Record<ShotLayerRole, ShotLayerPlacement>>;

export interface ShotsSnapshot {
  readonly maxShotSec: number;
  readonly shots: ReadonlyArray<ShotSnapshot>;
  /**
   * Per role, the layout fields the layer of that role edited last was
   * left with; only the roles whose are not the ones a new project
   * starts with, and absent where none is.
   */
  readonly lastEditedLayouts?: Partial<Readonly<Record<ShotLayerRole, ShotLayerLayoutValues>>>;
  /** How each layer looks and moves, keyed by layer id; absent where no layer was styled. */
  readonly layerStyles?: ElementStylesSnapshot;
}

// Where the dial starts, not a measured optimum: short-form cuts
// every few seconds, and the reader moves it until the partition
// matches the video in front of them.
const DEFAULT_MAX_SHOT_SEC = 4;
const MIN_SHOT_SEC_DIVISOR = 3;

const ROLES: readonly ShotLayerRole[] = ['video', 'picture'];

/**
 * How the video is cut into shots, what each shot draws on the frame,
 * and, per layer role, the layout the layer of that role edited last
 * was left with. Immutable; every mutation returns a new instance.
 *
 * The shots partition the video by construction: the first opens at
 * zero, each runs until the next opens, and the last runs to the end.
 * Empty means nobody has edited the shots since they were last
 * proposed, and what the panel shows is a proposal cut to
 * `maxShotSec` — nothing can be attached to a shot until one edit
 * makes the proposal theirs.
 *
 * Every layer holds its own layout, as fields of its style. The last
 * edited layout of a role is remembered, not linked: a new layer of the
 * role starts with it, and nothing that changes it moves any layer.
 *
 * A layer id names one layer across the whole partition: an edit that
 * would give two layers one id is refused, and a stored second one is
 * dropped.
 *
 * A layer opens with the shot holding it and may show through a later
 * one: a run of consecutive shots. Only a run that names a shot after
 * the layer's own is ever held; any other reads as the layer's own
 * shot. Opening a shot inside a run, or inside a layer's own shot,
 * leaves the layer showing over the same stretch of the video.
 *
 * A shot's own video runs the same way: where it has a style, a camera
 * or a framing, it may be drawn through a later shot, the shots in
 * between drawing none of their own. Its run stops before a shot whose
 * video has a style of its own, which always draws itself.
 *
 * Where each layer sits, how it looks and how it moves is an element
 * style kept under its id, `layerStyles`: fields and the CSS they
 * write, as a caption element's are. It lives here rather
 * than with a caption track because a layer belongs to the project —
 * switching to a translation does not change the picture — and so an
 * undo, a join or a file deleted carries it with the layer. A style
 * whose layer is gone goes with it.
 */
export class ShotPartition {
  private static readonly placements = new ShotLayerPlacementSanitizer();
  private static readonly layouts = new ShotLayerLayoutFields(ShotPartition.placements);
  private static readonly layers = new ShotLayerSanitizer();
  private static readonly transitions = new ShotTransitionSanitizer();
  private static readonly follows = new ShotFollowSanitizer();
  // What a layer of each role starts with until one of that role is edited.
  private static readonly freshPlacements: ShotLayerLastEditedPlacements = {
    video: ShotPartition.placements.fresh('full'),
    picture: PICTURE_LAYER_PLACEMENT,
  };

  static empty(): ShotPartition {
    return new ShotPartition([], DEFAULT_MAX_SHOT_SEC, ShotPartition.freshPlacements, ElementStyles.empty());
  }

  static fromSnapshot(snapshot: ShotsSnapshot): ShotPartition {
    const lastEdited = ShotPartition.readLastEdited(snapshot.lastEditedLayouts);
    const sanitized: Shot[] = [];
    const seenIds = new Set<string>();
    const seenLayerIds = new Set<string>();
    for (const shot of Array.isArray(snapshot.shots) ? snapshot.shots : []) {
      if (!Number.isFinite(shot.startSec) || shot.startSec < 0) continue;
      if (typeof shot.id !== 'string' || shot.id === '' || seenIds.has(shot.id)) continue;
      seenIds.add(shot.id);
      const layers = ShotPartition.readLayers(shot.layers, seenLayerIds);
      const transition = ShotPartition.transitions.sanitize(shot.transition);
      const videoThroughShotId = typeof shot.videoThroughShotId === 'string' && shot.videoThroughShotId !== '' ? shot.videoThroughShotId : null;
      const follow = ShotPartition.follows.sanitize(shot.follow);
      sanitized.push({
        id: shot.id,
        startSec: shot.startSec,
        layers,
        ...(videoThroughShotId === null ? {} : { videoThroughShotId }),
        ...(follow === null ? {} : { follow }),
        ...(transition === null ? {} : { transition }),
      });
    }
    const maxShotSec = Number.isFinite(snapshot.maxShotSec) && snapshot.maxShotSec > 0
      ? snapshot.maxShotSec
      : DEFAULT_MAX_SHOT_SEC;
    return new ShotPartition(sanitized, maxShotSec, lastEdited, ShotPartition.readLayerStyles(snapshot.layerStyles));
  }

  /** The stored styles of layers, as element styles of the `layer` kind; anything else under them is dropped. */
  private static readLayerStyles(value: unknown): ElementStyles {
    if (typeof value !== 'object' || value === null) return ElementStyles.empty();
    const styles = ElementStyles.fromSnapshot(value as ElementStylesSnapshot);
    const notLayers = [...styles.all()].filter(([, style]) => style.kind !== 'layer').map(([id]) => id);
    return styles.without(notLayers);
  }

  /** Each role's stored last edited layout, clamped; the fresh one where it is missing or names no layout. */
  private static readLastEdited(value: unknown): ShotLayerLastEditedPlacements {
    const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    return {
      video: ShotPartition.readLayout(raw['video']) ?? ShotPartition.freshPlacements.video,
      picture: ShotPartition.readLayout(raw['picture']) ?? ShotPartition.freshPlacements.picture,
    };
  }

  private static readLayout(value: unknown): ShotLayerPlacement | null {
    if (typeof value !== 'object' || value === null) return null;
    return ShotPartition.layouts.placementNamedBy(value as ShotLayerLayoutValues);
  }

  /**
   * The stored layers that can be trusted, in their order but for the
   * graphics, which go above every file, none reusing an id
   * `seenLayerIds` already holds.
   */
  private static readLayers(value: unknown, seenLayerIds: Set<string>): ShotLayer[] {
    if (!Array.isArray(value)) return [];
    const layers: ShotLayer[] = [];
    for (const entry of value) {
      const layer = ShotPartition.layers.sanitize(entry);
      if (layer === null || seenLayerIds.has(layer.id)) continue;
      seenLayerIds.add(layer.id);
      layers.push(layer);
    }
    // Graphics are drawn above every file, whatever order they were stored in.
    return ShotPartition.graphicsOnTop(layers);
  }

  private readonly shots: readonly Shot[];
  // Per shot, the layers continuing into it from earlier shots; worked out once, on first asking.
  private continuingByShot: ReadonlyArray<ReadonlyArray<ShotLayer>> | null = null;
  /**
   * Where each layer sits, how it looks and how it moves, by layer id —
   * a shot's own video included, by its `ShotVideoLayerId`. Only layers
   * and videos of shots the partition holds have an entry.
   */
  readonly layerStyles: ElementStyles;

  private constructor(
    shots: readonly Shot[],
    readonly maxShotSec: number,
    private readonly lastEdited: ShotLayerLastEditedPlacements,
    layerStyles: ElementStyles,
  ) {
    const sorted = [...shots].sort((a, b) => a.startSec - b.startSec);
    // The partition covers the video or it is not a partition: whatever
    // opens first opens at zero, and with no cut before it, so with no
    // transition into it.
    const first = sorted[0];
    const ordered = ShotPartition.withRunsChecked(first !== undefined && (first.startSec !== 0 || first.transition !== undefined)
      ? [ShotPartition.opening(first), ...sorted.slice(1)]
      : sorted);
    this.layerStyles = layerStyles.isEmpty()
      ? layerStyles
      : layerStyles.restrictedTo(new Set(ordered.flatMap((shot) => [
        ShotVideoLayerId.of(shot.id),
        ...shot.layers.map((layer) => layer.id),
      ])));
    this.shots = ShotPartition.withVideoRunsChecked(ordered, this.layerStyles);
  }

  list(): readonly Shot[] {
    return this.shots;
  }

  isEmpty(): boolean {
    return this.shots.length === 0;
  }

  /**
   * The stretches where captions are kept off, in the order of the
   * shots: each shot holding a graphic that hides them, from its start to
   * the next shot's, the last one to `videoDurationSec`, and running on
   * over every shot such a graphic continues into, as one stretch.
   */
  captionlessSpans(videoDurationSec: number): CaptionlessSpan[] {
    const hides = (layer: ShotLayer) => 'graphic' in layer && layer.graphic.hidesCaptions;
    const continuing = this.continuing();
    const spans: CaptionlessSpan[] = [];
    this.shots.forEach((shot, index) => {
      const endSec = this.shots[index + 1]?.startSec ?? videoDurationSec;
      const carriedOn = continuing[index]!.some(hides);
      const last = spans[spans.length - 1];
      if (carriedOn && last !== undefined && last.endSec === shot.startSec) spans[spans.length - 1] = { startSec: last.startSec, endSec };
      else if (carriedOn || shot.layers.some(hides)) spans.push({ startSec: shot.startSec, endSec });
    });
    return spans;
  }

  /**
   * The shots the layer `layerId` shows on, first to last: the shot
   * holding it, and every one after it through the one its run names.
   * Empty where no shot holds such a layer.
   */
  runOf(layerId: string): readonly Shot[] {
    const first = this.shots.findIndex((shot) => shot.layers.some((held) => held.id === layerId));
    if (first === -1) return [];
    const through = this.shots[first]!.layers.find((held) => held.id === layerId)!.throughShotId;
    const last = through === undefined ? first : this.shots.findIndex((shot) => shot.id === through);
    return this.shots.slice(first, last + 1);
  }

  /**
   * Whether the layer `layerId` shows over the whole video: from the
   * first shot through the last. It goes on doing so whatever shot is
   * opened or joined afterwards, since nothing can open before the first
   * shot and a layer ending with the last one follows it. False for a
   * video of one shot, where every layer does and it says nothing.
   */
  showsOverWholeVideo(layerId: string): boolean {
    const run = this.runOf(layerId);
    return this.shots.length > 1 && run.length === this.shots.length;
  }

  /** The layers showing over the whole video, bottom to top: the files, then the graphics. */
  wholeVideoLayers(): ReadonlyArray<ShotLayer> {
    return (this.shots[0]?.layers ?? []).filter((layer) => this.showsOverWholeVideo(layer.id));
  }

  /**
   * The layers showing on the shot `shotId` that an earlier shot holds,
   * bottom to top: the files in the order of their shots, then the
   * graphics. Empty for a shot the partition does not hold.
   */
  layersContinuingInto(shotId: string): ReadonlyArray<ShotLayer> {
    const index = this.shots.findIndex((shot) => shot.id === shotId);
    return index === -1 ? [] : this.continuing()[index]!;
  }

  /** Whether some shot's own video carries a style of its own: a zoom, a crop, a person followed. */
  hasStyledVideo(): boolean {
    return this.shots.some((shot) => ShotPartition.hasStyledOwnVideo(shot, this.layerStyles));
  }

  /** Whether the shot `shotId` is one the partition holds, and its own video has a camera picked. */
  hasCamera(shotId: string): boolean {
    return this.shots.some((shot) => shot.id === shotId)
      && this.layerStyles.animationOf(ShotVideoLayerId.of(shotId), ElementAnimationScope.CAMERA) !== null;
  }

  /** Whether a layer some shot holds was given a camera. */
  hasLayerCamera(layerId: string): boolean {
    return this.findLayer(layerId) !== null && this.layerStyles.animationOf(layerId, ElementAnimationScope.CAMERA) !== null;
  }

  /** Whether `layerId` is a layer some shot holds, or the video of a shot the partition holds: what a style can be given to. */
  holdsStyleTarget(layerId: string): boolean {
    if (this.findLayer(layerId) !== null) return true;
    const shotId = ShotVideoLayerId.shotIdOf(layerId);
    return shotId !== null && this.shots.some((shot) => shot.id === shotId);
  }

  /** Whether some shot is entered through a transition rather than a plain cut. */
  hasTransitions(): boolean {
    return this.shots.some((shot) => shot.transition !== undefined);
  }

  /** Whether some shot draws a graphic. */
  hasGraphics(): boolean {
    return this.shots.some((shot) => shot.layers.some((layer) => 'graphic' in layer));
  }

  /** The files some shot's layer names. */
  mediaIdsInUse(): ReadonlySet<string> {
    return new Set(this.shots.flatMap((shot) => shot.layers.flatMap((layer) => ('mediaId' in layer ? [layer.mediaId] : []))));
  }

  /**
   * The layout a new layer of `role` starts with: the one the layer of
   * that role edited last was left with, or the fresh one where none
   * was edited.
   */
  placementForNewLayer(role: ShotLayerRole): ShotLayerPlacement {
    return this.lastEdited[role];
  }

  /** What a layer of `role` starts with before any layer of that role was edited: its defaults. */
  freshPlacementFor(role: ShotLayerRole): ShotLayerPlacement {
    return ShotPartition.freshPlacements[role];
  }

  /**
   * The layout the layer `layerId`'s fields hold, as a typed view of
   * them; a layer whose fields name none, or no layer, is on the full
   * frame. Read off the record, never off the CSS: a declaration
   * written by hand over a field is not seen here.
   */
  placementOf(layerId: string): ShotLayerPlacement {
    return ShotPartition.layouts.placementOf(this.layerStyles.get(layerId)?.fields);
  }

  /** Nothing edited, and neither the length nor any role's last edited layout ever changed: nothing worth storing. */
  isPristine(): boolean {
    return this.isEmpty()
      && this.maxShotSec === DEFAULT_MAX_SHOT_SEC
      && this.changedLastEdited() === null;
  }

  toSnapshot(): ShotsSnapshot {
    const shots = this.shots.map(({ id, startSec, layers, videoThroughShotId, follow, transition }) => ({
      id,
      startSec,
      ...(layers.length > 0 ? { layers } : {}),
      ...(videoThroughShotId === undefined ? {} : { videoThroughShotId }),
      ...(follow === undefined ? {} : { follow }),
      ...(transition === undefined ? {} : { transition }),
    }));
    const lastEditedLayouts = this.changedLastEdited();
    return {
      maxShotSec: this.maxShotSec,
      shots,
      ...(lastEditedLayouts === null ? {} : { lastEditedLayouts }),
      ...(this.layerStyles.isEmpty() ? {} : { layerStyles: this.layerStyles.toSnapshot() }),
    };
  }

  /** How long a proposed shot may run, and how short one is not worth cutting to. */
  budget(): ShotLengthBudget {
    return { maxSec: this.maxShotSec, minSec: this.maxShotSec / MIN_SHOT_SEC_DIVISOR };
  }

  /**
   * This partition holding a proposal's opening times, with an id
   * derived from each one: the ids hold still across renders, and are
   * frozen the moment an edit makes the partition real.
   */
  withProposal(startSecs: ReadonlyArray<number>): ShotPartition {
    return this.withShots(startSecs.map((startSec) => ({ id: `t${startSec.toFixed(3)}`, startSec, layers: [] })));
  }

  /**
   * Drops every shot, so what shows is a fresh proposal cut to
   * `maxShotSec`. The last edited layouts stay: they say how the user
   * likes a layer placed, nothing about the shots dropped.
   */
  reproposed(maxShotSec: number): ShotPartition {
    if (this.isEmpty() && maxShotSec === this.maxShotSec) return this;
    return new ShotPartition([], maxShotSec, this.lastEdited, this.layerStyles);
  }

  /** The shot covering `sec`, or null where the partition is empty. */
  at(sec: number): Shot | null {
    let held: Shot | null = null;
    for (const shot of this.shots) {
      if (shot.startSec > sec) break;
      held = shot;
    }
    return held;
  }

  /**
   * Opens a shot at `sec`. No-op where one already opens there. The new
   * shot holds no layer of its own, and every layer goes on showing over
   * the stretch it showed over: one that ended with the split shot,
   * that shot's own included, now shows through the new one.
   *
   * So does the video drawn on the split shot where it has a style, in
   * one of two ways. A video that moves (a camera move, a person
   * followed) runs on over both halves as one. A video that holds still
   * (a framing, a punch-in, CSS) is given to the new shot as its own,
   * with the rest of its run: the same picture, and nothing done to
   * either half afterwards can take it off the other.
   */
  splitAt(sec: number, id: string): ShotPartition {
    if (!Number.isFinite(sec) || sec <= 0) return this;
    if (this.shots.some((shot) => shot.startSec === sec)) return this;
    const split = this.at(sec);
    if (split === null) return this.withShots([...this.shots, { id, startSec: sec, layers: [] }]);
    const drawn = this.videoShotOf(split.id) ?? split;
    const still = ShotPartition.holdsStill(drawn, this.layerStyles);
    const style = still ? this.layerStyles.get(ShotVideoLayerId.of(drawn.id)) : null;
    const shots = this.shots.map((shot) => {
      const endsWithSplit = (layer: ShotLayer) => layer.throughShotId === split.id
        || (shot.id === split.id && layer.throughShotId === undefined);
      const withLayers = shot.layers.some(endsWithSplit)
        ? { ...shot, layers: shot.layers.map((layer) => (endsWithSplit(layer) ? { ...layer, throughShotId: id } : layer)) }
        : shot;
      if (style !== null) return shot.id === drawn.id ? ShotPartition.endingVideoWith(withLayers, split.id) : withLayers;
      // A video that moves runs on over the new shot too: the split shot's own, or the one drawn through it.
      const videoEndsWithSplit = shot.videoThroughShotId === split.id
        || (shot.id === split.id && shot.videoThroughShotId === undefined && ShotPartition.hasStyledOwnVideo(shot, this.layerStyles));
      return videoEndsWithSplit ? { ...withLayers, videoThroughShotId: id } : withLayers;
    });
    const rest = style === null || drawn.videoThroughShotId === undefined || drawn.videoThroughShotId === split.id ? {} : { videoThroughShotId: drawn.videoThroughShotId };
    const styles = style === null ? this.layerStyles : this.layerStyles.withStyle(ShotVideoLayerId.of(id), style);
    return new ShotPartition([...shots, { id, startSec: sec, layers: [], ...rest }], this.maxShotSec, this.lastEdited, styles);
  }

  /** `shot` with its own video drawn through the shot `lastId` and no further: no run where that is `shot` itself. */
  private static endingVideoWith(shot: Shot, lastId: string): Shot {
    const ended = ShotPartition.withoutVideoRun(shot);
    return lastId === shot.id ? ended : { ...ended, videoThroughShotId: lastId };
  }

  /**
   * Takes back the opening of `shotId`, so what it held joins the shot
   * before it. No-op for the first shot, which has nothing before it.
   * The joined shot keeps the earlier one's layers and takes the later
   * one's on top of them, the graphics of both staying above every file.
   * A layer that showed through `shotId` shows through the joined shot,
   * the same stretch as before.
   *
   * The stretch `shotId` covered draws the earlier shot's video from
   * then on. The shots its own video ran on over keep it: the first of
   * them takes that video's style and the person it follows as its
   * own, and its run over the rest, so their picture does not move.
   */
  joinIntoPrevious(shotId: string): ShotPartition {
    const index = this.shots.findIndex((shot) => shot.id === shotId);
    if (index <= 0) return this;
    const previous = this.shots[index - 1]!;
    const gone = this.shots[index]!;
    const heir = gone.videoThroughShotId === undefined ? null : this.shots[index + 1] ?? null;
    const layers = [...previous.layers, ...gone.layers];
    const joined = { ...previous, layers: ShotPartition.graphicsOnTop(layers) };
    const shots = this.shots.flatMap((shot, i) => {
      if (i === index) return [];
      if (i === index - 1) return [joined];
      return [heir !== null && shot.id === heir.id ? ShotPartition.withVideoOf(gone, shot) : shot];
    });
    const rewired = shots.map((shot) => {
      const videoEndsWithJoined = shot.videoThroughShotId === shotId;
      if (!videoEndsWithJoined && !shot.layers.some((layer) => layer.throughShotId === shotId)) return shot;
      return {
        ...shot,
        layers: shot.layers.map((layer) => (layer.throughShotId === shotId ? { ...layer, throughShotId: previous.id } : layer)),
        ...(videoEndsWithJoined ? { videoThroughShotId: previous.id } : {}),
      };
    });
    return new ShotPartition(rewired, this.maxShotSec, this.lastEdited, this.stylesWithVideoMoved(gone, heir));
  }

  /** `heir` drawing the own video of `gone`: the person it follows, and its run where it reaches past `heir`. */
  private static withVideoOf(gone: Shot, heir: Shot): Shot {
    const { videoThroughShotId: _run, follow: _follow, ...rest } = heir;
    return {
      ...rest,
      ...(gone.follow === undefined ? {} : { follow: gone.follow }),
      ...(gone.videoThroughShotId === undefined || gone.videoThroughShotId === heir.id ? {} : { videoThroughShotId: gone.videoThroughShotId }),
    };
  }

  /** The layer styles with the style of `gone`'s own video given to `heir`'s, where there is an heir and a style. */
  private stylesWithVideoMoved(gone: Shot, heir: Shot | null): ElementStyles {
    const style = heir === null ? null : this.layerStyles.get(ShotVideoLayerId.of(gone.id));
    return heir === null || style === null ? this.layerStyles : this.layerStyles.withStyle(ShotVideoLayerId.of(heir.id), style);
  }

  /**
   * The shots the own video of the shot `shotId` is drawn over, first to
   * last: itself, and every one after it through the one its run names.
   * Empty for a shot the partition does not hold.
   */
  videoRunOf(shotId: string): readonly Shot[] {
    const first = this.shots.findIndex((shot) => shot.id === shotId);
    if (first === -1) return [];
    const through = this.shots[first]!.videoThroughShotId;
    const last = through === undefined ? first : this.shots.findIndex((shot) => shot.id === through);
    return this.shots.slice(first, last + 1);
  }

  /**
   * The shot whose own video is drawn on the shot `shotId`: itself, or
   * the earlier shot whose video runs through it. Null for a shot the
   * partition does not hold.
   */
  videoShotOf(shotId: string): Shot | null {
    const index = this.shots.findIndex((shot) => shot.id === shotId);
    if (index === -1) return null;
    // Runs never overlap, so the nearest earlier shot holding one settles it: its run reaches this shot or none does.
    for (let earlier = index - 1; earlier >= 0; earlier -= 1) {
      const candidate = this.shots[earlier]!;
      if (candidate.videoThroughShotId === undefined) continue;
      const last = this.shots.findIndex((shot) => shot.id === candidate.videoThroughShotId);
      return last >= index ? candidate : this.shots[index]!;
    }
    return this.shots[index]!;
  }

  /**
   * Has the own video of the shot `shotId` drawn through the shot
   * `throughShotId`, a shot after it; null ends it with its own shot.
   * It reaches only as far as the shot before the next one whose video
   * has a style of its own. No-op for a shot it does not hold, one whose
   * video has no style, a shot that is not after it, and where the
   * video already ends there.
   */
  withVideoThrough(shotId: string, throughShotId: string | null): ShotPartition {
    const run = this.videoRunOf(shotId);
    const own = run[0];
    if (own === undefined) return this;
    const through = throughShotId === null ? own : this.shots.find((shot) => shot.id === throughShotId);
    if (through === undefined || through.startSec < own.startSec || through.id === run[run.length - 1]!.id) return this;
    return this.withShots(this.shots.map((shot) => {
      if (shot.id !== shotId) return shot;
      return through.id === own.id ? ShotPartition.withoutVideoRun(shot) : { ...shot, videoThroughShotId: through.id };
    }));
  }

  /**
   * Has the layer `layerId` show through the shot `throughShotId`, a
   * shot after the one holding it; null has it end with its own shot.
   * No-op where no shot holds the layer, where `throughShotId` names no
   * later shot, and where the layer already ends there.
   */
  withLayerThrough(layerId: string, throughShotId: string | null): ShotPartition {
    const run = this.runOf(layerId);
    const own = run[0];
    if (own === undefined) return this;
    const through = throughShotId === null ? own : this.shots.find((shot) => shot.id === throughShotId);
    if (through === undefined || through.startSec < own.startSec || through.id === run[run.length - 1]!.id) return this;
    return this.mapLayers((layer) => {
      if (layer.id !== layerId) return layer;
      return through.id === own.id ? ShotPartition.withoutRun(layer) : { ...layer, throughShotId: through.id };
    });
  }

  /**
   * Has the own video of `shotId` follow a person, checked as a stored
   * follow is; null stops it following. A follow left with no head is
   * taken as null. No-op for a shot the partition does not hold.
   */
  withFollow(shotId: string, follow: ShotFollow | null): ShotPartition {
    if (!this.shots.some((shot) => shot.id === shotId)) return this;
    const sanitized = follow === null ? null : ShotPartition.follows.sanitize(follow);
    return this.withShots(this.shots.map((shot) => {
      if (shot.id !== shotId) return shot;
      const { follow: _dropped, ...rest } = shot;
      return sanitized === null ? rest : { ...rest, follow: sanitized };
    }));
  }

  /**
   * Sets how the picture passes into `shotId` from the shot before it,
   * checked as a stored one is; null makes it a plain cut. No-op for the
   * first shot, which has nothing before it, a shot the partition does
   * not hold, and a transition that names no kind there is.
   */
  withTransition(shotId: string, transition: ShotTransition | null): ShotPartition {
    const index = this.shots.findIndex((shot) => shot.id === shotId);
    if (index <= 0) return this;
    const sanitized = transition === null ? null : ShotPartition.transitions.sanitize(transition);
    if (transition !== null && sanitized === null) return this;
    const held = this.shots[index]!.transition;
    if (held?.kind === sanitized?.kind && held?.durationSec === sanitized?.durationSec) return this;
    return this.withShots(this.shots.map((shot, i) => {
      if (i !== index) return shot;
      const { transition: _dropped, ...rest } = shot;
      return sanitized === null ? rest : { ...rest, transition: sanitized };
    }));
  }

  /**
   * Puts `layer` on top of what `shotId` draws: a graphic on top of
   * everything, a file on top of the files and beneath the graphics. No-op for a shot it does
   * not hold, a layer that cannot be trusted, or an id some layer
   * already has.
   */
  withLayerAdded(shotId: string, layer: ShotLayer): ShotPartition {
    return this.withLayerStacked(shotId, layer, (layers, added) => {
      // Graphics stay above every file layer: a file goes on top of the files, beneath the graphics.
      const firstGraphic = 'graphic' in added ? -1 : layers.findIndex((held) => 'graphic' in held);
      return firstGraphic === -1 ? [...layers, added] : [...layers.slice(0, firstGraphic), added, ...layers.slice(firstGraphic)];
    });
  }

  /**
   * Puts `layer` beneath everything `shotId` draws, under the same
   * conditions as {@link withLayerAdded}.
   */
  withLayerAddedBeneath(shotId: string, layer: ShotLayer): ShotPartition {
    return this.withLayerStacked(shotId, layer, (layers, added) => [added, ...layers]);
  }

  /**
   * Has the layer `layerId` show over the whole video: held by the first
   * shot, on top of that shot's layers of its sort (a graphic above every
   * file), and showing through the last one. No-op where no shot holds
   * the layer or it already shows over the whole video.
   */
  withLayerOverWholeVideo(layerId: string): ShotPartition {
    const first = this.shots[0];
    const last = this.shots[this.shots.length - 1];
    if (first === undefined || last === undefined) return this;
    return this.withLayerMoved(layerId, first.id, last.id);
  }

  /**
   * Has the layer `layerId` open on the shot `shotId` and show through
   * `throughShotId`, that shot or a later one (null: `shotId` alone),
   * the same layer with all it holds. Moved to another shot, it goes on
   * top of that shot's layers of its sort, as {@link withLayerAdded}
   * stacks one. No-op where no shot holds the layer, where either shot
   * is not held or `throughShotId` comes before `shotId`, and where the
   * layer already shows over exactly those shots.
   */
  withLayerMoved(layerId: string, shotId: string, throughShotId: string | null): ShotPartition {
    const layer = this.findLayer(layerId);
    const holder = this.shotHolding(layerId);
    const target = this.shots.find((shot) => shot.id === shotId);
    if (layer === null || holder === null || target === undefined) return this;
    if (holder.id === target.id) return this.withLayerThrough(layerId, throughShotId);
    const through = throughShotId === null ? target : this.shots.find((shot) => shot.id === throughShotId);
    if (through === undefined || through.startSec < target.startSec) return this;
    const moved = through.id === target.id ? ShotPartition.withoutRun(layer) : { ...layer, throughShotId: through.id };
    return this.withShots(this.shots.map((shot) => {
      const others = shot.layers.filter((held) => held.id !== layerId);
      if (shot.id === target.id) return { ...shot, layers: ShotPartition.graphicsOnTop([...others, moved]) };
      return others.length === shot.layers.length ? shot : { ...shot, layers: others };
    }));
  }

  /**
   * Puts `layer` in place of the layer with its id, where that one
   * stands and showing over the same shots: how far a layer shows is
   * changed by {@link withLayerThrough} alone. No-op where no layer has
   * that id, or `layer` cannot be trusted.
   */
  withLayerReplaced(layer: ShotLayer): ShotPartition {
    const sanitized = this.sanitizedLayer(layer);
    if (sanitized === null || this.findLayer(sanitized.id) === null) return this;
    return this.mapLayers((held) => (held.id === sanitized.id ? ShotPartition.withRunOf(held, sanitized) : held));
  }

  /**
   * Puts each of `layers` in place of the layer with its id, where that
   * one stands and showing over the same shots, checked as a stored one
   * is. A layer no shot holds, or one that cannot be trusted, is
   * skipped; the same partition where nothing would change.
   */
  withLayersReplaced(layers: ReadonlyArray<ShotLayer>): ShotPartition {
    const replacements = new Map<string, ShotLayer>();
    for (const layer of layers) {
      const sanitized = this.sanitizedLayer(layer);
      const held = sanitized === null ? null : this.findLayer(sanitized.id);
      if (sanitized === null || held === null || this.isSameLayer(held, sanitized)) continue;
      replacements.set(sanitized.id, sanitized);
    }
    if (replacements.size === 0) return this;
    return this.mapLayers((held) => {
      const replacement = replacements.get(held.id);
      return replacement === undefined ? held : ShotPartition.withRunOf(held, replacement);
    });
  }

  /** Takes every layer `layerIds` names off its shot. The same partition where none of them is held. */
  withoutLayers(layerIds: Iterable<string>): ShotPartition {
    const gone = new Set([...layerIds].filter((layerId) => this.findLayer(layerId) !== null));
    if (gone.size === 0) return this;
    return this.filterLayers((layer) => !gone.has(layer.id));
  }

  /**
   * Remembers `placement`, clamped first, as the layout the layer of `role`
   * edited last was left with, so a layer of that role added later
   * starts with it. Moves no layer. Which role a layer has is its file's
   * type, which the partition does not hold, so the caller says. No-op
   * where the placement names no layout or is the one remembered.
   */
  withLastEditedPlacement(role: ShotLayerRole, placement: ShotLayerPlacement): ShotPartition {
    const sanitized = ShotPartition.placements.sanitize(placement);
    if (sanitized === null || ShotPartition.placements.isSame(this.lastEdited[role], sanitized)) return this;
    return new ShotPartition(this.shots, this.maxShotSec, { ...this.lastEdited, [role]: sanitized }, this.layerStyles);
  }

  /**
   * Holds `styles` as where the layers sit and how they look and move. An entry for a layer
   * no shot holds is dropped. The same partition where nothing changes.
   */
  withLayerStyles(styles: ElementStyles): ShotPartition {
    if (styles === this.layerStyles) return this;
    return new ShotPartition(this.shots, this.maxShotSec, this.lastEdited, styles);
  }

  /** Takes away every layer naming `mediaId`. The same partition when none does. */
  withoutMedia(mediaId: string): ShotPartition {
    if (!this.mediaIdsInUse().has(mediaId)) return this;
    return this.filterLayers((layer) => !('mediaId' in layer) || layer.mediaId !== mediaId);
  }

  /**
   * Moves where `shotId` opens. The move is refused outright rather
   * than clamped when it would cross a neighbour: a boundary dropped
   * somewhere the user did not ask for is worse than one that did not
   * move.
   */
  moveStart(shotId: string, sec: number): ShotPartition {
    const index = this.shots.findIndex((shot) => shot.id === shotId);
    if (index <= 0 || !Number.isFinite(sec)) return this;
    const previous = this.shots[index - 1]!;
    const next = this.shots[index + 1];
    if (sec <= previous.startSec) return this;
    if (next && sec >= next.startSec) return this;
    return this.withShots(this.shots.map((shot, i) => (i === index ? { ...shot, startSec: sec } : shot)));
  }

  private withLayerStacked(
    shotId: string,
    layer: ShotLayer,
    stack: (layers: readonly ShotLayer[], added: ShotLayer) => ShotLayer[],
  ): ShotPartition {
    const sanitized = this.sanitizedLayer(layer);
    if (sanitized === null || this.findLayer(sanitized.id) !== null) return this;
    if (!this.shots.some((shot) => shot.id === shotId)) return this;
    return this.withShots(this.shots.map((shot) => (shot.id === shotId ? { ...shot, layers: stack(shot.layers, sanitized) } : shot)));
  }

  /** The layer `layerId` names, or null where no shot holds one. */
  findLayer(layerId: string): ShotLayer | null {
    return this.shotHolding(layerId)?.layers.find((held) => held.id === layerId) ?? null;
  }

  /** The shot holding the layer `layerId`, or null where none does. */
  shotHolding(layerId: string): Shot | null {
    return this.shots.find((shot) => shot.layers.some((held) => held.id === layerId)) ?? null;
  }

  private sanitizedLayer(layer: ShotLayer): ShotLayer | null {
    return ShotPartition.layers.sanitize(layer);
  }

  private isSameLayer(first: ShotLayer, second: ShotLayer): boolean {
    if ('graphic' in first || 'graphic' in second) {
      return 'graphic' in first && 'graphic' in second && JSON.stringify(first.graphic) === JSON.stringify(second.graphic);
    }
    return first.mediaId === second.mediaId
      && first.inSec === second.inSec
      && first.outSec === second.outSec
      && first.loop === second.loop;
  }

  private mapLayers(map: (layer: ShotLayer) => ShotLayer): ShotPartition {
    return this.withShots(this.shots.map((shot) => ({ ...shot, layers: shot.layers.map(map) })));
  }

  private filterLayers(keep: (layer: ShotLayer) => boolean): ShotPartition {
    return this.withShots(this.shots.map((shot) => ({ ...shot, layers: shot.layers.filter(keep) })));
  }

  /** The fields of the last edited layouts that differ from the ones a new project starts with, or null where none does. */
  private changedLastEdited(): Partial<Record<ShotLayerRole, ShotLayerLayoutValues>> | null {
    const changed = ROLES.filter((role) => !ShotPartition.placements.isSame(this.lastEdited[role], ShotPartition.freshPlacements[role]));
    if (changed.length === 0) return null;
    return Object.fromEntries(changed.map((role) => [role, ShotPartition.layouts.valuesOf(this.lastEdited[role])]));
  }


  /** Per shot, in the order of the shots, the layers continuing into it from earlier ones, bottom to top. */
  private continuing(): ReadonlyArray<ReadonlyArray<ShotLayer>> {
    if (this.continuingByShot !== null) return this.continuingByShot;
    const indexOf = new Map(this.shots.map((shot, index) => [shot.id, index]));
    const continuing: ShotLayer[][] = this.shots.map(() => []);
    this.shots.forEach((shot, index) => {
      for (const layer of shot.layers) {
        const last = layer.throughShotId === undefined ? index : indexOf.get(layer.throughShotId) ?? index;
        for (let covered = index + 1; covered <= last; covered += 1) continuing[covered]!.push(layer);
      }
    });
    this.continuingByShot = continuing.map((layers) => ShotPartition.graphicsOnTop(layers));
    return this.continuingByShot;
  }

  /** `layers` in their order but for the graphics, which go above every file. */
  private static graphicsOnTop(layers: ReadonlyArray<ShotLayer>): ShotLayer[] {
    return [...layers.filter((layer) => !('graphic' in layer)), ...layers.filter((layer) => 'graphic' in layer)];
  }

  /** `layer` ending with its own shot. */
  private static withoutRun(layer: ShotLayer): ShotLayer {
    const { throughShotId: _dropped, ...rest } = layer;
    return rest;
  }

  /** `layer` showing over the shots `held` shows over. */
  private static withRunOf(held: ShotLayer, layer: ShotLayer): ShotLayer {
    const ending = ShotPartition.withoutRun(layer);
    return held.throughShotId === undefined ? ending : { ...ending, throughShotId: held.throughShotId };
  }

  /** `shots`, in order, with every run that names no shot after its layer's own taken off its layer. */
  private static withRunsChecked(shots: readonly Shot[]): readonly Shot[] {
    const indexOf = new Map(shots.map((shot, index) => [shot.id, index]));
    return shots.map((shot, index) => {
      const stray = (layer: ShotLayer) => layer.throughShotId !== undefined && (indexOf.get(layer.throughShotId) ?? -1) <= index;
      if (!shot.layers.some(stray)) return shot;
      return { ...shot, layers: shot.layers.map((layer) => (stray(layer) ? ShotPartition.withoutRun(layer) : layer)) };
    });
  }

  /** `shot` with its own video ending with it. */
  private static withoutVideoRun(shot: Shot): Shot {
    const { videoThroughShotId: _dropped, ...rest } = shot;
    return rest;
  }

  /**
   * `shots`, in order, each video run cut back to what it may cover: no
   * run for a shot whose video has no style in `styles` and follows no one, or that names no
   * later shot, and a run ending before the first shot whose video has a
   * style of its own.
   */
  private static withVideoRunsChecked(shots: readonly Shot[], styles: ElementStyles): readonly Shot[] {
    const indexOf = new Map(shots.map((shot, index) => [shot.id, index]));
    const styled = (shot: Shot) => ShotPartition.hasStyledOwnVideo(shot, styles);
    return shots.map((shot, index) => {
      if (shot.videoThroughShotId === undefined) return shot;
      const named = indexOf.get(shot.videoThroughShotId) ?? -1;
      let last = index;
      while (styled(shot) && last < named && !styled(shots[last + 1]!)) last += 1;
      if (last === index) return ShotPartition.withoutVideoRun(shot);
      return shots[last]!.id === shot.videoThroughShotId ? shot : { ...shot, videoThroughShotId: shots[last]!.id };
    });
  }

  /**
   * Whether `shot`'s own video has a style in `styles` that shows one
   * picture for as long as it is drawn: no person followed, and no
   * camera but the one that holds a framing. Splitting such a video
   * into two of the same shows what one drawn over both would.
   */
  private static holdsStill(shot: Shot, styles: ElementStyles): boolean {
    const styleId = ShotVideoLayerId.of(shot.id);
    if (shot.follow !== undefined || styles.get(styleId) === null) return false;
    const camera = styles.animationOf(styleId, ElementAnimationScope.CAMERA);
    return camera === null || camera.presetId === HELD_CAMERA_PRESET_ID;
  }

  /** Whether `shot`'s own video is drawn other than as it is: a style given in `styles`, or a person it follows. */
  private static hasStyledOwnVideo(shot: Shot, styles: ElementStyles): boolean {
    return shot.follow !== undefined || styles.get(ShotVideoLayerId.of(shot.id)) !== null;
  }

  /** `shot` as the one the partition opens with: at zero, with no transition. */
  private static opening(shot: Shot): Shot {
    const { transition: _dropped, ...rest } = shot;
    return { ...rest, startSec: 0 };
  }

  private withShots(shots: readonly Shot[]): ShotPartition {
    return new ShotPartition(shots, this.maxShotSec, this.lastEdited, this.layerStyles);
  }
}
