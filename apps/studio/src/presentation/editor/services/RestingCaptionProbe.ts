import type { Document as CaptionDocument, Segment, SegmentProbeMarkupInput, TextDirection } from '@tscaps/engine';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';
import { RestingElementStyle } from '@presentation/editor/services/RestingElementStyle';

/** The box the captions on screen are laid out in, and the gestures that reshape them. */
export interface CaptionProbeHost {
  /** The box, while there is one. */
  scaler(): HTMLElement | null;
  /** Whether a gesture is reshaping the captions right now. */
  isSessionActive(): boolean;
  /** Calls back whenever either answer above may have changed. */
  subscribe(callback: () => void): () => void;
}

/**
 * What the overlay paints captions from, beyond the sheet each one
 * belongs to.
 */
export interface CaptionPaintState {
  /** The document as painted, with the words a cut removed already gone. */
  readonly document: CaptionDocument;
  /** Where the elements sit: a word given a placement is painted alone, out of its line. */
  readonly elementStyles: ElementStyles;
  /** Captions the text-behind-actor effect holds whole. */
  readonly behindActorSegmentIds: ReadonlySet<string>;
  /** Words and glyphs behind the actor inside a caption that is not. */
  readonly behindActorElementIds: ReadonlySet<string>;
}

/** One caption as the overlay paints it, with what the overlay dresses it in. */
export interface RestingCaption {
  readonly segment: Segment;
  /** Its position among the captions of its sheet, published as `--segment-index`. */
  readonly segmentIndex: number;
  /** The class the sheet's stylesheet is scoped under. */
  readonly scopeClass: string;
  /** The custom properties the overlay declares on the caption's wrapper. */
  readonly wrapperStyles: Readonly<Record<string, string>>;
  readonly textDirection: TextDirection;
  readonly splitWordsIntoLetters: boolean;
  /** Whether the overlay paints a video frame layer first inside the caption. */
  readonly includeVideoFrameLayer: boolean;
  /** The classes the overlay adds to the caption's segment for the state it is in. */
  readonly segmentStateClasses: ReadonlyArray<string>;
  /** The caption's words the overlay paints alone at their own anchor. */
  readonly positionedWordIds: ReadonlySet<string>;
}

/** Finds the caption a word belongs to, dressed as the overlay dresses it. */
export interface RestingCaptionSource {
  /** `null` when `wordId` is not a word of any caption `sheet` owns in `state`'s document. */
  captionOf(state: CaptionPaintState, sheet: Sheet, wordId: string): RestingCaption | null;
}

/** Writes the markup the render paints a word in, every element carrying its id. */
export interface CaptionMarkupWriter {
  build(input: SegmentProbeMarkupInput, wordId: string): string;
}

/**
 * What a word resolves to at rest, asked of the browser.
 *
 * Mounts a copy of the word's caption inside the box the captions on
 * screen are laid out in, reads it and takes it out again before
 * anything can paint. The copy is the render's own markup, dressed with
 * what the overlay paints the caption from — the document as painted,
 * where its words sit, the state the caption is in — so it cannot
 * describe the caption differently from what is painted. Inside that
 * box the stylesheets already in the document apply to it exactly as
 * they apply to the caption on screen — the template, the sheet's edits
 * to it, and what every element was given, by a control or by hand —
 * and container units resolve against the same frame. Nothing here
 * builds or reads a stylesheet.
 *
 * The copy holds still: it is taken at the instant its caption has been
 * narrated through, which is the state templates paint in their main
 * colour, and no animation runs in it. So the answer does not depend on
 * where the playhead is, and since the copy is built from the document,
 * a word reads the same whether or not it is on screen.
 *
 * Read only after the document's stylesheets have been written for the
 * state being asked about: a read made while they are still being
 * written describes the state before.
 */
export class RestingCaptionProbe {
  constructor(
    private readonly host: CaptionProbeHost,
    private readonly captions: RestingCaptionSource,
    private readonly markup: CaptionMarkupWriter,
  ) {}

  /**
   * Whether a read taken now would be worth taking: there is a box to
   * mount in, and no gesture is reshaping the captions. A gesture writes
   * on every pointer move, and a read forces the browser to restyle, so
   * reading waits for it to end. Holds still between the calls of
   * {@link subscribe}.
   */
  canRead(): boolean {
    return this.host.scaler()?.isConnected === true && !this.host.isSessionActive();
  }

  /** Calls back whenever {@link canRead} may have changed its answer. */
  subscribe(callback: () => void): () => void {
    return this.host.subscribe(callback);
  }

  /**
   * The computed values of `properties` on the word and on the line it
   * sits in. `null` when there is no box to mount in or the word is not
   * one of `sheet`'s captions in `state`'s document.
   */
  read(
    state: CaptionPaintState,
    sheet: Sheet,
    wordId: string,
    properties: ReadonlyArray<string>,
  ): RestingElementStyle | null {
    const scaler = this.host.scaler();
    if (!scaler?.isConnected) return null;
    const caption = this.captions.captionOf(state, sheet, wordId);
    if (!caption) return null;
    const mount = this.mount(scaler, caption, wordId);
    try {
      const word = mount.querySelector<HTMLElement>(`[${CAPTION_ELEMENT_ID_ATTRIBUTE}="${CSS.escape(wordId)}"]`);
      const line = word?.parentElement;
      if (!word || !line) return null;
      return new RestingElementStyle(this.snapshot(word, properties), this.snapshot(line, properties));
    } finally {
      mount.remove();
    }
  }

  // Hidden and out of flow, so neither the captions nor the frame around
  // them move while the copy is in.
  private mount(scaler: HTMLElement, caption: RestingCaption, wordId: string): HTMLElement {
    const mount = scaler.ownerDocument.createElement('div');
    mount.setAttribute('aria-hidden', 'true');
    mount.style.cssText = 'position: absolute; inset: 0; visibility: hidden; pointer-events: none; overflow: hidden; contain: strict;';
    mount.innerHTML = this.markup.build({ ...caption, t: caption.segment.time.end }, wordId);
    this.stopAnimations(mount);
    scaler.appendChild(mount);
    return mount;
  }

  // An inline `!important` outranks every layer of every stylesheet, the
  // rule that freezes captions on a frame included.
  private stopAnimations(mount: HTMLElement): void {
    for (const element of mount.querySelectorAll<HTMLElement>('*')) {
      element.style.setProperty('animation', 'none', 'important');
    }
  }

  // Read while the copy is still in the document: a detached element's
  // computed style is empty.
  private snapshot(element: HTMLElement, properties: ReadonlyArray<string>): ReadonlyMap<string, string> {
    const computed = getComputedStyle(element);
    return new Map(properties.map((property) => [property, computed.getPropertyValue(property)]));
  }
}
