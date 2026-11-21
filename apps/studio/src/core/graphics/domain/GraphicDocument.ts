/**
 * What a graphic is made of: the HTML of its body, its CSS and its
 * JavaScript, as a person or a language model writes them. Plain text,
 * never run where it is held.
 */
export interface GraphicDocument {
  readonly html: string;
  readonly css: string;
  readonly js: string;
}
