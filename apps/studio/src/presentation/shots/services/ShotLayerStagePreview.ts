import {
  CssClass,
  DataAttribute,
  type FootageStyle,
} from '@tscaps/engine';
import {
  type FootageStageBaselineCss,
} from '@tscaps/engine/advanced';

const PICTURE_CLASS = 'shot-layer-picture';

/**
 * Shows one layer of a stylesheet inside an element of the page: the
 * engine's stage, the stylesheet, and the layer's box carrying its
 * picture, scaled down to the element's size — a stage of its own,
 * written with the engine's rules, so the box looks as the engine
 * resolves it.
 *
 * Mounted in a shadow root of that element, so nothing the app styles
 * reaches the box and none of the stylesheet's rules or keyframes reach
 * the app. The box is drawn at rest: its motion is frozen, and with no
 * clock set on it, none of it plays.
 */
export class ShotLayerStagePreview {
  constructor(private readonly baseline: FootageStageBaselineCss) {}

  /**
   * Draws the box of `layerId` styled by `style` in `host`, scaled by
   * `scale`, with `poster` (a URL, or null for none) filling it the way
   * its fit says.
   */
  render(host: HTMLElement, style: FootageStyle, layerId: string, poster: string | null, scale: number): void {
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const sheet = document.createElement('style');
    sheet.textContent = [
      this.baseline.compose(style.frameWidth, style.frameHeight, 'frozen'),
      style.css,
      `.${PICTURE_CLASS} { display: block; width: 100%; height: 100%; object-fit: inherit; }`,
    ].join('\n');
    const scaler = document.createElement('div');
    scaler.style.cssText = `transform: scale(${scale}); transform-origin: 0 0; width: ${style.frameWidth}px; height: ${style.frameHeight}px;`;
    const stage = document.createElement('div');
    stage.className = CssClass.FOOTAGE_STAGE;
    stage.appendChild(this.boxOf(layerId, poster));
    scaler.appendChild(stage);
    root.replaceChildren(sheet, scaler);
  }

  private boxOf(layerId: string, poster: string | null): HTMLElement {
    const box = document.createElement('div');
    box.className = CssClass.FOOTAGE_LAYER;
    box.setAttribute(DataAttribute.ELEMENT_ID, layerId);
    if (poster !== null) {
      const picture = document.createElement('img');
      picture.className = PICTURE_CLASS;
      picture.src = poster;
      picture.alt = '';
      picture.draggable = false;
      box.appendChild(picture);
    } else {
      box.style.background = 'currentColor';
    }
    return box;
  }
}
