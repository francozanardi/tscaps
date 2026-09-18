import type { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import type { FontStack } from '@core/fonts/domain/FontStack';
import { FONT_SCRIPTS, type FontScript } from '@core/fonts/domain/FontScript';

export interface ScriptFontFace {
  readonly script: FontScript;
  readonly family: string;
}

/** Selects faces in a fixed script order, independent of the majority of the text. */
export class DrawableFamilyResolver {

  /** Every active script has exactly one face. Urdu replaces Arabic, rather than competing with it. */
  assignments(stack: FontStack, scripts: CaptionScripts): ScriptFontFace[] {
    const active = FONT_SCRIPTS.filter((script) => script !== 'urdu' && scripts.present.has(script));
    if (active.length === 0 && !scripts.hasOtherLetters) active.push('latin');
    return active.map((script) => {
      const resolved = script === 'arabic' && scripts.readsAsUrdu ? 'urdu' : script;
      return { script: resolved, family: stack.familyFor(resolved) };
    });
  }

  /** Families whose files may be needed, each once. */
  resolve(stack: FontStack, scripts: CaptionScripts): string[] {
    return [...new Set(this.assignments(stack, scripts).map(({ family }) => family))];
  }

  /** Includes the assignment: exchanging two scripts' faces must produce a different CSS family. */
  identity(stack: FontStack, scripts: CaptionScripts): string[] {
    const managed = this.assignments(stack, scripts).map(({ script, family }) => `${script}:${family}`);
    if (scripts.otherLetterCodepoints.size === 0) return managed;
    const otherPoints = [...scripts.otherLetterCodepoints].sort((a, b) => a - b).join('-');
    return [...managed, `other:${otherPoints}`];
  }
}
