import type { ErrorNameTelemetryDescriber } from '@core/errors/services/ErrorNameTelemetryDescriber';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { ShotLayerRole } from '@core/shots/domain/ShotLayerRole';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';

/** How the partition into shots was changed. */
export type ShotPartitionEditKind = 'repropose' | 'split' | 'join' | 'move-boundary';

/** Where a file was put on a shot from; `assistant` when the assistant put it there. */
export type ShotFileOrigin = 'shot-picker' | 'shot-upload' | 'bin-drop' | 'bin-current-shot' | 'layer-replace' | 'assistant';

/** Where layers were taken off their shots from; `assistant` when the assistant took them off. */
export type ShotLayerRemovalOrigin = 'popover' | 'selection' | 'inspector' | 'delete-key' | 'assistant';

/** A layout field that takes one of a few values, as reported; sliders and drags have none. */
export type ShotLayerLayoutField = 'layout' | 'fit' | 'backdrop' | 'side' | 'subject';

/** Where the camera was picked for: a shot's own video, or a layer's file. */
export type ShotCameraTargetKind = 'shot' | 'layer';

/** A gesture on the notice that a shot's own camera places the picture. */
export type OwnCameraNoticeAction = 'follow-frame' | 'edit-camera';

// What one page load sends of each event at most: someone trying card after card would otherwise
// outweigh every other visitor.
const PER_EVENT_LIMIT = 30;

/**
 * Reports the choices made on shots and their layers: how the video is
 * cut, the files put on shots and taken off, their layout, their motion
 * and transitions, the transitions between shots and the camera.
 *
 * Only discrete choices, each after it changed something: a slider or a
 * drag fires on every step, and what it ends at is read at export. Each
 * event is capped per page load; moving a boundary, itself a slider, is
 * reported once. Never a file's name or id: a file is its kind.
 */
export class ShotEditTelemetryReporter {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly budget: TelemetryBudget,
    private readonly errorNames: ErrorNameTelemetryDescriber,
  ) {}

  /**
   * The partition was changed. `madeReal` says this edit is the one that
   * turned the proposal into the user's own partition.
   */
  partitionEdited(kind: ShotPartitionEditKind, madeReal: boolean): void {
    if (kind === 'move-boundary' && !this.budget.allows('shot_partition_edited:move-boundary', 1)) return;
    this.capture('shot_partition_edited', { kind, made_real: madeReal });
  }

  /** The video was cut again at `maxShotSec`, throwing away the user's own shots where `discardedEdits`. */
  partitionReproposed(maxShotSec: number, discardedEdits: boolean): void {
    this.capture('shot_partition_edited', { kind: 'repropose', made_real: false, max_shot_sec: maxShotSec, discarded_edits: discardedEdits });
  }

  /** A file was shown on a shot: a new layer, or the file of one already there. */
  filePlaced(role: ShotLayerRole, mediaType: MediaAssetType | null, effect: 'added' | 'replaced', origin: ShotFileOrigin): void {
    this.capture('shot_file_placed', { role, media_type: mediaType, effect, origin });
  }

  /** A file could not be shown on a shot. */
  filePlaceFailed(mediaType: MediaAssetType | null, origin: ShotFileOrigin, error: unknown): void {
    this.capture('shot_file_place_failed', { media_type: mediaType, origin, ...this.errorNames.describe(error) });
  }

  /** `roles` holds the role of each layer taken off: a file's, or `graphic`. */
  layersRemoved(roles: ReadonlyArray<string>, origin: ShotLayerRemovalOrigin): void {
    this.capture('shot_layers_removed', { layer_count: roles.length, roles: [...new Set(roles)].sort(), origin });
  }

  layoutSet(field: ShotLayerLayoutField, value: string, layerCount: number): void {
    this.capture('shot_layer_layout_set', { field, value, layer_count: layerCount });
  }

  /** `preset` is null for no motion. */
  motionSet(scope: string, preset: string | null, layerCount: number): void {
    this.capture('shot_layer_motion_set', { scope, preset: preset ?? 'none', layer_count: layerCount });
  }

  /** A layer's layout changed how it comes in or goes out: a split line's, or a box's. */
  layerTransitionSet(layout: 'split' | 'inset', edge: string, kind: string, layerCount: number): void {
    this.capture('shot_layer_transition_set', { layout, edge, kind, layer_count: layerCount });
  }

  /** A transition into a shot was picked; null kinds are plain cuts. */
  transitionSet(kind: string | null, previousKind: string | null, withSound: boolean): void {
    this.capture('shot_transition_set', { kind: kind ?? 'cut', previous_kind: previousKind ?? 'cut', with_sound: withSound });
  }

  /** A camera preset was picked; null presets are none. */
  cameraSet(target: ShotCameraTargetKind, preset: string | null, previousPreset: string | null): void {
    this.capture('shot_camera_set', { target, preset: preset ?? 'none', previous_preset: previousPreset ?? 'none' });
  }

  ownCameraNoticeActed(action: OwnCameraNoticeAction): void {
    this.capture('own_camera_notice_acted', { action });
  }

  private capture(event: TelemetryEventName, properties: TelemetryEventProperties): void {
    if (!this.budget.allows(event, PER_EVENT_LIMIT)) return;
    this.telemetry.capture(event, properties);
  }
}
