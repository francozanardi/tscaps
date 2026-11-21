import { ANIMATED_KIND_BY_SCOPE, ElementAnimationScope, SHEET_ANIMATION_SCOPES } from '@core/elements/domain/ElementAnimationScope';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import type { ElementControl } from '@core/elements/domain/ElementControl';
import { CAPTION_ELEMENT_KINDS, type CaptionElementKind } from '@core/elements/domain/ElementKind';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';

/** An animation preset as a catalog lists it: its id, its name, and what each of its params takes. */
export interface AnimationPresetRow {
  readonly id: string;
  readonly name: string;
  /** The caption kinds it can move; only for caption presets. */
  readonly moves?: ReadonlyArray<string>;
  /** By param id: what it takes and what it is set to until moved. */
  readonly params?: Readonly<Record<string, string>>;
}

/** The scopes one kind of element offers, each with the kind of node that scope moves. */
export type ScopesMoving = Readonly<Record<string, string>>;

/** The animations caption nodes and sheets can be given, and which scopes take which. */
export interface CaptionAnimationsReadout {
  /** By element kind, and `sheet`, the scopes it offers. */
  readonly scopes: Readonly<Record<string, ScopesMoving>>;
  readonly presets: ReadonlyArray<AnimationPresetRow>;
}

// The UI's name for a layer preset: the motion it plays, the same at both ends.
const LAYER_PRESET_ID = /^layer-(.+)-(?:entrance|exit|camera)$/;

/**
 * Lists the animation presets the editor ships, as a catalog read
 * answers them: the ones for caption nodes with the scopes that take
 * them, a layer's entrances and exits, and the camera moves of a shot's
 * video or a layer. Each param is described in one line: its range or
 * its options, its unit and its default.
 */
export class AnimationPresetReadout {
  constructor(
    private readonly catalog: ElementAnimationCatalog,
    private readonly elementTypes: StyledElementCatalog,
    private readonly timing: ElementTimingVariableResolver,
    private readonly format: ReadoutFormatter,
  ) {}

  captionAnimations(): CaptionAnimationsReadout {
    const scopes: Record<string, ScopesMoving> = {};
    for (const kind of CAPTION_ELEMENT_KINDS) scopes[kind] = this.scopesMoving(kind, this.elementTypes.animationScopesFor(kind));
    scopes['sheet'] = this.scopesMoving(null, SHEET_ANIMATION_SCOPES);
    const captionKinds: ReadonlySet<string> = new Set(CAPTION_ELEMENT_KINDS);
    const presets = this.catalog.all()
      .filter((preset) => preset.kinds.some((kind) => captionKinds.has(kind)))
      .map((preset) => this.rowOf(preset, this.nameOf(preset.id), preset.kinds.filter((kind) => captionKinds.has(kind))));
    return { scopes, presets };
  }

  /** The presets a layer can enter with and leave with. */
  layerMotions(): { readonly entrance: AnimationPresetRow[]; readonly exit: AnimationPresetRow[] } {
    return {
      entrance: this.layerPresetsOn(ElementAnimationScope.ENTRANCE),
      exit: this.layerPresetsOn(ElementAnimationScope.EXIT),
    };
  }

  /** The camera moves a shot's own video or a layer can be given. */
  cameraMoves(): AnimationPresetRow[] {
    return this.layerPresetsOn(ElementAnimationScope.CAMERA);
  }

  /** By scope, the kind of node it moves: `kind` itself for `self`. */
  private scopesMoving(kind: CaptionElementKind | null, scopes: ReadonlyArray<ElementAnimationScope>): ScopesMoving {
    return Object.fromEntries(scopes.flatMap((scope) => {
      const moved = ANIMATED_KIND_BY_SCOPE[scope] ?? kind;
      return moved === null ? [] : [[scope, moved]];
    }));
  }

  private layerPresetsOn(scope: ElementAnimationScope): AnimationPresetRow[] {
    return this.catalog.forClock('layer', this.timing.resolve('layer', scope))
      .map((preset) => this.rowOf(preset, this.nameOf(LAYER_PRESET_ID.exec(preset.id)?.[1] ?? preset.id), null));
  }

  private rowOf(preset: ElementAnimationPreset, name: string, moves: ReadonlyArray<string> | null): AnimationPresetRow {
    return {
      id: preset.id,
      name,
      ...(moves === null ? {} : { moves }),
      ...(preset.controls.length === 0
        ? {}
        : { params: Object.fromEntries(preset.controls.map((control) => [control.id, this.paramText(control)])) }),
    };
  }

  /** `pop-in` as `Pop in`. */
  private nameOf(motion: string): string {
    const words = motion.replace(/-/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  /** One line saying what a param takes: its range and unit or its options, then its default and what it means. */
  private paramText(control: ElementControl): string {
    const takes = control.options === undefined
      ? `${control.type}${this.rangeText(control)}`
      : `one of ${control.options.map((option) => `${option.value} (${option.label})`).join(', ')}`;
    const legend = control.legend === undefined ? '' : `. ${control.legend}`;
    return `${takes}, default ${String(this.format.value(control.defaultValue))}${legend}`;
  }

  private rangeText(control: ElementControl): string {
    const unit = control.unit === undefined ? '' : ` ${control.unit}`;
    if (control.min === undefined || control.max === undefined) return unit;
    return ` ${control.min} to ${control.max}${unit}`;
  }
}
