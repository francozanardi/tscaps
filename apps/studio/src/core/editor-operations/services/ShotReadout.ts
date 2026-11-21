import type { EditorState } from '@core/editor/domain/EditorState';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { ElementStyleReadout, ElementStyleReadoutRow } from '@core/editor-operations/services/ElementStyleReadout';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import type { ShotLayerReadout, ShotLayerRow } from '@core/editor-operations/services/ShotLayerReadout';
import type { ProjectShot } from '@core/editor-operations/services/ShotRefResolver';

/** What a shot holds besides its camera: where it runs in seconds of the source video, how the picture passes into it, its layers, and the layers still showing on it from earlier shots. */
interface ShotTimeline {
  readonly startSec: number;
  readonly endSec: number;
  readonly transition?: { readonly kind: string; readonly durationSec: number };
  /** How loud the video's own sound is during it, 0 to 2, on top of the video's overall level; absent at 1. */
  readonly videoVolume?: number;
  readonly layers?: ReadonlyArray<ShotLayerRow>;
  /** The layers earlier shots hold that still show on this one, as refs, bottom to top; absent where none does. */
  readonly continuing?: ReadonlyArray<string>;
}

/** A shot in a list, with the camera preset its own video plays. */
export interface ShotRow extends ShotTimeline {
  readonly ref: string;
  readonly camera?: string;
  /** The last shot its own video, camera and framing run over, as a ref, where that is a later shot. */
  readonly cameraThrough?: string;
  /** The earlier shot whose video, camera and framing run over this one, as a ref; this shot then draws none of its own. */
  readonly cameraFrom?: string;
}

/** Everything about one shot, its own video's style (camera move and its fields, crop, CSS) included. */
export interface ShotDetail extends ShotTimeline {
  readonly ref: string;
  readonly kind: 'shot';
  /** Its place in order, 0 for the first shot. */
  readonly index: number;
  readonly videoStyle?: ElementStyleReadoutRow;
}

/** Reads the shots of the partition for a read answer: one line per shot in a list, everything about one shot on its own. */
export class ShotReadout {
  constructor(
    private readonly layers: ShotLayerReadout,
    private readonly styles: ElementStyleReadout,
    private readonly format: ReadoutFormatter,
  ) {}

  row(projectShot: ProjectShot, state: EditorState): ShotRow {
    const camera = state.shots.layerStyles
      .animationOf(ShotVideoLayerId.of(projectShot.shot.id), ElementAnimationScope.CAMERA)?.presetId ?? null;
    return {
      ref: projectShot.ref,
      ...this.timelineOf(projectShot, state),
      ...(camera === null ? {} : { camera }),
      ...this.videoRunOf(projectShot, state),
    };
  }

  /** How far the shot's own video runs past it, or the earlier shot whose video runs over it; nothing for a shot that draws its own video and only that. */
  private videoRunOf(projectShot: ProjectShot, state: EditorState): Pick<ShotRow, 'cameraThrough' | 'cameraFrom'> {
    const { id } = projectShot.shot;
    const run = state.shots.videoRunOf(id);
    const last = run[run.length - 1];
    if (last !== undefined && last.id !== id) return { cameraThrough: this.layers.shotRefOf(last.id) };
    const drawnBy = state.shots.videoShotOf(id);
    return drawnBy === null || drawnBy.id === id ? {} : { cameraFrom: this.layers.shotRefOf(drawnBy.id) };
  }

  /** Everything about `projectShot` in the project `state`. */
  detail(projectShot: ProjectShot, state: EditorState): ShotDetail {
    const videoStyle = this.styles.of(state.shots.layerStyles.get(ShotVideoLayerId.of(projectShot.shot.id)));
    return {
      ref: projectShot.ref,
      kind: 'shot',
      index: projectShot.index,
      ...this.timelineOf(projectShot, state),
      ...(videoStyle === null ? {} : { videoStyle }),
    };
  }

  private timelineOf(projectShot: ProjectShot, state: EditorState): ShotTimeline {
    const { shot } = projectShot;
    const videoVolume = state.audio.shotVideoVolumeOf(shot.id);
    const continuing = state.shots.layersContinuingInto(shot.id);
    return {
      startSec: this.format.sec(projectShot.startSec),
      endSec: this.format.sec(projectShot.endSec),
      ...(shot.transition === undefined
        ? {}
        : { transition: { kind: shot.transition.kind, durationSec: this.format.sec(shot.transition.durationSec) } }),
      ...(videoVolume === 1 ? {} : { videoVolume: this.format.share(videoVolume) }),
      ...(shot.layers.length === 0 ? {} : { layers: shot.layers.map((layer) => this.layers.row(layer)) }),
      ...(continuing.length === 0 ? {} : { continuing: continuing.map((layer) => this.layers.refOf(layer)) }),
    };
  }
}
