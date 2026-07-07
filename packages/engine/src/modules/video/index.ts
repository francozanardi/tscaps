export type { VideoRenderer } from '@modules/video/VideoRenderer';
export type {
  RenderJob,
  RenderResult,
  RenderProgress,
  RenderOutputChunk,
  OutputFormat,
  RenderQuality,
  AudioDiscardReason,
  FallbackDecoderInfo,
} from '@modules/video/RenderJob';

export { MediaBunnyVideoRenderer } from '@modules/video/mediabunny/MediaBunnyVideoRenderer';
export type { MediaBunnyVideoRendererConfig } from '@modules/video/mediabunny/MediaBunnyVideoRenderer';

export { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
export type {
  MediaBunnyTranscodeCoordinatorConfig,
  MediaBunnyTranscodeRequest,
  MediaBunnyTranscodeResult,
} from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';

export type { FramePainter } from '@modules/video/mediabunny/painter/FramePainter';
export { CaptionsOverlayFramePainter } from '@modules/video/mediabunny/painter/CaptionsOverlayFramePainter';
export { CaptionsOverlayFramePainterFactory } from '@modules/video/mediabunny/painter/CaptionsOverlayFramePainterFactory';

export { RenderTimeMap } from '@modules/video/RenderTimeMap';

export type {
  CodecPolicy,
  VideoCodecResolution,
  VideoCodecResolutionRequest,
} from '@modules/video/mediabunny/codec/CodecPolicy';
export { DefaultCodecPolicy } from '@modules/video/mediabunny/codec/DefaultCodecPolicy';

export type {
  VideoFrameDecoder,
  DecodedVideoFrame,
} from '@modules/video/mediabunny/frame/VideoFrameDecoder';
export type {
  VideoFrameDecoderFactory,
  VideoFrameDecoderRequest,
} from '@modules/video/mediabunny/frame/VideoFrameDecoderFactory';
export { DefaultVideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/DefaultVideoFrameDecoderFactory';
export { WebCodecsVideoFrameDecoder } from '@modules/video/mediabunny/frame/WebCodecsVideoFrameDecoder';
export { HtmlVideoElementVideoFrameDecoder } from '@modules/video/mediabunny/frame/HtmlVideoElementVideoFrameDecoder';

export type { VideoTrackEncoder, PaintFrame } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
export type {
  VideoTrackEncoderFactory,
  VideoTrackEncoderFactoryRequest,
} from '@modules/video/mediabunny/encoder/VideoTrackEncoderFactory';
export {
  MediaBunnyCanvasVideoTrackEncoder,
} from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoder';
export type {
  MediaBunnyCanvasVideoTrackEncoderConfig,
} from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoder';
export {
  MediaBunnyCanvasVideoTrackEncoderFactory,
} from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoderFactory';

export type { FrameCompositor } from '@modules/video/mediabunny/frame/FrameCompositor';
export { LayeredFrameCompositor } from '@modules/video/mediabunny/frame/LayeredFrameCompositor';

export type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
export { BatchedSubtitleLayerSource } from '@modules/video/mediabunny/caption/BatchedSubtitleLayerSource';
export { VideoBoundSubtitleLayerSource } from '@modules/video/mediabunny/caption/VideoBoundSubtitleLayerSource';
export { ComposedSubtitleLayerSource } from '@modules/video/mediabunny/caption/ComposedSubtitleLayerSource';

export type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
export type {
  AudioTrackBridgeFactory,
  AudioTrackBridgeRequest,
} from '@modules/video/mediabunny/audio/AudioTrackBridgeFactory';
export { DefaultAudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/DefaultAudioTrackBridgeFactory';
export { PassthroughAudioTrackBridge } from '@modules/video/mediabunny/audio/PassthroughAudioTrackBridge';
export type {
  PassthroughAudioTrackBridgeConfig,
} from '@modules/video/mediabunny/audio/PassthroughAudioTrackBridge';
export { TranscodeAudioTrackBridge } from '@modules/video/mediabunny/audio/TranscodeAudioTrackBridge';
export type {
  TranscodeAudioTrackBridgeConfig,
} from '@modules/video/mediabunny/audio/TranscodeAudioTrackBridge';
export { DiscardAudioTrackBridge } from '@modules/video/mediabunny/audio/DiscardAudioTrackBridge';

export type {
  OutputTargetBuilder,
  OutputTargetBuildRequest,
  OutputTargetBuildResult,
} from '@modules/video/mediabunny/output/OutputTargetBuilder';
export { MediaBunnyOutputTargetBuilder } from '@modules/video/mediabunny/output/MediaBunnyOutputTargetBuilder';
