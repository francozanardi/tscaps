import { CssClass } from '@modules/document/CssClass';
import { DataAttribute } from '@modules/document/DataAttribute';
import type { FootageLayer } from '@modules/video/FootageLayer';
import { FootageLayerSchedule } from '@modules/video/FootageLayerSchedule';
import type { FootageStyle } from '@modules/video/FootageStyle';
import { CssFootageStageProbe } from '@modules/video/stage/CssFootageStageProbe';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import type { FootageLayerClock, FootageLayerClockChange } from '@modules/video/stage/FootageLayerClock';
import type { FootageLayerResolver, ResolvedFootageLayer } from '@modules/video/stage/FootageLayerResolver';
import type { FootageLayerStateReader } from '@modules/video/stage/FootageLayerStateReader';
import type { FootageStageBaselineCss } from '@modules/video/stage/FootageStageBaselineCss';
import type { FootageStageProbe } from '@modules/video/stage/FootageStageProbe';

// Two times closer than a tenth of a millisecond, far under a frame, are one moment.
const MOMENTS_PER_SEC = 10_000;
// How many moments are answered again without resolving: the latest
// few, which is what several readers of one frame ask for.
const REMEMBERED_MOMENTS = 4;
const NOTHING: ReadonlyArray<ResolvedFootageLayer> = [];

/**
 * {@link FootageLayerResolver} that keeps the stage in the document, out
 * of sight, and asks the browser.
 *
 * The stage lives in a shadow root of a hidden element of its own, so
 * nothing the page styles reaches a box and none of the stylesheet's
 * rules or keyframes reach the page. It is rendered — invisible, not
 * `display: none` — because an element that is not rendered runs no
 * animation and has no layout to read. It is put in the document on the
 * first ask, not before.
 *
 * Per moment: each active layer's box is set to the moment by the
 * clock given, then every active box the clock moved is read back; a
 * box it left still keeps the state last read off it. The answer is
 * remembered for the latest few moments, keyed by the moment to a tenth
 * of a millisecond: a time that went through a conversion and came back
 * a rounding error away is the same moment, and what was resolved for
 * one moment is never answered for another. The stylesheet cannot
 * change under a resolver bound to it.
 */
export class CssFootageLayerResolver implements FootageLayerResolver {
  private readonly schedule: FootageLayerSchedule;
  private readonly boxes = new Map<string, HTMLElement>();
  private readonly answers = new Map<number, ReadonlyArray<ResolvedFootageLayer>>();
  // By box: the state last read off it, which stands while the clock leaves the box still.
  private readonly statesRead = new Map<HTMLElement, FootageLayerFrameState>();
  private host: HTMLElement | null = null;
  private probe: FootageStageProbe | null = null;
  private disposed = false;

  constructor(
    private readonly layers: ReadonlyArray<FootageLayer>,
    private readonly style: FootageStyle,
    private readonly reader: FootageLayerStateReader,
    private readonly baseline: FootageStageBaselineCss,
    private readonly clock: FootageLayerClock,
  ) {
    this.schedule = new FootageLayerSchedule(layers);
  }

  resolveAt(outputSec: number): ReadonlyArray<ResolvedFootageLayer> {
    if (this.disposed) return NOTHING;
    const moment = Math.round(outputSec * MOMENTS_PER_SEC);
    const remembered = this.answers.get(moment);
    if (remembered !== undefined) return remembered;
    const answer = this.resolve(outputSec);
    this.remember(moment, answer);
    return answer;
  }

  dispose(): void {
    this.disposed = true;
    this.host?.remove();
    this.host = null;
    this.probe = null;
    this.boxes.clear();
    this.answers.clear();
    this.statesRead.clear();
  }

  private resolve(outputSec: number): ReadonlyArray<ResolvedFootageLayer> {
    const active = this.schedule.layersAt(outputSec);
    if (active.length === 0) return NOTHING;
    this.mount();
    const boxes = active.map((layer) => this.boxes.get(layer.id)!);
    const changes = active.map((layer, index) => this.clock.set(boxes[index]!, layer, outputSec));
    return active.map((layer, index) => ({ layer, state: this.stateOf(boxes[index]!, changes[index]!) }));
  }

  /** The state `box` is in: the one last read off it where the clock left it still, read afresh otherwise. */
  private stateOf(box: HTMLElement, change: FootageLayerClockChange): FootageLayerFrameState {
    const held = this.statesRead.get(box);
    if (change === 'still' && held !== undefined) return held;
    const state = this.reader.read(box, this.probe!, this.style.frameWidth, this.style.frameHeight);
    this.statesRead.set(box, state);
    return state;
  }

  private remember(moment: number, answer: ReadonlyArray<ResolvedFootageLayer>): void {
    this.answers.set(moment, answer);
    if (this.answers.size <= REMEMBERED_MOMENTS) return;
    this.answers.delete(this.answers.keys().next().value!);
  }

  /** Puts the stage in the document, with a box for every layer, once. */
  private mount(): void {
    if (this.host !== null) return;
    const host = document.createElement('div');
    host.style.cssText = 'position: fixed; left: 0; top: 0; width: 0; height: 0; overflow: hidden; '
      + 'visibility: hidden; pointer-events: none; contain: strict; z-index: -1;';
    const root = host.attachShadow({ mode: 'open' });
    const sheet = document.createElement('style');
    sheet.textContent = `${this.baseline.compose(this.style.frameWidth, this.style.frameHeight, 'frozen')}\n${this.style.css}`;
    const stage = document.createElement('div');
    stage.className = CssClass.FOOTAGE_STAGE;
    const probe = document.createElement('div');
    probe.style.cssText = 'position: absolute; visibility: hidden;';
    stage.appendChild(probe);
    this.addBoxes(stage);
    root.append(sheet, stage);
    document.body.appendChild(host);
    this.host = host;
    this.probe = new CssFootageStageProbe(probe);
  }

  /** One box per layer id, in the order the layers are given, which is the order they are drawn in. */
  private addBoxes(stage: HTMLElement): void {
    for (const layer of this.layers) {
      if (this.boxes.has(layer.id)) continue;
      const box = document.createElement('div');
      box.className = layer.source.kind === 'source-picture'
        ? `${CssClass.FOOTAGE_LAYER} ${CssClass.FOOTAGE_SOURCE_PICTURE}`
        : CssClass.FOOTAGE_LAYER;
      box.setAttribute(DataAttribute.ELEMENT_ID, layer.id);
      stage.appendChild(box);
      this.boxes.set(layer.id, box);
    }
  }
}
