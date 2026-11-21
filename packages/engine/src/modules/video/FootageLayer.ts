import type { FootagePictureProvider } from '@modules/video/provided/FootagePictureProvider';

/** A source read from a file: a video, a still image or a GIF. */
export interface FileFootageSource {
  readonly kind: 'video' | 'image' | 'gif';
  readonly blob: Blob;
}

/**
 * The source's own picture: the frame of the output being drawn, with
 * no file of its own. A layer showing it draws that frame in its box,
 * which is how the source's picture is placed, cropped, moved or faded
 * over a stretch. It has no moments of its own to play.
 */
export interface FootageSourcePicture {
  readonly kind: 'source-picture';
}

/**
 * The frame as drawn beneath the layer — the source's picture and every
 * layer below — which the layer takes up and draws again, in its own
 * state, over its background colour, black where it has none.
 */
export interface FootageBackdrop {
  readonly kind: 'backdrop';
}

/**
 * Pictures no file holds, drawn by the caller for each moment of the
 * stretch and handed over by `provider`. They may hold transparency.
 */
export interface ProvidedFootageSource {
  readonly kind: 'provided';
  readonly provider: FootagePictureProvider;
}

/**
 * What a layer shows: a video, which plays with the output; a still
 * image, held for the whole stretch; a GIF, which plays its frames at
 * their own pace from the start of the stretch and starts over each
 * time it runs out, for as long as the stretch lasts; the source's own
 * picture; the backdrop; or pictures the caller provides, one for each
 * moment of the stretch.
 */
export type FootageSource = FileFootageSource | FootageSourcePicture | FootageBackdrop | ProvidedFootageSource;

/**
 * A stretch of the output over which footage is drawn on the frame. The source's audio is untouched.
 *
 * Timing: over `[outputStartSec, outputEndSec)` a video plays from
 * `sourceStartSec`, starting over from there every `sourcePassSec`;
 * `Infinity` plays straight through. An image, the source's own picture
 * and the backdrop ignore both; a GIF plays from `sourceStartSec` of its
 * own timeline and ignores the pass, looping by its own length instead.
 * Output time is the output timeline, after any skipped ranges have
 * collapsed.
 *
 * Where and how it is drawn is not held here: a `FootageStyle` says it
 * in CSS, and `id` is the name its stylesheet addresses the layer's box
 * by. Layers active at one moment are drawn bottom to top in the order
 * they are given.
 */
export interface FootageLayer {
  readonly id: string;
  readonly source: FootageSource;
  readonly outputStartSec: number;
  readonly outputEndSec: number;
  readonly sourceStartSec: number;
  readonly sourcePassSec: number;
}
