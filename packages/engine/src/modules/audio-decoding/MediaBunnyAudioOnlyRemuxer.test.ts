import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { MediaBunnyAudioOnlyRemuxer } from '@modules/audio-decoding/MediaBunnyAudioOnlyRemuxer';

/**
 * The remuxer's promise is a container a demuxer reads back as
 * audio-only, with the source's own codec and duration — so the
 * oracle is the demuxer, not the produced bytes. A packet copy needs
 * no codec, which is why this runs in plain Node with no WebCodecs
 * at all — the same capability gap the remuxer exists to cover.
 *
 * The fixture's AAC track starts slightly below zero (encoder
 * priming), which is the mainstream shape of real recordings — a
 * remux that only handles zero-based tracks fails here.
 */
const FIXTURE_DURATION_SECONDS = 1;

describe('MediaBunnyAudioOnlyRemuxer', () => {
  it('produces an audio-only container carrying the source AAC track verbatim', async () => {
    const bytes = await readFile(resolve(import.meta.dirname, 'fixtures/avc-aac-1s.mp4'));
    const source = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });

    const remuxed = await new MediaBunnyAudioOnlyRemuxer().remux(source);

    expect(remuxed.size).toBeGreaterThan(0);
    expect(remuxed.size).toBeLessThan(source.size);
    const input = new Input({ source: new BlobSource(remuxed), formats: ALL_FORMATS });
    try {
      expect(await input.getPrimaryVideoTrack()).toBeNull();
      const audioTrack = await input.getPrimaryAudioTrack();
      expect(audioTrack).not.toBeNull();
      expect(await audioTrack!.getCodec()).toBe('aac');
      expect(await audioTrack!.computeDuration()).toBeCloseTo(1, 1);
    } finally {
      input.dispose();
    }
  });

  /**
   * A segment has to stand on its own — the point of splitting is
   * that each one is decoded separately — and it has to reach past
   * the stretch it is trusted for, because a codec reconstructs the
   * frames at its edges from their neighbours.
   */
  it('splits the track into stand-alone segments that reach past what they are trusted for', async () => {
    const bytes = await readFile(resolve(import.meta.dirname, 'fixtures/avc-aac-1s.mp4'));
    const source = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });
    const segmentSeconds = 0.25;

    const segments = [];
    for await (const segment of new MediaBunnyAudioOnlyRemuxer().remuxSegments(source, segmentSeconds)) {
      segments.push(segment);
    }

    expect(segments.length).toBe(FIXTURE_DURATION_SECONDS / segmentSeconds);
    expect(segments[0]!.usableFromSeconds).toBe(0);
    for (const [index, segment] of segments.entries()) {
      expect(segment.usableFromSeconds).toBeCloseTo(index * segmentSeconds, 5);
      if (index > 0) expect(segment.startSeconds).toBeLessThan(segment.usableFromSeconds);
      const next = segments[index + 1];
      if (next) expect(segment.usableUntilSeconds).toBe(next.usableFromSeconds);

      const input = new Input({ source: new BlobSource(segment.bytes), formats: ALL_FORMATS });
      try {
        const audioTrack = await input.getPrimaryAudioTrack();
        expect(await audioTrack?.getCodec()).toBe('aac');
        expect(await audioTrack!.computeDuration()).toBeGreaterThan(segmentSeconds);
      } finally {
        input.dispose();
      }
    }
  });

  it('rejects a source with no audio track', async () => {
    const garbage = new Blob([new Uint8Array(64).fill(3)]);
    await expect(new MediaBunnyAudioOnlyRemuxer().remux(garbage)).rejects.toBeInstanceOf(Error);
  });
});
