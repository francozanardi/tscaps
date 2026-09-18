import type { AlignmentConfig, TextDirection } from '@tscaps/engine';
import { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import type { Template } from '@core/templates/domain/Template';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import { SHEET_ROLES, type SheetRole } from '@core/sheets/domain/SheetRole';
import { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';
import { StyleValues } from '@core/sheets/domain/StyleValues';

export const MAIN_SHEET_ID = 'main';
export const MAIN_SHEET_COLOR = '#94a3b8';

/**
 * Hook's identity, named separately because the transcript paints its
 * own hook affordances in these and reads better for it. The role table
 * stays the source — see `SHEET_ROLES`.
 */
export const HOOK_SHEET_ID = SHEET_ROLES.hook.sheetId;
export const HOOK_SHEET_COLOR = SHEET_ROLES.hook.color;

export interface SheetProps {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly template: Template;
  readonly variantIndex: number;
  readonly styleValues: StyleValues;
  readonly typographyConfig: TypographyConfig;
  readonly rotationConfig: RotationConfig;
  readonly segmentSplitterConfigs: ReadonlyArray<SegmentSplitterConfig>;
  readonly lineSplitterConfig: LineSplitterConfig;
  readonly alignmentConfig: AlignmentConfig;
  readonly effectConfigs: ReadonlyArray<EffectConfig>;
  readonly animations?: SheetAnimationSet | undefined;
  readonly cssOverride?: string | null | undefined;
  readonly filtersSvgOverride?: string | null | undefined;
  readonly linkGroupId?: string | null | undefined;
  readonly role?: SheetRole | null | undefined;
  readonly textDirection?: TextDirection | undefined;
  readonly scripts?: CaptionScripts | undefined;
}

/**
 * A Sheet groups a Template with the current styling state: control
 * values, splitter configs, alignment, typography, and effects. It also
 * carries identity (id, name, color) so the user can label it in the UI.
 *
 * Sheet assignment lives in `Section.kind`: each Section's `kind` is the
 * id of the Sheet whose pipeline should process its segments. The deriver
 * re-pipes each Section under its sheet's rules to produce the derived
 * Section. See `docs/DOCUMENT_ARCHITECTURE.md` on why there is no
 * separate raw document.
 *
 * Immutable: every mutation returns a new instance.
 */
export class Sheet {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly template: Template;
  /**
   * Which preset this sheet wants — a preference, not a position: never
   * clamped to the current template's range, so it survives a template
   * that ships fewer presets, or none. Index into `template.variants`
   * through `resolveVariantIndex()`.
   */
  readonly variantIndex: number;
  readonly styleValues: StyleValues;
  readonly typographyConfig: TypographyConfig;
  readonly rotationConfig: RotationConfig;
  readonly segmentSplitterConfigs: ReadonlyArray<SegmentSplitterConfig>;
  readonly lineSplitterConfig: LineSplitterConfig;
  readonly alignmentConfig: AlignmentConfig;
  readonly effectConfigs: ReadonlyArray<EffectConfig>;
  /** How everything under this sheet moves, unless an element says otherwise. */
  readonly animations: SheetAnimationSet;
  readonly cssOverride: string | null;
  readonly filtersSvgOverride: string | null;
  readonly linkGroupId: string | null;
  /**
   * Narrative role this sheet plays in the video's caption structure,
   * or `null` for a plain sheet. Roles are not singletons — several
   * sheets may carry the same one. Survives template and variant
   * switches: it states what the sheet is for, not how it looks.
   */
  readonly role: SheetRole | null;
  /**
   * Paragraph direction the bidirectional algorithm resolves this
   * sheet's lines against. It states the language of the captions, not
   * a look, which is why switching template or resetting the typography
   * slice leaves it untouched.
   */
  readonly textDirection: TextDirection;
  /**
   * Which writing systems the captions this sheet renders are in.
   * Derived state, never persisted: re-classified from the document
   * every time the document is re-derived, so it cannot go stale —
   * unlike `textDirection`, there is no user choice to respect. It
   * decides which face of the sheet's font stack leads, and which faces
   * the stack has to be compiled for.
   */
  readonly scripts: CaptionScripts;

  constructor(props: SheetProps) {
    this.id = props.id;
    this.name = props.name;
    this.color = props.color;
    this.template = props.template;
    this.variantIndex = props.variantIndex;
    this.styleValues = props.styleValues;
    this.typographyConfig = props.typographyConfig;
    this.rotationConfig = props.rotationConfig;
    this.segmentSplitterConfigs = props.segmentSplitterConfigs;
    this.lineSplitterConfig = props.lineSplitterConfig;
    this.alignmentConfig = props.alignmentConfig;
    this.effectConfigs = props.effectConfigs;
    this.animations = props.animations ?? SheetAnimationSet.empty();
    this.cssOverride = props.cssOverride ?? null;
    this.filtersSvgOverride = props.filtersSvgOverride ?? null;
    this.linkGroupId = props.linkGroupId ?? null;
    this.role = props.role ?? null;
    this.textDirection = props.textDirection ?? 'ltr';
    this.scripts = props.scripts ?? CaptionScripts.none();
  }

  with(changes: Partial<SheetProps>): Sheet {
    return new Sheet({
      id: this.id,
      name: this.name,
      color: this.color,
      template: this.template,
      variantIndex: this.variantIndex,
      styleValues: this.styleValues,
      typographyConfig: this.typographyConfig,
      rotationConfig: this.rotationConfig,
      segmentSplitterConfigs: this.segmentSplitterConfigs,
      lineSplitterConfig: this.lineSplitterConfig,
      alignmentConfig: this.alignmentConfig,
      effectConfigs: this.effectConfigs,
      animations: this.animations,
      cssOverride: this.cssOverride,
      filtersSvgOverride: this.filtersSvgOverride,
      linkGroupId: this.linkGroupId,
      role: this.role,
      textDirection: this.textDirection,
      scripts: this.scripts,
      ...changes,
    });
  }

  /**
   * Applies a new Template, resetting style values, typography, splitter
   * configs, alignment, effects, and any user-edited source overrides
   * (CSS and filters.svg) to template defaults. The `variantIndex`
   * survives untouched, so a sheet representing "the second preset"
   * stays on the second preset of whichever template it lands on — and
   * comes back to it after a detour through a template that ships fewer
   * variants, or none.
   */
  withTemplate(template: Template): Sheet {
    return this.with({
      template,
      styleValues: StyleValues.fromTemplateVariant(template, this.variantIndex),
      typographyConfig: template.typography,
      rotationConfig: template.rotation,
      segmentSplitterConfigs: template.segmentSplitterConfigs,
      lineSplitterConfig: template.lineSplitter,
      alignmentConfig: template.alignment,
      effectConfigs: template.effectConfigs,
      animations: SheetAnimationSet.empty(),
      cssOverride: null,
      filtersSvgOverride: null,
    });
  }

  /**
   * Re-seeds `styleValues` from the current template defaults plus the
   * overrides of the variant this index resolves to. Manual per-field
   * edits made before the switch are dropped — switching variant follows
   * the same "preset replaces local edits" rule as switching template.
   * The index is stored as given, out of the current template's range or
   * not: it states which preset the sheet wants, and the template it sits
   * on decides what that comes out as today.
   */
  withVariant(variantIndex: number): Sheet {
    return this.with({
      variantIndex,
      styleValues: StyleValues.fromTemplateVariant(this.template, variantIndex),
    });
  }

  /**
   * The slot in the current template's variants this sheet reads today.
   * Every consumer that indexes into `template.variants` — a picker
   * showing which preset is on, a baseline rebuild — asks this rather
   * than `variantIndex`, which is a preference and may name a slot the
   * current template does not have. `0` when the template ships no
   * variants.
   */
  resolveVariantIndex(): number {
    return this.template.resolveVariantIndex(this.variantIndex);
  }

  /**
   * The persisted config for the effect of the given type, or `null`
   * when the sheet does not carry one. Consumers read `.enabled` for
   * the runtime toggle and the type-specific fields for parameters.
   * UI surfaces that need a sensible fallback to render an off-state
   * control layer the registry's `defaultConfig` on top of this.
   */
  effectConfig<T extends EffectConfig['type']>(type: T): Extract<EffectConfig, { type: T }> | null {
    for (const config of this.effectConfigs) {
      if (config.type === type) return config as Extract<EffectConfig, { type: T }>;
    }
    return null;
  }

  /**
   * The CSS to apply to this sheet's overlay/export. Returns the user's
   * edited copy when present, otherwise the template's pristine CSS.
   */
  resolveCss(): string {
    return this.cssOverride ?? this.template.getCss();
  }

  /**
   * The raw `filters.svg` source to apply to this sheet. Returns the
   * user's edited copy when present, otherwise the template's pristine
   * filters source (empty string when the template ships none).
   */
  resolveFiltersSvg(): string {
    return this.filtersSvgOverride ?? this.template.getFiltersSvg();
  }

  /** Creates an independent sheet with the same look under a new identity. */
  copyAs(id: string, name: string): Sheet {
    return new Sheet({
      id,
      name,
      color: this.color,
      template: this.template,
      variantIndex: this.variantIndex,
      styleValues: this.styleValues,
      typographyConfig: this.typographyConfig,
      rotationConfig: this.rotationConfig,
      segmentSplitterConfigs: this.segmentSplitterConfigs,
      lineSplitterConfig: this.lineSplitterConfig,
      alignmentConfig: this.alignmentConfig,
      effectConfigs: this.effectConfigs,
      animations: this.animations,
      cssOverride: this.cssOverride,
      filtersSvgOverride: this.filtersSvgOverride,
      linkGroupId: null,
      role: null,
      textDirection: this.textDirection,
      scripts: this.scripts,
    });
  }

  /**
   * Builds a Sheet from a Template, using the template's defaults
   * (with the first variant's overrides layered in, when the template
   * ships variants) for every styling field.
   *
   * `textDirection` is a parameter rather than a default because a
   * template carries no answer to it: it states the language of the
   * captions, and every other argument here describes the look.
   */
  static fromTemplate(
    id: string,
    name: string,
    color: string | null,
    template: Template,
    textDirection: TextDirection,
  ): Sheet {
    return new Sheet({
      id,
      name,
      color,
      template,
      variantIndex: 0,
      styleValues: StyleValues.fromTemplateVariant(template, 0),
      typographyConfig: template.typography,
      rotationConfig: template.rotation,
      segmentSplitterConfigs: template.segmentSplitterConfigs,
      lineSplitterConfig: template.lineSplitter,
      alignmentConfig: template.alignment,
      effectConfigs: template.effectConfigs,
      textDirection,
    });
  }

  /**
   * Builds the canonical `main` Sheet (id, name, and color fixed) from a
   * Template. Centralises these literals so every entry point that resets
   * the editing session — startup, new-video upload, video clear — produces
   * an identical baseline.
   *
   * Reads left to right, which is the only honest answer at this point:
   * the session is being reset, so there is no transcript yet to read a
   * direction off. Preprocessing seeds the real one once there is.
   */
  static createMain(template: Template): Sheet {
    return Sheet.fromTemplate(MAIN_SHEET_ID, 'Main', MAIN_SHEET_COLOR, template, 'ltr');
  }

  /**
   * Builds the canonical Sheet for a role, with the id, name, color and
   * role its definition fixes, from the given Template.
   *
   * @param textDirection how this sheet's captions read. A role names a
   *   part of the same recording as every other sheet, so this is the
   *   project's answer rather than one derived from the role's content.
   */
  static createForRole(role: SheetRole, template: Template, textDirection: TextDirection): Sheet {
    const definition = SHEET_ROLES[role];
    return Sheet
      .fromTemplate(definition.sheetId, definition.name, definition.color, template, textDirection)
      .with({ role });
  }
}
