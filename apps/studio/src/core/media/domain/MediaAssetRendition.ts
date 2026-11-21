/**
 * Which copy of an asset: the file as it was added, which the export
 * burns, or the proxy the editor previews a video through — small
 * enough to decode beside the project's own video. An image has no
 * proxy; it is previewed from its original.
 */
export type MediaAssetRendition = 'original' | 'proxy';
