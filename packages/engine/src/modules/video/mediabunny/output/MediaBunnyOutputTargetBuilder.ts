import {
  BufferTarget,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  WebMOutputFormat,
} from 'mediabunny';
import type {
  OutputTargetBuildRequest,
  OutputTargetBuildResult,
  OutputTargetBuilder,
} from '@modules/video/mediabunny/output/OutputTargetBuilder';

/**
 * Wires a mediabunny {@link Output} either to a streaming writable (for
 * direct-to-disk export through `showSaveFilePicker` or to an upload
 * pipeline) or to an in-memory buffer that the caller hands off as a
 * downloadable blob.
 */
export class MediaBunnyOutputTargetBuilder implements OutputTargetBuilder {

  build(request: OutputTargetBuildRequest): OutputTargetBuildResult {
    const format = request.format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat();
    if (request.stream) {
      return {
        target: null,
        format,
        output: new Output({ format, target: new StreamTarget(request.stream, { chunked: true }) }),
      };
    }
    const target = new BufferTarget();
    return { target, format, output: new Output({ format, target }) };
  }
}
