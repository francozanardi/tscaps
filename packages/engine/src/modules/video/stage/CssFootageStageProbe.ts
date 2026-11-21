import type { FootageStagePixelRect, FootageStageProbe } from '@modules/video/stage/FootageStageProbe';

// How many answers are kept. A stage's lengths are a handful of values
// per box, the same every moment; only a length written off the clock
// brings a new value each time, and those push each other out.
const REMEMBERED_ANSWERS = 256;

/**
 * {@link FootageStageProbe} that writes each value on an element of the
 * stage and reads back what the browser computed for it.
 *
 * Every question costs the document a style pass, so each answer is
 * remembered by the value asked: the element sits on the stage, outside
 * every box, so nothing but the value written decides what it resolves
 * to. The most recently asked answers are the ones kept.
 */
export class CssFootageStageProbe implements FootageStageProbe {
  private readonly widths = new Map<string, number>();
  private readonly rects = new Map<string, FootageStagePixelRect>();

  /** `element` is positioned on the stage and drawn by nothing; its inline style is this probe's to write. */
  constructor(private readonly element: HTMLElement) {}

  width(value: string): number {
    const remembered = this.recall(this.widths, value);
    if (remembered !== undefined) return remembered;
    this.element.style.width = value;
    return this.remember(this.widths, value, this.pixels(window.getComputedStyle(this.element).width));
  }

  rect(left: string, top: string, width: string, height: string): FootageStagePixelRect {
    const asked = [left, top, width, height].join('\n');
    const remembered = this.recall(this.rects, asked);
    if (remembered !== undefined) return remembered;
    this.element.style.left = left;
    this.element.style.top = top;
    this.element.style.width = width;
    this.element.style.height = height;
    const resolved = window.getComputedStyle(this.element);
    return this.remember(this.rects, asked, {
      left: this.pixels(resolved.left),
      top: this.pixels(resolved.top),
      width: this.pixels(resolved.width),
      height: this.pixels(resolved.height),
    });
  }

  /** The answer kept for `asked`, moved to the most recent; undefined where none is kept. */
  private recall<Answer>(answers: Map<string, Answer>, asked: string): Answer | undefined {
    const answer = answers.get(asked);
    if (answer === undefined) return undefined;
    answers.delete(asked);
    answers.set(asked, answer);
    return answer;
  }

  private remember<Answer>(answers: Map<string, Answer>, asked: string, answer: Answer): Answer {
    answers.set(asked, answer);
    if (answers.size > REMEMBERED_ANSWERS) answers.delete(answers.keys().next().value!);
    return answer;
  }

  private pixels(value: string): number {
    const amount = parseFloat(value);
    return Number.isFinite(amount) ? amount : 0;
  }
}
