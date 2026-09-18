import type { SubtitleFileSerializer, SubtitleGranularity } from '@tscaps/engine';
import type { FileDownloader } from '@core/_shared/domain/FileDownloader';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { SubtitleFileFormat } from '@core/export/domain/SubtitleFileFormat';
import type { SubtitleFileSerializerRegistry } from '@core/export/services/SubtitleFileSerializerRegistry';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { ExportAccessPolicy } from '@core/export/domain/ExportAccessPolicy';

export interface ExportSubtitlesOptions {
  readonly format: SubtitleFileFormat;
  readonly granularity: SubtitleGranularity;
}

/**
 * Writes the captions to a subtitle file and hands it to the user, so
 * the timings can be carried into other editing software.
 *
 * Only the text and its timings travel: styling, decorations and
 * placement have no representation in a subtitle file and are dropped.
 * Cut words are left out and the remaining times follow the same
 * timeline a video export would produce, so both files line up against
 * the same footage.
 *
 * The work is a string transformation over state already in memory, so
 * the call finishes in one turn and reports no progress.
 *
 * Named *SubtitlesAction* to disambiguate from `ExportVideoAction`
 * (which burns the captions into the video) and `ExportProjectAction`
 * (which writes the editing work as a `.tscaps` file).
 */
export class ExportSubtitlesAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly cutAwareDocumentBuilder: CutAwareDocumentBuilder,
    private readonly serializers: SubtitleFileSerializerRegistry,
    private readonly fileDownloader: FileDownloader,
    private readonly telemetry: Telemetry,
    private readonly accessPolicy: ExportAccessPolicy,
  ) {}

  execute(options: ExportSubtitlesOptions): void {
    const state = this.editorStore.snapshot();
    if (!this.accessPolicy.access(state).available) return;
    const { document, cuts, projectName } = state;
    if (!document) return;

    const serializer = this.serializers.get(options.format);
    const body = serializer.serialize({
      document: this.cutAwareDocumentBuilder.build(document, cuts),
      granularity: options.granularity,
      ...(cuts.isEmpty() ? {} : { skipRanges: cuts.list() }),
    });

    this.fileDownloader.download(this.toBlob(body, serializer), this.fileNameFor(projectName, serializer));
    this.telemetry.capture('subtitles_exported', {
      format: options.format,
      granularity: options.granularity,
      has_cuts: !cuts.isEmpty(),
    });
  }

  private toBlob(body: string, serializer: SubtitleFileSerializer): Blob {
    return new Blob([body], { type: `${serializer.mediaType};charset=utf-8` });
  }

  private fileNameFor(projectName: string, serializer: SubtitleFileSerializer): string {
    const slug = projectName.trim().replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-');
    const safe = slug.length > 0 ? slug : 'captions';
    return `${safe}.${serializer.fileExtension}`;
  }
}
