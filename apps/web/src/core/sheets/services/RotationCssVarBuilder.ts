import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import { TemplateCssVariable } from '@core/templates/domain/TemplateCssVariable';

/**
 * Emits the `--tscaps-rotation` CSS variable that template `style.css`
 * files read via `var(--tscaps-rotation, 0deg)` on the segment selector.
 * Always emitted: the user expects the rotation slider to behave the same
 * way on every template that opts in (templates that don't read the var
 * silently ignore it, matching the typography contract).
 */
export class RotationCssVarBuilder {
  build(config: RotationConfig): Record<string, string> {
    return {
      [TemplateCssVariable.ROTATION]: `${config.angleDeg}deg`,
    };
  }
}
