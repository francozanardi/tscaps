import { getFirstEncodableAudioCodec } from 'mediabunny';
import type {
  AudioTrackBridge,
} from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type {
  AudioTrackBridgeFactory,
  AudioTrackBridgeRequest,
} from '@modules/video/mediabunny/audio/AudioTrackBridgeFactory';
import { PassthroughAudioTrackBridge } from '@modules/video/mediabunny/audio/PassthroughAudioTrackBridge';
import { TranscodeAudioTrackBridge } from '@modules/video/mediabunny/audio/TranscodeAudioTrackBridge';
import { DiscardAudioTrackBridge } from '@modules/video/mediabunny/audio/DiscardAudioTrackBridge';

/**
 * Decides whether to copy the input audio packets verbatim, transcode
 * them into a codec the output container accepts, or — only when neither
 * path is possible — drop audio altogether.
 */
export class DefaultAudioTrackBridgeFactory implements AudioTrackBridgeFactory {

  async create(request: AudioTrackBridgeRequest): Promise<AudioTrackBridge> {
    const track = await request.input.getPrimaryAudioTrack();
    if (!track) return new DiscardAudioTrackBridge();
    const codec = await track.getCodec();
    if (!codec) {
      request.onAudioDiscarded?.('unknown-source-codec');
      return new DiscardAudioTrackBridge();
    }
    const supportedCodecs = request.format.getSupportedAudioCodecs();
    if (supportedCodecs.includes(codec)) {
      return new PassthroughAudioTrackBridge({ inputTrack: track, codec, timeMap: request.timeMap });
    }
    const transcodeTarget = await getFirstEncodableAudioCodec(supportedCodecs);
    if (transcodeTarget) {
      return new TranscodeAudioTrackBridge({ inputTrack: track, codec: transcodeTarget, timeMap: request.timeMap });
    }
    request.onAudioDiscarded?.('no-encodable-target-codec');
    return new DiscardAudioTrackBridge();
  }
}
