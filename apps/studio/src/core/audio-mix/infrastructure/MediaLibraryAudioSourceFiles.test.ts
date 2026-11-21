import { describe, expect, it } from 'vitest';
import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';
import { MediaLibraryAudioSourceFiles } from '@core/audio-mix/infrastructure/MediaLibraryAudioSourceFiles';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { TestAudioMixTelemetry } from '@core/audio-mix/testing/TestAudioMixTelemetry';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';

/**
 * A sound that cannot be had plays nothing, and is reported once per
 * sound by why, never by the file's name or id.
 */

describe('MediaLibraryAudioSourceFiles', () => {
  it('reports a file that could not be read and one this browser cannot decode, each once', async () => {
    const telemetry = new TestAudioMixTelemetry();
    const bytes = {
      load: async (mediaId: string) => {
        if (mediaId === 'lost-take') throw new Error('gone');
        return new Blob(['x']);
      },
    } as unknown as MediaAssetBytesRepository;
    const files = new MediaLibraryAudioSourceFiles(
      bytes,
      new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, '/'),
      { ensurePlayable: async () => { throw new Error('no decoder'); } },
      telemetry.reporter,
    );

    expect(await files.load({ kind: 'media', mediaId: 'lost-take' })).toBeNull();
    expect(await files.load({ kind: 'media', mediaId: 'lost-take' })).toBeNull();
    expect(await files.load({ kind: 'media', mediaId: 'odd-codec' })).toBeNull();

    expect(telemetry.events).toEqual([
      ['audio_source_unavailable', { source: 'file', sound_id: null, reason: 'read-failed' }],
      ['audio_source_unavailable', { source: 'file', sound_id: null, reason: 'undecodable' }],
    ]);
    expect(JSON.stringify(telemetry.events)).not.toContain('lost-take');
  });
});
