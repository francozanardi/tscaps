import { describe, expect, it } from 'vitest';
import { ExportNoticeCopy } from '@presentation/export/services/ExportNoticeCopy';

/** The notice after an export says what the video is missing, and names the other file format where that is the cause. */

const copy = new ExportNoticeCopy();

describe('the notice after an export', () => {
  it('names the format the export used, and offers the other one', () => {
    expect(copy.textOf({ kind: 'audio-mix-dropped', reason: 'no-encodable-target-codec', format: 'mp4' })).toEqual({
      lead: 'Your video was exported, but without the sounds you added. This browser cannot save added sounds in MP4 files.',
      formatRemedy: 'Export the video again as WebM.',
    });
    expect(copy.textOf({ kind: 'audio-discarded', reason: 'no-encodable-target-codec', format: 'webm' }).formatRemedy)
      .toBe('Export the video again as MP4.');
  });

  it('offers no other format where the format is not the cause', () => {
    expect(copy.textOf({ kind: 'audio-mix-dropped', reason: 'undecodable-input-audio', format: 'mp4' }).formatRemedy).toBeNull();
    expect(copy.textOf({ kind: 'audio-discarded', reason: 'unknown-source-codec', format: 'mp4' }).formatRemedy).toBeNull();
  });
});
