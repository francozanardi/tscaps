import type {
  BufferTarget,
  Output,
  OutputFormat as MediaBunnyOutputFormat,
} from 'mediabunny';
import type { OutputFormat, RenderOutputChunk } from '@modules/video/RenderJob';

export interface OutputTargetBuildRequest {
  /** Desired container format. */
  format: OutputFormat | undefined;
  /**
   * Sink for the encoded bytes. When provided, the result's `target` is
   * null and the caller is responsible for handing the writable to whatever
   * persists or transmits the bytes.
   */
  stream: WritableStream<RenderOutputChunk> | undefined;
}

export interface OutputTargetBuildResult {
  output: Output;
  /** Non-null iff the caller didn't supply an output stream. */
  target: BufferTarget | null;
  /** The concrete output format chosen for the request. */
  format: MediaBunnyOutputFormat;
}

/**
 * Builds the {@link Output} the renderer writes into, plus the container
 * format it should use.
 */
export interface OutputTargetBuilder {
  build(request: OutputTargetBuildRequest): OutputTargetBuildResult;
}
