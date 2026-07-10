/**
 * Renderable representation of a project's dashboard thumbnail. The
 * value object hides whether the bytes live as a local `Blob` or
 * behind a fetchable URL, so the dashboard card renders both the same
 * way.
 *
 * - `blob`: held as an in-memory `Blob`; the consumer turns it into an
 *   object URL and revokes it when the source changes or the card
 *   unmounts.
 * - `url`: already a fetchable HTTPS URL; the consumer uses it
 *   directly. No lifecycle to manage on the client side.
 */
export type ProjectThumbnailSource =
  | { readonly kind: 'blob'; readonly blob: Blob }
  | { readonly kind: 'url'; readonly url: string };
