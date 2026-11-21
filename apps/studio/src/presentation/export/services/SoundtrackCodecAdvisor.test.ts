import { describe, expect, it } from 'vitest';
import { SoundtrackCodecAdvisor } from '@presentation/export/services/SoundtrackCodecAdvisor';

/**
 * The export dialog speaks about how the sound effects and music will be
 * saved only when it is not what a reader expects of the format.
 */

const advisor = new SoundtrackCodecAdvisor();

describe('SoundtrackCodecAdvisor', () => {
  it('says nothing about AAC in MP4 or Opus in WebM', () => {
    expect(advisor.adviseFor('mp4', { mp4: 'aac', webm: 'opus' })).toBeNull();
    expect(advisor.adviseFor('webm', { mp4: 'aac', webm: 'opus' })).toBeNull();
  });

  it('points out Opus inside an MP4 file', () => {
    expect(advisor.adviseFor('mp4', { mp4: 'opus', webm: 'opus' })).toEqual({ kind: 'opus-in-mp4' });
  });

  it('warns that the sounds are left out, naming a format that keeps them when there is one', () => {
    expect(advisor.adviseFor('webm', { mp4: 'aac', webm: null })).toEqual({ kind: 'not-encodable', otherFormat: 'mp4' });
    expect(advisor.adviseFor('mp4', { mp4: null, webm: null })).toEqual({ kind: 'not-encodable', otherFormat: null });
  });
});
