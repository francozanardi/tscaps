import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { ModeMatcherConfig } from '@core/caption-modes/domain/ModeMatcherConfig';
import type { TemplateTagName } from '@core/tagging/domain/TagName';

/** What the editor calls a mode and how it explains it. */
export interface TemplateModeIdentity {
  readonly label: string;
  readonly legend: string | null;
}

/**
 * A look a template designs for some of its captions, beside the body
 * every other caption gets: its own way of cutting captions and of
 * breaking their lines. The words in it carry `tag`, which the
 * `matchers` set when the template is applied and the person can change
 * by hand; the template's stylesheet styles them through it.
 */
export interface TemplateMode extends TemplateModeIdentity {
  readonly tag: TemplateTagName;
  readonly matchers: readonly ModeMatcherConfig[];
  readonly segmentSplitterConfigs: readonly SegmentSplitterConfig[];
  readonly lineSplitter: LineSplitterConfig;
}

/**
 * Every mode of a template: the body, which is every caption no other
 * mode takes and whose layout is the template's own, and the modes
 * beyond it, in the order the editor offers them.
 */
export interface TemplateModes {
  readonly base: TemplateModeIdentity;
  readonly extra: readonly TemplateMode[];
}

/** The modes of a template that designs only its body captions. */
export const BODY_ONLY_MODES: TemplateModes = {
  base: { label: 'Captions', legend: null },
  extra: [],
};
