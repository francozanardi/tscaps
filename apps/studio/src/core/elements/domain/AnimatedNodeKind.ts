import { CAPTION_NODE_KINDS } from '@core/elements/domain/CaptionNodeKind';

/**
 * Every kind of node a library animation can be applied to: each node a
 * caption paints, and a layer a shot draws on the frame.
 *
 * What a primitive names as its `$element`. A template only ever names
 * a caption's; a layer's are named by the entrances and exits the
 * library compiles for layers.
 */
export const ANIMATED_NODE_KINDS = [...CAPTION_NODE_KINDS, 'layer'] as const;

export type AnimatedNodeKind = (typeof ANIMATED_NODE_KINDS)[number];
