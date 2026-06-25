import {
  EncodedAudioPacketSource,
  EncodedPacketSink,
  type AudioCodec,
  type EncodedPacket,
  type InputAudioTrack,
  type Output,
} from 'mediabunny';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type { RenderTimeMap } from '@modules/video/RenderTimeMap';

export interface PassthroughAudioTrackBridgeConfig {
  inputTrack: InputAudioTrack;
  codec: AudioCodec;
  timeMap: RenderTimeMap;
}

/**
 * Copies the input's encoded audio packets straight into the output
 * without decoding or re-encoding. The first packet carries the input's
 * decoder config so downstream consumers can decode the rest.
 *
 * Requires that the chosen output container can hold the input audio
 * codec; otherwise pick a different bridge or change the container.
 */
export class PassthroughAudioTrackBridge implements AudioTrackBridge {

  private readonly source: EncodedAudioPacketSource;
  private readonly sink: EncodedPacketSink;
  private nextPacket: EncodedPacket | null = null;
  private decoderConfig: AudioDecoderConfig | null = null;
  private firstPacketPending = true;

  constructor(private readonly config: PassthroughAudioTrackBridgeConfig) {
    this.source = new EncodedAudioPacketSource(config.codec);
    this.sink = new EncodedPacketSink(config.inputTrack);
  }

  async attachTo(output: Output): Promise<void> {
    output.addAudioTrack(this.source);
    this.nextPacket = await this.sink.getFirstPacket();
    this.decoderConfig = await this.config.inputTrack.getDecoderConfig();
  }

  async pumpUntil(videoTimestamp: number): Promise<void> {
    while (this.nextPacket && this.nextPacket.timestamp <= videoTimestamp) {
      await this.emit(this.nextPacket);
      this.nextPacket = await this.sink.getNextPacket(this.nextPacket);
    }
  }

  async finish(): Promise<void> {
    while (this.nextPacket) {
      await this.emit(this.nextPacket);
      this.nextPacket = await this.sink.getNextPacket(this.nextPacket);
    }
  }

  private async emit(packet: EncodedPacket): Promise<void> {
    // Packets before t=0 (timestamp offsets from container metadata) are
    // discarded — the output writer rejects negative timestamps.
    if (packet.timestamp < 0) return;
    const timeMap = this.config.timeMap;
    if (timeMap.isSkipped(packet.timestamp)) return;
    const outputPacket = timeMap.isEmpty()
      ? packet
      : packet.clone({ timestamp: timeMap.toOutputTime(packet.timestamp) });
    if (this.firstPacketPending && this.decoderConfig) {
      await this.source.add(outputPacket, { decoderConfig: this.decoderConfig });
      this.firstPacketPending = false;
      return;
    }
    await this.source.add(outputPacket);
  }
}
