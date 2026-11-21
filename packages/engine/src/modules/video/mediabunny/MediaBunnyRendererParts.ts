import type { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
import type { AudioMixCodecSelector } from '@modules/video/mediabunny/audio/AudioMixCodecSelector';
import type { FootageGrader } from '@modules/video/grade/FootageGrader';
import type { FootageLayerResolverFactory } from '@modules/video/stage/FootageLayerResolverFactory';
import type { FootageStageBaselineCss } from '@modules/video/stage/FootageStageBaselineCss';

/**
 * Parts `MediaBunnyRenderers` built that a caller may share rather than
 * build again: each is the one its renderers use.
 */
export interface MediaBunnyRendererParts {
  /** Decodes, paints and encodes a video; the renderers run every render through it. */
  readonly transcodeCoordinator: MediaBunnyTranscodeCoordinator;
  /** Which codec a render's audio mix is encoded in, asked before the render as well as during it. */
  readonly audioMixCodecs: AudioMixCodecSelector;
  /** Resolves footage layers' stylesheets, each resolver on a stage of its own. */
  readonly footageResolvers: FootageLayerResolverFactory;
  /** The stage's own rules, which the resolvers lay footage out under. */
  readonly footageStageBaseline: FootageStageBaselineCss;
  /** Grades the composed picture; it holds one WebGL2 context, opened on first use. */
  readonly footageGrader: FootageGrader;
}
