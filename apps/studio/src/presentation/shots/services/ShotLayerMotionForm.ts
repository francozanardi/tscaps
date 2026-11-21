import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import { ShotCamera } from '@core/shots/domain/ShotCamera';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementControl } from '@core/elements/domain/ElementControl';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import type { ShotLayerAnimationScope } from '@core/shots/actions/SetShotLayerAnimationAction';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';

/**
 * One field of a picked motion, as the panel shows it. A number is shown
 * in the units it reads in — a fraction as a percentage — with the range
 * and the step in the same units.
 */
export type ShotLayerMotionFieldView =
  | {
    readonly kind: 'number';
    readonly control: ElementControl;
    readonly shown: number;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly unit: string;
  }
  | { readonly kind: 'choice'; readonly control: ElementControl; readonly value: string };

// A layer's motion is how it comes in and leaves; what it does in between is its camera's, in a tab of its own.
const SCOPES: ReadonlyArray<ShotLayerAnimationScope> = [
  ElementAnimationScope.ENTRANCE,
  ElementAnimationScope.EXIT,
];
const SCOPE_TITLES: Readonly<Record<ShotLayerAnimationScope, string>> = {
  [ElementAnimationScope.ENTRANCE]: 'Entrance',
  [ElementAnimationScope.EXIT]: 'Exit',
  [ElementAnimationScope.CAMERA]: 'Camera',
};
const PERCENT = 100;
// How a CSS unit reads beside a number on screen.
const UNIT_LABELS: Readonly<Record<string, string>> = { deg: '°' };
const PRESET_ID_PARTS = /^layer-(.+)-(?:entrance|exit|camera)$/;

/**
 * What a layer's motion is offered by at one end — the presets of that
 * end, then the picked one's own fields — for one layer or several
 * edited together. Several show the first one's motion, and say where
 * the rest hold something else: another preset, or another value of a
 * field their preset shares with the first's.
 *
 * Reads the record each layer's style holds, never its CSS.
 */
export class ShotLayerMotionForm {
  constructor(
    private readonly catalog: ElementAnimationCatalog,
    private readonly timing: ElementTimingVariableResolver,
  ) {}

  /** The ends a layer moves at, in the order they are offered. */
  scopes(): ReadonlyArray<ShotLayerAnimationScope> {
    return SCOPES;
  }

  /**
   * The camera of a shot whose video wears `fields`, and `animation` at
   * its camera, read with the library's preset for it.
   */
  cameraOf(fields: ElementFieldValues | undefined, animation: ElementAnimation | undefined): ShotCamera {
    return ShotCamera.of(fields, animation, animation?.presetId ? this.catalog.byId(animation.presetId) : null);
  }

  /** What the part is called: "Entrance", "Exit", "Zoom". */
  scopeTitle(scope: ShotLayerAnimationScope): string {
    return SCOPE_TITLES[scope];
  }

  /**
   * What the motion grid says under it for `layers`: for graphics, that
   * their own animation plays whatever is picked, and what is picked
   * moves the whole box on top of it; null for any other layer.
   */
  ownMotionNoteOf(layers: ReadonlyArray<ShotLayer>): string | null {
    return layers.length > 0 && layers.every((layer) => 'graphic' in layer)
      ? 'The graphic’s own animation always plays. This moves the whole box on top of it.'
      : null;
  }

  /** The presets offered at `scope`, in the order the library lists them, after *None*. */
  presets(scope: ShotLayerAnimationScope): ReadonlyArray<ElementAnimationPreset> {
    return this.catalog.forClock('layer', this.timing.resolve('layer', scope));
  }

  /** What a preset is called: the motion it plays, the same at both ends — `layer-zoom-out-exit` is "Zoom out". */
  labelOf(preset: ElementAnimationPreset): string {
    const motion = PRESET_ID_PARTS.exec(preset.id)?.[1] ?? preset.id;
    const words = motion.replace(/-/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  /** What the preset `animation` plays is called, or null where it plays none. */
  pickedLabelOf(animation: ElementAnimation | undefined): string | null {
    const preset = this.presetOf(animation);
    return preset === null ? null : this.labelOf(preset);
  }

  /** The preset `animation` plays, or null for none — and for one the library no longer holds, which plays none. */
  pickedPresetId(animation: ElementAnimation | undefined): string | null {
    const presetId = animation?.presetId ?? null;
    return presetId !== null && this.catalog.byId(presetId) !== null ? presetId : null;
  }

  /** Whether the layers whose animations are `animations` do not all play the first one's preset. */
  isPresetMixed(animations: ReadonlyArray<ElementAnimation | undefined>): boolean {
    const [first, ...rest] = animations.map((animation) => this.pickedPresetId(animation));
    return rest.some((presetId) => presetId !== first);
  }

  /**
   * The fields of the first animation that some other animation holds
   * another value of, among those whose preset offers the same field.
   */
  mixedFieldIds(animations: ReadonlyArray<ElementAnimation | undefined>): ReadonlySet<string> {
    const [first, ...rest] = animations;
    const mixed = new Set<string>();
    const firstPreset = this.presetOf(first);
    if (first === undefined || firstPreset === null) return mixed;
    for (const other of rest) {
      const otherPreset = this.presetOf(other);
      if (other === undefined || otherPreset === null) continue;
      for (const control of firstPreset.controls) {
        const shared = otherPreset.controls.find((held) => held.id === control.id && held.type === control.type);
        if (shared !== undefined && this.valueOf(other, shared) !== this.valueOf(first, control)) mixed.add(control.id);
      }
    }
    return mixed;
  }

  /** The picked preset's fields, in its order, each with what it holds; none for no motion. */
  fieldsOf(animation: ElementAnimation | undefined): ReadonlyArray<ShotLayerMotionFieldView> {
    const preset = this.presetOf(animation);
    if (animation === undefined || preset === null) return [];
    return preset.controls.map((control) => this.viewOf(control, this.valueOf(animation, control)));
  }

  /** The value a number field records for what it shows. */
  recordedValue(view: Extract<ShotLayerMotionFieldView, { kind: 'number' }>, shown: number): number {
    return view.control.readAs === 'percent' ? this.rounded(shown / PERCENT) : shown;
  }

  /** How long the picked preset at this end lasts, in seconds; 0 for none. */
  durationSec(animation: ElementAnimation | undefined): number {
    const control = this.presetOf(animation)?.controls.find((candidate) => candidate.unit === 's');
    if (animation === undefined || control === undefined) return 0;
    const value = this.valueOf(animation, control);
    return typeof value === 'number' ? value : 0;
  }

  private viewOf(control: ElementControl, value: ElementControlValue): ShotLayerMotionFieldView {
    if (control.type !== 'number') return { kind: 'choice', control, value: String(value) };
    const scale = control.readAs === 'percent' ? PERCENT : 1;
    return {
      kind: 'number',
      control,
      shown: this.rounded(Number(value) * scale),
      min: this.rounded((control.min ?? 0) * scale),
      max: this.rounded((control.max ?? 1) * scale),
      step: this.rounded((control.step ?? 1) * scale),
      unit: control.readAs === 'percent' ? '%' : UNIT_LABELS[control.unit ?? ''] ?? control.unit ?? '',
    };
  }

  /** Without the float noise a scale by a hundred leaves: 0.35 shown is 35, and 35 recorded is 0.35. */
  private rounded(value: number): number {
    return Number(value.toFixed(6));
  }

  private presetOf(animation: ElementAnimation | undefined): ElementAnimationPreset | null {
    const presetId = this.pickedPresetId(animation);
    return presetId === null ? null : this.catalog.byId(presetId);
  }

  private valueOf(animation: ElementAnimation, control: ElementControl): ElementControlValue {
    return animation.params[control.id] ?? control.defaultValue;
  }
}
