/**
 * What a layer is for in its shot, decided by its file's type: `video`
 * is the b-roll, footage beneath everything else the shot draws;
 * `picture` is a picture or a GIF on top. A new layer of a role starts
 * where the last edited layer of that role was left.
 */
export type ShotLayerRole = 'video' | 'picture';
