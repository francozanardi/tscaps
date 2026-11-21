import { CAPTION_ELEMENT_KINDS, type CaptionElementKind } from '@core/elements/domain/ElementKind';
import { CAPTION_ANIMATION_VARIABLES } from '@core/elements/domain/CaptionAnimationVariables';
import {
  ANIMATED_KIND_BY_SCOPE,
  ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/** The scopes a caption element could hold an animation under at v27, every one of them an entrance. */
const ELEMENT_SCOPES_V27: ReadonlyArray<ElementAnimationScope> = [
  ElementAnimationScope.SELF,
  ElementAnimationScope.WORDS,
  ElementAnimationScope.EMOJIS,
];

/** The scopes a sheet could answer at v27, every one of them an entrance. */
const SHEET_SCOPES_V27: ReadonlyArray<ElementAnimationScope> = [
  ElementAnimationScope.SEGMENTS,
  ElementAnimationScope.WORDS,
  ElementAnimationScope.EMOJIS,
];

/** The first rule of a sheet's block, and the `animation` its last line declares. */
const SHEET_RULE_ANIMATION = /^([^{]*\{[^}]*?\n)([ \t]*)animation: ([^;\n]*);(\n\})/;

/**
 * v27 → v28: a caption's entrance publishes its half of the element's
 * motion instead of writing `animation` whole.
 *
 * An element plays its entrance and its exit through one `animation`,
 * each end answered on its own, so each publishes its shorthand in the
 * custom property its kind keeps for that end and both declare the one
 * `animation` that plays them. A v27 entrance wrote `animation` itself,
 * which would erase any exit given to the same element at another
 * level. Nothing renders differently: the published shorthand is the
 * one the entrance used to write, and nothing else publishes an exit
 * in a v27 project.
 *
 * **An element's block is found the only way the editor ever finds
 * it**, by spelling it the way it was written: the block the record
 * builds today, with its two published lines folded back into the
 * `animation` they replace. A block that is not there — edited by hand,
 * or left by a library that has changed since — is left as it is,
 * still rendering, and reads as taken over exactly as it did at v27.
 *
 * **A sheet's block is not user text**, and is always ours as written
 * at the time: the `animation` its own rule ends with is rewritten in
 * place, whatever the library looked like when it was picked.
 *
 * The payload is read field by field rather than through the store's
 * own readers, which keep moving while this step does not. The builder
 * is the one thing borrowed from production — spelling those
 * declarations by hand would write text the editor would not recognise
 * as its own.
 */
export class ProjectV27ToV28Migration implements ProjectMigration {
  readonly fromVersion = 27;

  constructor(private readonly animationCssBuilder: ElementAnimationCssBuilder) {}

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const migrated: Record<string, unknown> = { ...data };
    if ('elementStyles' in data) migrated.elementStyles = this.migratedStyles(data.elementStyles);
    if (Array.isArray(data.sheets)) migrated.sheets = data.sheets.map((sheet) => this.migratedSheet(sheet));
    if (Array.isArray(data.captionTracks)) {
      migrated.captionTracks = data.captionTracks.map((track) => this.migratedTrack(track));
    }
    return migrated;
  }

  private migratedTrack(track: unknown): unknown {
    if (track === null || typeof track !== 'object') return track;
    const stored = track as Record<string, unknown>;
    return {
      ...stored,
      ...('elementStyles' in stored ? { elementStyles: this.migratedStyles(stored.elementStyles) } : {}),
      ...(Array.isArray(stored.sheets) ? { sheets: stored.sheets.map((sheet) => this.migratedSheet(sheet)) } : {}),
    };
  }

  private migratedStyles(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    const styles: Record<string, unknown> = {};
    for (const [elementId, style] of Object.entries(value as Record<string, unknown>)) {
      styles[elementId] = this.migratedStyle(style);
    }
    return styles;
  }

  private migratedStyle(style: unknown): unknown {
    if (style === null || typeof style !== 'object') return style;
    const stored = style as Record<string, unknown>;
    const kind = this.captionKind(stored.kind);
    if (kind === null || typeof stored.css !== 'string') return style;
    let css = stored.css;
    for (const scope of ELEMENT_SCOPES_V27) {
      const animation = this.readAnimation((stored.animations as Record<string, unknown> | undefined)?.[scope]);
      if (animation !== null) css = this.withElementBlockRepublished(css, animation, kind, scope);
    }
    return css === stored.css ? style : { ...stored, css };
  }

  private withElementBlockRepublished(
    css: string,
    animation: ElementAnimation,
    kind: CaptionElementKind,
    scope: ElementAnimationScope,
  ): string {
    const published = this.animationCssBuilder.build(animation, kind, scope);
    if (published.length === 0) return css;
    const written = this.asWrittenAtV27(published, ANIMATED_KIND_BY_SCOPE[scope] ?? kind);
    const at = css.indexOf(written);
    if (at === -1) return css;
    return `${css.slice(0, at)}${published}${css.slice(at + written.length)}`;
  }

  /** The block as v27 wrote it: the entrance's two published lines folded back into the one `animation` they replace. */
  private asWrittenAtV27(published: string, animatedKind: CaptionElementKind): string {
    const variables = CAPTION_ANIMATION_VARIABLES[animatedKind];
    const pair = new RegExp(
      `^([ \\t]*)${variables.entrance}: ([^;\\n]*);\\n\\1animation: var\\(${variables.entrance}, none\\), var\\(${variables.exit}, none\\);$`,
      'm',
    );
    return published.replace(pair, '$1animation: $2;');
  }

  private migratedSheet(sheet: unknown): unknown {
    if (sheet === null || typeof sheet !== 'object') return sheet;
    const stored = sheet as Record<string, unknown>;
    const animations = stored.animations;
    if (animations === null || typeof animations !== 'object') return sheet;
    const migrated: Record<string, unknown> = { ...(animations as Record<string, unknown>) };
    for (const scope of SHEET_SCOPES_V27) {
      migrated[scope] = this.migratedSheetAnswer(migrated[scope], ANIMATED_KIND_BY_SCOPE[scope]!);
    }
    return { ...stored, animations: migrated };
  }

  /** A replacing answer with its rule's `animation` published; a tuning answer, which writes no `animation`, as it was. */
  private migratedSheetAnswer(answer: unknown, kind: CaptionElementKind): unknown {
    if (answer === null || typeof answer !== 'object') return answer;
    const stored = answer as Record<string, unknown>;
    if (stored.kind === 'tuned' || typeof stored.css !== 'string') return answer;
    const variables = CAPTION_ANIMATION_VARIABLES[kind];
    const css = stored.css.replace(
      SHEET_RULE_ANIMATION,
      (_match, head: string, indent: string, shorthand: string, tail: string) => `${head}${indent}${variables.entrance}: ${shorthand};\n`
        + `${indent}animation: var(${variables.entrance}, none), var(${variables.exit}, none);${tail}`,
    );
    return { ...stored, css };
  }

  private captionKind(value: unknown): CaptionElementKind | null {
    return (CAPTION_ELEMENT_KINDS as ReadonlyArray<string>).includes(value as string) ? value as CaptionElementKind : null;
  }

  private readAnimation(value: unknown): ElementAnimation | null {
    if (value === null || typeof value !== 'object') return null;
    const { presetId, params } = value as Partial<ElementAnimation>;
    if (presetId !== null && typeof presetId !== 'string') return null;
    return { presetId, params: params ?? {} };
  }
}
