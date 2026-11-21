import { z } from 'zod';
import type { Segment } from '@tscaps/engine';
import type { SetBehindActorOverrideAction } from '@core/captions/actions/SetBehindActorOverrideAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetElementBlendAction } from '@core/elements/actions/SetElementBlendAction';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { CaptionAncestor, CaptionAncestorLocator } from '@core/editor-operations/services/CaptionAncestorLocator';
import type { CaptionElement, CaptionRefKind, CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { CaptionSceneLocator } from '@core/editor-operations/services/CaptionSceneLocator';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { EnsureSegmentMasksCachedAction } from '@core/person-segmentation/actions/EnsureSegmentMasksCachedAction';
import type { BehindActorOverride } from '@core/person-segmentation/domain/BehindActorOverride';
import type { FootageCover, FootageCoverage } from '@core/person-segmentation/domain/FootageCoverage';
import type { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';

const MODES = ['auto', 'on', 'off'] as const;
type BehindPersonMode = typeof MODES[number];

const MAX_ELEMENTS = 200;
// Long enough for the person cutout of a few scenes on a laptop; past it the answer says the effect is not shown yet.
const CUTOUT_WAIT_MS = 60_000;
const BEHIND_PERSON_KINDS: ReadonlyArray<CaptionRefKind> = ['segment', 'word', 'decoration'];
const BLEND_KINDS: ReadonlyArray<CaptionRefKind> = ['segment', 'line', 'word', 'decoration'];

/** What the call asks of every element it names; a part left out is left as it is. */
interface EffectsAsked {
  readonly behindPerson?: BehindPersonMode | undefined;
  readonly blendWithVideo?: boolean | undefined;
}

/** A caption element the call names, with the scene it is painted in and the nodes around it, nearest first. */
interface PlacedElement {
  readonly element: CaptionElement;
  readonly scene: Segment;
  readonly ancestors: ReadonlyArray<CaptionAncestor>;
}

/**
 * `set_caption_element_effects`: what a caption segment, line, word or
 * emoji does to the video beneath it, as the inspector's Effects tab
 * sets it: whether it goes behind the person in the video, and whether
 * it blends with the video.
 *
 * Turning behind-the-person on also computes the person's cutout over
 * the scenes concerned, and waits for it up to a minute, so frames
 * pictured after the answer show the effect; past that the answer says
 * the effect is not shown yet. Refuses an element whose template does
 * not let it be set by hand: a template can keep the switch from its
 * scenes, and one that paints the video inside its captions cannot put
 * a single word behind. Refuses turning it on in a scene a shot layer
 * shows over, even for an instant at its edge, naming the layer and the
 * stretch it covers: the effect never runs there, so an "on" would be
 * written and never seen.
 *
 * Blending an element takes the blend off everything inside it. An
 * element inside one that blends already blends with it: asking it to
 * blend changes nothing, and asking it not to is refused, since only
 * the element around it can take that off.
 */
export class SetCaptionElementEffectsOperation implements EditorOperation {
  readonly name = 'set_caption_element_effects';
  readonly effect = 'edit';
  readonly description = [
    'Put caption elements behind the person in the video, or blend them with it; every element named gets the same values.',
    'behindPerson: the person is cut out of the frame and painted over the text, so they pass in front of it. Works on scenes (segments), words and emojis.',
    '"on" turns it on; on a word or emoji only that part goes behind and the rest of its scene stays in front. "off" keeps a scene in front even where its template would put it behind; "auto" gives the scene back to its template (only some templates do it on their own, where the person is steady). For a word or emoji "off" and "auto" are the same.',
    'Turning it on computes the person cutout before answering; until the answer says ready, frames do not show the effect.',
    'It never runs in a scene any shot layer (b-roll, picture, GIF, graphic) shows over, even for a fraction of a second at the scene\'s edge: the whole scene stays in front, its words and emojis too. Turning it on there is refused with the layer and the seconds it covers; to put the scene behind, make the two stop overlapping (move the boundary of the layer\'s shot, or end the layer\'s run earlier) and ask again.',
    'blendWithVideo: true inverts the video behind the element (lines too) and takes the blend off the elements inside; one inside an element that blends cannot be set apart.',
  ].join(' ');

  private readonly input = new OperationInput({
    elements: z.array(z.string()).min(1).max(MAX_ELEMENTS).describe('The elements, as refs: segment:<id>, line:<id>, word:<id> or decoration:<id>.'),
    behindPerson: z.enum(MODES).optional().describe('"on", "off", or "auto" (back to what the template does).'),
    blendWithVideo: z.boolean().optional(),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly scenes: CaptionSceneLocator,
    private readonly ancestors: CaptionAncestorLocator,
    private readonly parser: EditorRefParser,
    private readonly store: EditorStore,
    private readonly setBehindActorOverride: SetBehindActorOverrideAction,
    private readonly ensureSegmentMasks: EnsureSegmentMasksCachedAction,
    private readonly setBlend: SetElementBlendAction,
    private readonly gating: BehindActorGatingService,
    private readonly footageCoverage: FootageCoverage,
    private readonly media: MediaAssetStore,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { elements, ...asked } = checked.value;
    if (asked.behindPerson === undefined && asked.blendWithVideo === undefined) {
      return this.refused([{ severity: 'error', message: 'Name behindPerson, blendWithVideo or both.' }]);
    }
    const covers = asked.behindPerson === 'on' ? this.footageCovers() : [];
    const resolved = elements.map((ref) => this.placed(ref, asked, new Set(elements), covers));
    const problems = resolved.flatMap((each) => (each.ok ? [] : [each.problem]));
    if (problems.length > 0) return this.refused(problems);
    const placed = resolved.flatMap((each) => (each.ok ? [each.value] : []));

    const changed = new Set([
      ...(asked.behindPerson === undefined ? [] : this.writeBehindPerson(placed, asked.behindPerson)),
      ...(asked.blendWithVideo === undefined ? [] : this.writeBlend(placed, asked.blendWithVideo)),
    ]);
    const output = { changed: elements.filter((ref) => changed.has(ref)) };
    if (asked.behindPerson !== 'on') return { ok: true, output, problems: [] };
    const ready = await this.computeCutouts(placed);
    return {
      ok: true,
      output: { ...output, cutout: ready ? 'ready' : 'still computing' },
      problems: ready ? [] : [{
        severity: 'warning',
        message: 'The person cutout is still being computed, so frames pictured now do not show the captions behind the person yet. Wait, and look again before saying how it looks.',
      }],
    };
  }

  private placed(ref: string, asked: EffectsAsked, named: ReadonlySet<string>, covers: ReadonlyArray<FootageCover>): ResolvedRef<PlacedElement> {
    const resolved = this.captions.resolve(ref, asked.behindPerson === undefined ? BLEND_KINDS : BEHIND_PERSON_KINDS);
    if (!resolved.ok) return resolved;
    const element = resolved.value;
    const document = this.store.snapshot().document;
    const scene = document === null ? null : this.scenes.sceneOf(document, element.kind, element.id);
    if (document === null || scene === null) return this.problem(ref, `${ref} is not painted under any sheet; read the transcript again.`);
    const placed = { element, scene: scene.segment, ancestors: this.ancestors.ancestorsOf(document, element.kind, element.id) };
    if (asked.behindPerson !== undefined) {
      const refused = this.behindPersonRefusal(placed, scene.sheetId, asked.behindPerson);
      if (refused !== null) return this.problem(ref, refused);
    }
    if (asked.behindPerson === 'on') {
      const covered = this.coveredRefusal(placed, covers);
      if (covered !== null) return this.problem(ref, covered);
    }
    if (asked.blendWithVideo === false) {
      const refused = this.blendRefusal(placed, named);
      if (refused !== null) return this.problem(ref, refused);
    }
    return { ok: true, value: placed };
  }

  /** Why the element's template does not let `mode` be set on it by hand, or null when it does. */
  private behindPersonRefusal({ element }: PlacedElement, sheetId: string, mode: BehindPersonMode): string | null {
    const sheet = this.store.sheet(sheetId);
    if (sheet === null) return `${element.ref} is not painted under any sheet; read the transcript again.`;
    const template = sheet.template;
    if (!template.features.behindActorOverride) {
      return `The template of this caption (${template.metadata.name}) does not let captions be put behind the person by hand.`;
    }
    if (mode === 'on' && element.kind !== 'segment' && template.rendering.videoFrame.required) {
      return `The template of this caption (${template.metadata.name}) paints the video inside its captions, so a single ${element.kind === 'word' ? 'word' : 'emoji'} cannot go behind the person; put the whole scene behind instead.`;
    }
    return null;
  }

  /** Where the shots' layers cover the video now. */
  private footageCovers(): ReadonlyArray<FootageCover> {
    const state = this.store.snapshot();
    return this.footageCoverage.covers({
      shots: state.shots,
      media: this.media.snapshot(),
      cuts: state.cuts,
      videoDurationSec: state.video.duration > 0 ? state.video.duration : null,
    });
  }

  /**
   * Why the element's scene cannot go behind the person because a shot
   * layer shows over it, naming every such layer, its shot and the
   * stretch of the scene it covers; null when none does.
   */
  private coveredRefusal({ element, scene }: PlacedElement, covers: ReadonlyArray<FootageCover>): string | null {
    const over = this.gating.coversOver(scene, covers);
    if (over.length === 0) return null;
    const sceneText = `${this.parser.formatOf('segment', scene.id)} (${this.seconds(scene.time.start)}–${this.seconds(scene.time.end)} s)`;
    const subject = element.kind === 'segment' ? sceneText : `${element.ref}, in ${sceneText},`;
    const layers = over.map((cover) => this.coverText(cover)).join('; ');
    return `${subject} cannot go behind the person: ${layers}. `
      + 'Nothing in a scene goes behind the person while a layer shows over any of it, however briefly. '
      + 'Make the scene and the layer stop overlapping, then ask again.';
  }

  private coverText({ layerId, range }: FootageCover): string {
    const holder = this.store.snapshot().shots.runOf(layerId)[0];
    const layer = holder?.layers.find((held) => held.id === layerId);
    const what = layer !== undefined && 'graphic' in layer ? 'a graphic' : 'a b-roll, picture or GIF';
    const ofShot = holder === undefined ? '' : ` of ${this.parser.formatOf('shot', holder.id)}`;
    return `${this.parser.formatOf('layer', layerId)} (${what}${ofShot}) shows over ${this.seconds(range.start)}–${this.seconds(range.end)} s of the scene`
      + ` (${this.seconds(range.end - range.start)} s)`;
  }

  private seconds(value: number): string {
    return value.toFixed(2);
  }

  /**
   * Why the element cannot stop blending, or null when it can: an
   * element around it blends, and the call does not take that one off
   * too.
   */
  private blendRefusal({ element, ancestors }: PlacedElement, named: ReadonlySet<string>): string | null {
    const blending = this.blendingAncestor(ancestors, (ref) => !named.has(ref));
    if (blending === null) return null;
    return `${element.ref} sits in ${blending}, which blends with the video, so it blends too; take the blend off ${blending} instead.`;
  }

  /** The ref of the nearest node around the element that blends and that `counts`, or null. */
  private blendingAncestor(ancestors: ReadonlyArray<CaptionAncestor>, counts: (ref: string) => boolean = () => true): string | null {
    const styles = this.store.snapshot().elementStyles;
    for (const ancestor of ancestors) {
      const ref = this.parser.formatOf(ancestor.kind, ancestor.id);
      if (styles.blendOf(ancestor.id) !== null && counts(ref)) return ref;
    }
    return null;
  }

  /** Records `mode` on every element; answers the refs whose record changed. */
  private writeBehindPerson(placed: ReadonlyArray<PlacedElement>, mode: BehindPersonMode): string[] {
    const changed: string[] = [];
    for (const { element } of placed) {
      const override = this.overrideFor(element, mode);
      if (this.store.snapshot().behindActorOverrides.get(element.id) === override) continue;
      this.setBehindActorOverride.execute(element.id, override);
      changed.push(element.ref);
    }
    return changed;
  }

  /**
   * What the mode records for the element. A word or an emoji has no
   * template deciding for it, so off is the same as leaving it to one.
   */
  private overrideFor(element: CaptionElement, mode: BehindPersonMode): BehindActorOverride {
    if (mode === 'on') return 'force-on';
    if (mode === 'off' && element.kind === 'segment') return 'force-off';
    return 'auto';
  }

  /**
   * Turns the blend on or off on every element, outermost first, so an
   * element inside another the call blends is left to it. Answers the
   * refs whose blend changed.
   */
  private writeBlend(placed: ReadonlyArray<PlacedElement>, blends: boolean): string[] {
    const changed: string[] = [];
    const outermostFirst = [...placed].sort((left, right) => left.ancestors.length - right.ancestors.length);
    for (const { element, ancestors } of outermostFirst) {
      const blending = this.store.snapshot().elementStyles.blendOf(element.id) !== null;
      if (blends === blending) continue;
      if (blends && this.blendingAncestor(ancestors) !== null) continue;
      if (blends) this.setBlend.execute(element.id, element.kind, 'difference');
      else this.setBlend.clear(element.id, element.kind);
      changed.push(element.ref);
    }
    return changed;
  }

  /**
   * Measures the person over each scene once (a word or an emoji behind
   * the person is painted for its whole scene, so the cutout covers the
   * scene) and waits for it, up to the wait limit. Answers whether every
   * cutout is ready; one still running carries on and lands later.
   */
  private async computeCutouts(placed: ReadonlyArray<PlacedElement>): Promise<boolean> {
    const scenes = [...new Map(placed.map(({ scene }) => [scene.id, scene])).values()];
    const computing = Promise.all(scenes.map((scene) => this.ensureSegmentMasks
      .execute({ segmentId: scene.id, range: { start: scene.time.start, end: scene.time.end } })
      .then(() => true, (error: unknown) => {
        console.error('[behind-person] computing the person cutout failed', error);
        return false;
      })));
    const outcome = await Promise.race([computing, this.timeout()]);
    return outcome !== 'timed-out' && outcome.every(Boolean);
  }

  private timeout(): Promise<'timed-out'> {
    return new Promise((resolve) => setTimeout(() => resolve('timed-out'), CUTOUT_WAIT_MS));
  }

  private problem(ref: string, message: string): ResolvedRef<PlacedElement> {
    return { ok: false, problem: { severity: 'error', message, ref } };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
