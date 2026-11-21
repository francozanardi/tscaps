import { getFirstEncodableAudioCodec, type InputAudioTrack } from 'mediabunny';
import type {
  AudioTrackBridge,
} from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type {
  AudioTrackBridgeFactory,
  AudioTrackBridgeRequest,
} from '@modules/video/mediabunny/audio/AudioTrackBridgeFactory';
import type { AudioLayerDecoder } from '@modules/video/mediabunny/audio/AudioLayerDecoder';
import type {
  AudioMixCodecSelector,
  AudioMixEncodingShape,
} from '@modules/video/mediabunny/audio/AudioMixCodecSelector';
import type { RenderAudioMix } from '@modules/video/RenderJob';
import { PassthroughAudioTrackBridge } from '@modules/video/mediabunny/audio/PassthroughAudioTrackBridge';
import { TranscodeAudioTrackBridge } from '@modules/video/mediabunny/audio/TranscodeAudioTrackBridge';
import { DiscardAudioTrackBridge } from '@modules/video/mediabunny/audio/DiscardAudioTrackBridge';
import { MixingAudioTrackBridge } from '@modules/video/mediabunny/audio/MixingAudioTrackBridge';
import { FallbackAudioTrackBridge } from '@modules/video/mediabunny/audio/FallbackAudioTrackBridge';
import type { AudioTrackSampleDecoder } from '@modules/audio-decoding/AudioTrackSampleDecoder';

/**
 * Without a mix to write, decides whether to copy the input audio
 * packets verbatim, transcode them into a codec the output container
 * accepts, or drop audio altogether — when the request does not want
 * it, or when neither path is possible.
 *
 * With a mix that has layers, mixes them with the input's audio into a
 * newly encoded track, in the codec `mixCodecs` picks. So it does with a
 * mix that has none but changes the level of the input's audio, all
 * along or over some stretches, when that audio is wanted and there is
 * some: a mix that neither adds a layer nor changes that level is no
 * mix at all, and the input's audio
 * is bridged exactly as without one. When mixing cannot be done without
 * losing the input's audio — no codec is encodable, or the input's audio
 * cannot be decoded — the mix is reported dropped and the input's audio
 * is bridged as if there were no mix. That includes audio the browser
 * says it decodes and then fails on through WebCodecs and through
 * `inputFallbackDecoder` both, found before anything is written.
 */
export class DefaultAudioTrackBridgeFactory implements AudioTrackBridgeFactory {

  constructor(
    private readonly layerDecoder: AudioLayerDecoder,
    private readonly mixCodecs: AudioMixCodecSelector,
    private readonly inputFallbackDecoder: AudioTrackSampleDecoder,
  ) {}

  async create(request: AudioTrackBridgeRequest): Promise<AudioTrackBridge> {
    if (request.mix && this.changesTheAudio(request.mix, request.wanted)) return this.createMixing(request, request.mix);
    return this.createForInputAudio(request);
  }

  private changesTheAudio(mix: RenderAudioMix, inputWanted: boolean): boolean {
    return mix.layers.length > 0 || (inputWanted && (mix.inputGain !== 1 || (mix.inputDucks ?? []).some((duck) => duck.ranges.length > 0)));
  }

  private async createMixing(request: AudioTrackBridgeRequest, mix: RenderAudioMix): Promise<AudioTrackBridge> {
    const wantedTrack = request.wanted ? await request.input.getPrimaryAudioTrack() : null;
    const inputTrack = wantedTrack && (await wantedTrack.getCodec()) ? wantedTrack : null;
    // Only the input's level was to change, and there is no input audio it could be heard on.
    if (mix.layers.length === 0 && !inputTrack) return this.createForInputAudio(request);
    if (inputTrack && !(await inputTrack.canDecode())) {
      request.onAudioMixDropped?.('undecodable-input-audio');
      return this.createForInputAudio(request);
    }
    const codec = await this.mixCodecs.select(request.format.getSupportedAudioCodecs(), this.mixShapeFor(inputTrack));
    if (!codec) {
      request.onAudioMixDropped?.('no-encodable-target-codec');
      return this.createForInputAudio(request);
    }
    // Lost exactly as it would be without a mix; the layers are written alone.
    if (wantedTrack && !inputTrack) request.onAudioDiscarded?.('unknown-source-codec');
    const mixing = new MixingAudioTrackBridge({
      inputTrack,
      inputSource: request.source,
      inputFallbackDecoder: this.inputFallbackDecoder,
      mix,
      codec,
      timeMap: request.timeMap,
      outputDurationSec: request.outputDurationSec,
      decoder: this.layerDecoder,
      ...(request.onInputAudioFallback ? { onInputAudioFallback: request.onInputAudioFallback } : {}),
      ...(request.confirmUndecodableLayers ? { confirmUndecodableLayers: request.confirmUndecodableLayers } : {}),
    });
    if (!inputTrack) return mixing;
    // Said to decode, the input's audio failed on every path: the sounds go, the voice stays.
    return new FallbackAudioTrackBridge(mixing, async () => {
      request.onAudioMixDropped?.('undecodable-input-audio');
      return this.createForInputAudio(request);
    });
  }

  private mixShapeFor(inputTrack: InputAudioTrack | null): AudioMixEncodingShape {
    const maxChannels = MixingAudioTrackBridge.MAX_CHANNELS;
    if (!inputTrack) return MixingAudioTrackBridge.SHAPE_WITHOUT_INPUT;
    return { sampleRate: inputTrack.sampleRate, numberOfChannels: Math.min(inputTrack.numberOfChannels, maxChannels) };
  }

  private async createForInputAudio(request: AudioTrackBridgeRequest): Promise<AudioTrackBridge> {
    if (!request.wanted) return new DiscardAudioTrackBridge();
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
