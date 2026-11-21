import type { OutputFormat } from '@tscaps/engine';
import type { ExportNotice } from '@core/export/domain/ExportNotice';

/**
 * What a notice after a finished export says beyond the browser hints
 * every engine failure shares: what the video is missing and why, and
 * the other file format to try where the format is the cause.
 */
export interface ExportNoticeText {
  readonly lead: string;
  /** The remedy that names the other file format, or null where the format is not the cause. */
  readonly formatRemedy: string | null;
}

/**
 * The words of each notice shown when an export finishes with something
 * missing from the file. The first sentence says the video was exported
 * and what it is missing, so the reader never wonders whether the export
 * worked; then why, naming MP4 and WebM rather than "this format".
 */
export class ExportNoticeCopy {
  textOf(notice: ExportNotice): ExportNoticeText {
    const format = this.nameOf(notice.format);
    const tryOther = `Export the video again as ${this.nameOf(notice.format === 'mp4' ? 'webm' : 'mp4')}.`;
    switch (notice.kind) {
      case 'audio-mix-dropped':
        return notice.reason === 'no-encodable-target-codec'
          ? { lead: `Your video was exported, but without the sounds you added. This browser cannot save added sounds in ${format} files.`, formatRemedy: tryOther }
          : { lead: 'Your video was exported, but without the sounds you added. This browser cannot read the sound of your video.', formatRemedy: null };
      case 'audio-discarded':
        return notice.reason === 'no-encodable-target-codec'
          ? { lead: `Your video was exported, but without sound. This browser cannot save the sound of your video in ${format} files.`, formatRemedy: tryOther }
          : { lead: 'Your video was exported, but without sound. This browser cannot read the sound of your video.', formatRemedy: null };
    }
  }

  private nameOf(format: OutputFormat): string {
    return format === 'mp4' ? 'MP4' : 'WebM';
  }
}
