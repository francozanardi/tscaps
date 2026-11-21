import { z } from 'zod';
import type { AutomationChannel } from '@core/automation/domain/AutomationChannel';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { BitmapPngEncoder } from '@core/automation/domain/BitmapPngEncoder';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { ProjectFramePictureSet, ProjectFramePictures } from '@core/export/domain/ProjectFramePictures';
import type { PictureRegion, PictureSheetComposer } from '@core/pictures/domain/PictureSheetComposer';

const MAX_FRAMES = 12;

// A strip of a dozen frames of a vertical video at this size keeps each one's text readable.
const STRIP = { maxWidthPx: 2400, maxHeightPx: 1500 };

const PARAMS = z
  .object({
    times: z.array(z.number().min(0)).min(1).max(MAX_FRAMES),
    files: z.array(z.string().min(1)).min(1).max(MAX_FRAMES).optional(),
    stripFile: z.string().min(1).optional(),
    maxSidePx: z.number().int().min(64).max(4096).optional(),
    region: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).optional(),
  })
  .refine((params) => (params.stripFile === undefined) !== (params.files === undefined), { message: 'either a file per time, or one file for the strip' })
  .refine((params) => params.files === undefined || params.times.length === params.files.length, { message: 'one file per time' });

/**
 * `render_frames`: paints the output frame at source times as the export
 * would, and writes each as a PNG to the file the program named for it:
 * only `region` of it when given (shares of the frame, 0 to 1, to look
 * closely at a word or a graphic's text), scaled down so its longer side
 * is at most `maxSidePx`. Answers, per
 * picture drawn, its time, file and size, and the notes on how the
 * pictures differ from the export; a time that could not be drawn has no
 * picture and a note.
 *
 * Given `stripFile` instead of a file per time, it writes one picture
 * holding every moment side by side, each under its time, and answers it
 * as `strip` with the times it holds: how something moves across its
 * time is read from one picture, at a fraction of what one picture per
 * moment costs a model.
 */
export class RenderFramesMethod implements AutomationMethod {
  readonly name = 'render_frames';

  constructor(
    private readonly frames: ProjectFramePictures,
    private readonly encoder: BitmapPngEncoder,
    private readonly channel: AutomationChannel,
    private readonly params: AutomationParamsReader,
    private readonly sheets: PictureSheetComposer,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { times, files, stripFile, maxSidePx, region } = this.params.read(this.name, PARAMS, params);
    const pictures = await this.frames.renderAt(times, new AbortController().signal);
    try {
      if (stripFile !== undefined) return { ...(await this.strip(pictures, stripFile, region ?? null)), outputWidth: pictures.width, outputHeight: pictures.height, notes: pictures.notes };
      const written = [];
      for (const frame of pictures.frames) {
        const file = files?.[times.indexOf(frame.sourceSec)];
        if (file === undefined) continue;
        const png = await this.encoder.encode(frame.bitmap, region ?? null, maxSidePx ?? null);
        await this.channel.writeFile(file, 0, png.bytes);
        written.push({ sourceSec: frame.sourceSec, file, width: png.width, height: png.height });
      }
      return { frames: written, outputWidth: pictures.width, outputHeight: pictures.height, notes: pictures.notes };
    } finally {
      for (const frame of pictures.frames) frame.bitmap.close();
    }
  }

  /** Writes the frames of `pictures` as one strip to `file`; no strip where none could be drawn. */
  private async strip(pictures: ProjectFramePictureSet, file: string, region: PictureRegion | null): Promise<{ strip: { file: string; width: number; height: number; times: number[] } | null }> {
    if (pictures.frames.length === 0) return { strip: null };
    const sheet = await this.sheets.sheet(
      pictures.frames.map((frame) => ({ bitmap: frame.bitmap, label: `${frame.sourceSec.toFixed(2)} s` })),
      { ...STRIP, region, backdrop: 'none' },
    );
    await this.channel.writeFile(file, 0, Uint8Array.from(atob(sheet.base64), (char) => char.charCodeAt(0)));
    return { strip: { file, width: sheet.widthPx, height: sheet.heightPx, times: pictures.frames.map((frame) => frame.sourceSec) } };
  }
}
