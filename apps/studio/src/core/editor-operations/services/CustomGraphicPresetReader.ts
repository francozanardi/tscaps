import { CssVariable } from '@tscaps/engine';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';
import type { GraphicDocumentCheck } from '@core/editor-operations/services/GraphicDocumentCheck';
import type { GraphicFieldsCheck } from '@core/editor-operations/services/GraphicFieldsCheck';
import type { CustomGraphicInput, GraphicMotionInput } from '@core/editor-operations/services/GraphicInputSchemas';
import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetAnimation } from '@core/graphics/domain/GraphicPresetMotion';
import type { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';


// Where a graphic written from nothing starts when it names no box: a picture in picture, centred.
const DEFAULT_BOX = { kind: 'box', centerX: 0.5, centerY: 0.5, width: 0.8 } as const;
/** A custom graphic, read: the preset it makes and what may not work as written, or why it cannot be made. */
export type CustomGraphicReading =
  | { readonly ok: true; readonly preset: GraphicPreset; readonly warnings: ReadonlyArray<OperationProblem> }
  | { readonly ok: false; readonly problems: ReadonlyArray<OperationProblem> };

const CUSTOM_PRESET_ID = 'custom';
const CUSTOM_PRESET_NAME = 'Custom';
// The shape a graphic is made for when it names none, as a stored graphic without one is read.
const SQUARE = 1;
const MAX_SOUNDS_LISTED = 15;

/**
 * Reads a graphic a caller wrote from nothing into the shape a preset of
 * the library has: its document, fields and shape, the box it starts
 * in, how its layer comes in and leaves, and the sounds on its moments.
 * Everything the editor would drop or ignore without a word is refused
 * here with a problem saying how to write it: a field's default not of
 * its kind, CSS reaching the network, a layer animation, a value of it
 * or a bundled sound that does not exist.
 */
export class CustomGraphicPresetReader {
  constructor(
    private readonly sanitizer: GraphicSanitizer,
    private readonly fieldsCheck: GraphicFieldsCheck,
    private readonly documentCheck: GraphicDocumentCheck,
    private readonly animations: ElementAnimationCatalog,
    private readonly sounds: BuiltinSoundCatalog,
  ) {}

  /** `input` as a preset with its fields at their defaults, starting in a centred box where it names none, with no layer motion where it names none. */
  read(input: CustomGraphicInput): CustomGraphicReading {
    const fields = input.fields ?? [];
    const documentProblems = this.documentCheck.check(input, fields);
    const errors = [
      ...this.fieldsCheck.fieldProblems(fields),
      ...documentProblems.filter((problem) => problem.severity === 'error'),
      ...this.animationProblems('graphic.motion.entrance', input.motion?.entrance, CssVariable.LAYER_STARTS),
      ...this.animationProblems('graphic.motion.exit', input.motion?.exit, CssVariable.LAYER_ENDS),
      ...this.soundProblems(input),
    ];
    if (errors.length > 0) return { ok: false, problems: errors };
    const graphic = this.sanitizer.sanitize({
      document: { html: input.html, css: input.css, js: input.js },
      fields,
      params: {},
      aspectRatio: input.aspectRatio ?? SQUARE,
    });
    if (graphic === null) return { ok: false, problems: [this.error('The graphic could not be read.')] };
    return {
      ok: true,
      preset: this.presetOf(input, graphic),
      warnings: [...documentProblems.filter((problem) => problem.severity === 'warning'), ...this.undeclaredMoments(input)],
    };
  }

  private presetOf(input: CustomGraphicInput, graphic: Graphic): GraphicPreset {
    return {
      id: CUSTOM_PRESET_ID,
      name: CUSTOM_PRESET_NAME,
      description: '',
      category: null,
      graphic,
      box: input.box ?? DEFAULT_BOX,
      motion: { entrance: this.animationOf(input.motion?.entrance), exit: this.animationOf(input.motion?.exit) },
      sounds: (input.sounds ?? []).map((sound) => ({ spot: { kind: 'moment', momentId: sound.moment }, soundId: sound.sound, volume: sound.volume ?? this.underVoiceVolumeOf(sound.sound), offsetSec: 0 })),
      style: null,
    };
  }

  /** The volume that sits bundled sound `soundId` under the voice; a sound the pack lacks is refused before this is read. */
  private underVoiceVolumeOf(soundId: string): number {
    return this.sounds.find(soundId)?.underVoiceVolume ?? 0;
  }

  private animationOf(motion: GraphicMotionInput | undefined): GraphicPresetAnimation | null {
    if (motion === undefined || motion === null) return null;
    if (typeof motion === 'string') return { presetId: motion, params: {} };
    const { animation, ...values } = motion;
    return { presetId: animation, params: values };
  }

  /** Errors for an animation the layer's clock `clock` does not offer, and for each value its preset does not take. */
  private animationProblems(path: string, motion: GraphicMotionInput | undefined, clock: string): OperationProblem[] {
    const animation = this.animationOf(motion);
    if (animation === null) return [];
    const offered = this.animations.forClock('layer', clock);
    const preset = offered.find((candidate) => candidate.id === animation.presetId);
    if (preset === undefined) {
      return [this.error(`${path}: there is no such layer animation "${animation.presetId}"; these are: ${offered.map((each) => each.id).join(', ')}.`)];
    }
    return Object.entries(animation.params).flatMap(([controlId, value]) => this.valueProblems(`${path}.${controlId}`, preset, controlId, value));
  }

  private valueProblems(path: string, preset: ElementAnimationPreset, controlId: string, value: ElementControlValue): OperationProblem[] {
    const control = preset.controls.find((candidate) => candidate.id === controlId);
    if (control === undefined) {
      return [this.error(`${path}: ${preset.id} has no such value; it takes ${preset.controls.map((each) => each.id).join(', ') || 'none'}.`)];
    }
    if (typeof value !== typeof control.defaultValue) return [this.error(`${path}: it takes a ${typeof control.defaultValue}.`)];
    if (control.options !== undefined && !control.options.some((option) => option.value === value)) {
      return [this.error(`${path}: it takes one of ${control.options.map((option) => option.value).join(', ')}.`)];
    }
    const belowMin = control.min !== undefined && typeof value === 'number' && value < control.min;
    const aboveMax = control.max !== undefined && typeof value === 'number' && value > control.max;
    if (belowMin || aboveMax) return [this.error(`${path}: it takes ${control.min ?? 'any value'} to ${control.max ?? 'any value'}.`)];
    return [];
  }

  private soundProblems(input: CustomGraphicInput): OperationProblem[] {
    return (input.sounds ?? []).flatMap((sound, index) => (this.sounds.find(sound.sound) === null
      ? [this.error(`graphic.sounds[${index}].sound: there is no bundled sound "${sound.sound}"; some are ${this.someSoundIds()} (list_catalog sounds lists them all).`)]
      : []));
  }

  /** Warnings for sounds on a moment the code does not seem to declare, as far as reading its text can tell. */
  private undeclaredMoments(input: CustomGraphicInput): OperationProblem[] {
    return (input.sounds ?? []).flatMap((sound, index) => {
      const named = [`'${sound.moment}'`, `"${sound.moment}"`, `\`${sound.moment}\``].some((quoted) => input.js.includes(quoted));
      if (named) return [];
      return [this.warning(`graphic.sounds[${index}]: the code does not seem to declare the moment "${sound.moment}" (tscaps.moment('${sound.moment}', sec, label)); its sound plays only once it does.`)];
    });
  }

  private someSoundIds(): string {
    return this.sounds.list().slice(0, MAX_SOUNDS_LISTED).map((sound) => sound.id).join(', ');
  }

  private warning(message: string): OperationProblem {
    return { severity: 'warning', message };
  }

  private error(message: string): OperationProblem {
    return { severity: 'error', message };
  }
}
