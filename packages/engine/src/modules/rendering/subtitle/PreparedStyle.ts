import type { AlignmentConfig } from '@modules/rendering/types/AlignmentConfig';
import type { DecorationPlacementSide } from '@modules/rendering/types/DecorationPlacementSide';
import type { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { RenderingConfig } from '@modules/rendering/types/RenderingConfig';
import type { SvgFilterBundle } from '@modules/svg-filter/SvgFilterBundle';
import type { InlineStyleEmitter } from '@modules/rendering/styles/InlineStyleEmitter';
import type { BaselineNeeds } from '@modules/rendering/styles/BaselineCssComposer';

/**
 * A `SubtitleStyle` after preparation: CSS minified, embedded, and
 * scoped to a unique class; the probe container mounted in the host
 * document; baseline needs computed; per-style `InlineStyleEmitter`
 * wired to filter unused CSS custom properties from inline `style`
 * attributes.
 */
export interface PreparedStyle {
  kind: string;
  scopedCss: string;
  filters: SvgFilterBundle;
  inlineStyles: InlineStyleMap;
  alignment: AlignmentConfig;
  rendering: RenderingConfig;
  wordOverrides: ElementRenderOverrides;
  segmentOverrides: ElementRenderOverrides;
  decorationPlacements: ReadonlyMap<string, DecorationPlacementSide>;
  probeContainer: HTMLElement;
  scopeClass: string;
  inlineStyleEmitter: InlineStyleEmitter;
  baselineNeeds: BaselineNeeds;
  baselineCss: string;
}
