import { Mp4OutputFormat, WebMOutputFormat } from 'mediabunny';
import { type OutputFormat } from '@tscaps/engine';
import { MixingAudioTrackBridge, type AudioMixCodecSelector } from '@tscaps/engine/advanced';
import type { AudioMixEncodeSupport } from '@core/export/domain/AudioMixEncodeSupport';

/**
 * mediabunny-backed implementation of {@link AudioMixEncodeSupport}. Asks
 * the engine's own codec selector, over the codecs the export's
 * container holds, the question the render asks once it starts.
 *
 * Asked for two channels at 48 kHz, the shape a mix takes over a video
 * with no sound, because the video's own shape is not known before the
 * run. The browsers measured answer alike for 44.1 and 48 kHz, so the
 * answer holds for the usual videos. Each format is asked once.
 */
export class MediaBunnyAudioMixEncodeSupport implements AudioMixEncodeSupport {
  private readonly answers = new Map<OutputFormat, Promise<string | null>>();

  constructor(private readonly selector: AudioMixCodecSelector) {}

  codecFor(format: OutputFormat): Promise<string | null> {
    let answer = this.answers.get(format);
    if (!answer) {
      answer = this.ask(format);
      this.answers.set(format, answer);
    }
    return answer;
  }

  private ask(format: OutputFormat): Promise<string | null> {
    const container = format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
    return this.selector.select(container.getSupportedAudioCodecs(), MixingAudioTrackBridge.SHAPE_WITHOUT_INPUT);
  }
}
