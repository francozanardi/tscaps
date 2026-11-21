import { FootageOcclusion, type FootageLayerFrameState, type FootageRect } from '@tscaps/engine/advanced';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { ScheduledListedShotLayer, ShotLayerAsset, ScheduledShotLayer } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerGesture } from '@presentation/shots/services/ShotLayerCssOwnedGestureReader';

// Where a layer rests: its layout box, with nothing of its motion. A box picks where a layer rests.
const AT_REST: Pick<FootageLayerFrameState, 'opacity' | 'transform' | 'blur' | 'clipInset'> = {
  opacity: 1,
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  blur: 0,
  clipInset: { top: 0, right: 0, bottom: 0, left: 0 },
};

/** A layer the preview is drawing a box for, which a press on the preview can pick and drag. */
export interface ShotLayerHitTarget {
  readonly layerId: string;
  /** The file it shows, or null for a graphic, which shows none. */
  readonly mediaId: string | null;
  /** What it shows. */
  readonly kind: ShotLayerAsset['kind'];
  /** The layout its fields hold. */
  readonly placement: ShotLayerPlacement;
  /** Where its box rests, normalized to the frame on each axis. */
  readonly rect: FootageRect;
  /** The asset's width over its height, or null when not known. */
  readonly assetAspectRatio: number | null;
  /** The gestures its own CSS has taken over, which a press on it does not start. */
  readonly cssOwnedGestures: ReadonlySet<ShotLayerGesture>;
}

/** What the layers on screen at one instant are, for the overlay over the preview. */
export interface ShotLayersOnScreen {
  /** Every layer whose stretch holds the instant, drawn or not, whatever its layout. */
  readonly visibleLayerIds: ReadonlySet<string>;
  /** The layers a press can pick, bottom to top: the order they are drawn in. */
  readonly hitTargets: ReadonlyArray<ShotLayerHitTarget>;
}

/** How the layers drawn at the instant are drawn, and what lays each out. */
export interface ShotLayersDrawn {
  /** Whether the preview has a file to draw for a media id. */
  isDrawn(mediaId: string): boolean;
  /** How the layer is drawn at the instant, as its CSS resolves there; null where it was not resolved. */
  stateOf(layerId: string): FootageLayerFrameState | null;
  /** The layout the layer's fields hold. */
  placementOf(layerId: string): ShotLayerPlacement;
  /** The gestures the layer's own CSS has taken over. */
  cssOwnedGesturesOf(layerId: string): ReadonlySet<ShotLayerGesture>;
}

/**
 * Says which shot layers the preview shows at an instant, and which of
 * them a press on the preview can pick.
 *
 * Only a box floating over the frame can be picked: a layer floating
 * over the video, or the video floating over a layer, whose box is then
 * the video's. A full-screen or split
 * layer covers all or half of the frame, where a press means play or
 * pause, and it has nothing to drag; those are picked from their shot.
 * A box beneath a layer that hides the whole frame is not on screen,
 * so it is not offered either; what hides it is the engine's
 * {@link FootageOcclusion}, the answer the compositor draws by — a
 * full-screen picture or a fitted b-roll lets the boxes beneath show,
 * and they stay pickable. A layer whose file is not drawn yet — the video
 * shows there — offers nothing to press.
 *
 * A target is where the layer rests, not where its motion has it at the
 * instant: its layout box as its CSS resolves it, every transform,
 * fade, blur and clip of its motion left out. That box is what the
 * layout's fields place, so it is what a drag moves and what its
 * selection frames; a box sliding in is picked where it is going, and
 * its target holds still while it moves. A layer whose CSS moves the
 * box itself, rather than transforming it, moves its target too.
 */
export class ShotLayerHitTargetResolver {
  /**
   * `scheduled` is every layer in the order it is drawn, as laid on the
   * output timeline; `outputTimeSec` the instant on that timeline;
   * `frame` the video's size, null while not known.
   */
  resolve(
    scheduled: ReadonlyArray<ScheduledShotLayer>,
    outputTimeSec: number,
    frame: VideoLayout | null,
    drawn: ShotLayersDrawn,
  ): ShotLayersOnScreen {
    const visible = scheduled.filter((entry) => this.isShowingAt(entry, outputTimeSec));
    const resolved = this.drawnAt(visible, outputTimeSec, drawn);
    const hidingIndex = this.topmostHidingIndex(resolved, frame);
    // A layer the video floats over hides what is beneath it, but the video in its box is its own, and pickable.
    const hiderFloatsVideo = hidingIndex >= 0 && resolved[hidingIndex]!.state.videoAbove;
    const uncovered = resolved.slice(hiderFloatsVideo ? hidingIndex : hidingIndex + 1);
    return {
      visibleLayerIds: new Set(visible.map((entry) => entry.layer.id)),
      hitTargets: uncovered
        .map((entry) => this.targetOf(entry, drawn, frame))
        .filter((target) => target.placement.kind === 'inset'),
    };
  }

  /** The layers among `scheduled` showing at `outputTimeSec`, in the order given. */
  private showingAt(scheduled: ReadonlyArray<ScheduledShotLayer>, outputTimeSec: number): ReadonlyArray<ScheduledListedShotLayer> {
    return scheduled.filter((entry): entry is ScheduledListedShotLayer => entry.asset !== null && this.isShowingAt(entry, outputTimeSec));
  }

  private isShowingAt(entry: ScheduledShotLayer, outputTimeSec: number): boolean {
    return outputTimeSec >= entry.stretch.outputStartSec && outputTimeSec < entry.stretch.outputEndSec;
  }

  private drawnAt(visible: ReadonlyArray<ScheduledShotLayer>, outputTimeSec: number, drawn: ShotLayersDrawn): ResolvedShotLayer[] {
    return this.showingAt(visible, outputTimeSec).flatMap((scheduled) => {
      const { layer } = scheduled;
      // A graphic needs no file: it is drawn wherever its stretch holds the instant.
      const state = !('mediaId' in layer) || drawn.isDrawn(layer.mediaId) ? drawn.stateOf(layer.id) : null;
      return state === null ? [] : [{ scheduled, state: { ...state, ...AT_REST } }];
    });
  }

  /** Where the topmost layer hiding the whole frame sits in `resolved`, or -1 where none does. */
  private topmostHidingIndex(resolved: ReadonlyArray<ResolvedShotLayer>, frame: VideoLayout | null): number {
    // The stage takes an unknown frame as square, and so does this.
    const size = frame ?? { width: 1, height: 1 };
    for (let index = resolved.length - 1; index >= 0; index--) {
      const { scheduled, state } = resolved[index]!;
      if (new FootageOcclusion(scheduled.asset.kind === 'graphic' ? 'provided' : scheduled.asset.kind, state).hidesWholeFrame(size.width, size.height)) return index;
    }
    return -1;
  }

  /**
   * Where the video floats over the layer, the target is the video's box
   * and its shape the frame's: that is what the layout's fields place.
   */
  private targetOf(entry: ResolvedShotLayer, drawn: ShotLayersDrawn, frame: VideoLayout | null): ShotLayerHitTarget {
    const layerId = entry.scheduled.layer.id;
    const floatsVideo = entry.state.videoAbove && entry.state.videoRect !== null;
    const frameAspectRatio = frame !== null && frame.width > 0 && frame.height > 0 ? frame.width / frame.height : 1;
    return {
      layerId,
      mediaId: 'mediaId' in entry.scheduled.layer ? entry.scheduled.layer.mediaId : null,
      kind: entry.scheduled.asset.kind,
      placement: drawn.placementOf(layerId),
      // A box its camera grew past its layout shows only its clip: that is where it is, to point at.
      rect: floatsVideo ? entry.state.videoRect! : (entry.state.clipRect ?? entry.state.assetRect),
      assetAspectRatio: floatsVideo ? frameAspectRatio : entry.scheduled.asset.aspectRatio,
      cssOwnedGestures: drawn.cssOwnedGesturesOf(layerId),
    };
  }
}

/** A layer drawn at the instant, and its state there at rest. */
interface ResolvedShotLayer {
  readonly scheduled: ScheduledListedShotLayer;
  readonly state: FootageLayerFrameState;
}
