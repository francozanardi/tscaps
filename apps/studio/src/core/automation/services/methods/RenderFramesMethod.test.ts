import { describe, expect, it } from 'vitest';
import type { AutomationChannel } from '@core/automation/domain/AutomationChannel';
import type { BitmapPngEncoder } from '@core/automation/domain/BitmapPngEncoder';
import { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import { RenderFramesMethod } from '@core/automation/services/methods/RenderFramesMethod';
import type { ProjectFramePictures } from '@core/export/domain/ProjectFramePictures';
import type { LabeledPicture, PictureSheetComposer } from '@core/pictures/domain/PictureSheetComposer';

/** A render method over frames that are only names, with what it wrote and what it closed kept to look at. */
class Fixture {
  readonly written: Array<{ file: string; bytes: number[] }> = [];
  readonly labels: string[][] = [];
  closed = 0;

  method(drawn: ReadonlyArray<number>): RenderFramesMethod {
    const frames: ProjectFramePictures = {
      renderAt: async () => ({
        frames: drawn.map((sourceSec) => ({ sourceSec, bitmap: { close: () => { this.closed += 1; } } as unknown as ImageBitmap })),
        width: 1080,
        height: 1920,
        notes: [],
      }),
    };
    const encoder = { encode: async () => ({ bytes: new Uint8Array([1]), width: 54, height: 96 }) } as unknown as BitmapPngEncoder;
    const channel = { writeFile: async (file: string, _position: number, bytes: Uint8Array) => { this.written.push({ file, bytes: [...bytes] }); } } as unknown as AutomationChannel;
    const sheets: PictureSheetComposer = {
      sheet: async (pictures: ReadonlyArray<LabeledPicture>) => {
        this.labels.push(pictures.map((picture) => picture.label));
        return { mediaType: 'image/jpeg', base64: btoa('strip'), widthPx: 800, heightPx: 300 };
      },
    };
    return new RenderFramesMethod(frames, encoder, channel, new AutomationParamsReader(), sheets);
  }
}

describe('render_frames', () => {
  it('writes one picture per moment to the file named for it', async () => {
    const fixture = new Fixture();

    const answer = await fixture.method([1, 2]).run({ times: [1, 2], files: ['a', 'b'] });

    expect(fixture.written.map((write) => write.file)).toEqual(['a', 'b']);
    expect(answer).toMatchObject({ frames: [{ sourceSec: 1, file: 'a' }, { sourceSec: 2, file: 'b' }], outputWidth: 1080 });
    expect(fixture.closed).toBe(2);
  });

  it('writes the moments as one strip, each under its time, when given one file for them all', async () => {
    const fixture = new Fixture();

    const answer = await fixture.method([1, 2.5, 4]).run({ times: [1, 2.5, 4], stripFile: 'strip' });

    expect(fixture.labels).toEqual([['1.00 s', '2.50 s', '4.00 s']]);
    expect(fixture.written).toEqual([{ file: 'strip', bytes: [...'strip'].map((char) => char.charCodeAt(0)) }]);
    expect(answer).toMatchObject({ strip: { file: 'strip', width: 800, height: 300, times: [1, 2.5, 4] } });
    expect(fixture.closed).toBe(3);
  });

  it('answers no strip where no moment could be drawn', async () => {
    const fixture = new Fixture();

    const answer = await fixture.method([]).run({ times: [1], stripFile: 'strip' });

    expect(answer).toMatchObject({ strip: null });
    expect(fixture.written).toEqual([]);
  });

  it('refuses a call that names both a file per moment and a strip, or neither', async () => {
    const fixture = new Fixture();

    await expect(fixture.method([1]).run({ times: [1], files: ['a'], stripFile: 'strip' })).rejects.toThrow();
    await expect(fixture.method([1]).run({ times: [1] })).rejects.toThrow();
  });
});
