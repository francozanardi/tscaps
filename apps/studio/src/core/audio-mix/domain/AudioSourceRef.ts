/** The file a clip plays: a media asset of the `audio` type, or a sound of the bundled pack, by stable id. */
export type AudioSourceRef =
  | { readonly kind: 'media'; readonly mediaId: string }
  | { readonly kind: 'builtin'; readonly soundId: string };
