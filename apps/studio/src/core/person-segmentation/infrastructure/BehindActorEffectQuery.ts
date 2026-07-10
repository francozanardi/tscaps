import type { Document, SubtitleStyle } from '@tscaps/engine';
import { CssVariable } from '@tscaps/engine';

/**
 * Answers "is the text-behind-actor effect active on any segment
 * playing at this timestamp?" for a given render document and style
 * set. A segment is active when its sheet's template opts into the
 * effect and the segment carries `scene-valid=1`, or when the
 * segment carries `forced=1` regardless of the template.
 */
export class BehindActorEffectQuery {

  constructor(
    private readonly document: Document,
    private readonly styles: Readonly<Record<string, SubtitleStyle>>,
  ) {}

  hasActiveEffectAt(time: number): boolean {
    for (const section of this.document.sections) {
      const style = this.styles[section.kind];
      if (style === undefined) continue;
      const templateOptsIn = style.rendering.behindActor.required;
      for (const segment of section.segments) {
        if (!segment.time.contains(time)) continue;
        if (this.segmentTriggersEffect(style, segment.id, templateOptsIn)) return true;
      }
    }
    return false;
  }

  private segmentTriggersEffect(style: SubtitleStyle, segmentId: string, templateOptsIn: boolean): boolean {
    const override = style.segmentOverrides?.get(segmentId);
    const inline = override?.inlineStyles;
    if (inline === undefined) return false;
    if (inline[CssVariable.BEHIND_ACTOR_FORCED] === '1') return true;
    if (templateOptsIn && inline[CssVariable.BEHIND_ACTOR_SCENE_VALID] === '1') return true;
    return false;
  }
}
