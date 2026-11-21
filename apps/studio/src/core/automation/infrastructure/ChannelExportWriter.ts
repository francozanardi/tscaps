import type { OutputFormat, RenderOutputChunk } from '@tscaps/engine';
import type { AutomationChannel } from '@core/automation/domain/AutomationChannel';
import type { ExportFileOutcome } from '@core/automation/domain/ExportFileTarget';
import type { ExportWriter } from '@core/export/domain/ExportWriter';

/** Bytes gathered before they are sent: a run of the file that follows on from where it starts. */
interface PendingRun {
  readonly start: number;
  readonly parts: Uint8Array<ArrayBuffer>[];
  size: number;
}

const FLUSH_BYTES = 4 * 1024 * 1024;

/**
 * Sends an export's bytes over the automation channel to the file the
 * program named, as they are encoded, so the export never sits whole in
 * the page. Pieces that follow on from each other are sent together, up
 * to a few megabytes at a time; a piece written at another place (the
 * container's header, written last) goes on its own. Hands nothing to a
 * browser download.
 */
export class ChannelExportWriter implements ExportWriter {
  private pending: PendingRun | null = null;
  private size = 0;
  private ending: ExportFileOutcome = { kind: 'not-started' };

  constructor(
    private readonly channel: AutomationChannel,
    private readonly fileId: string,
  ) {}

  /** How this writer's export ended, so far. */
  outcome(): ExportFileOutcome {
    return this.ending;
  }

  async open(_format: OutputFormat): Promise<void> {
    this.ending = { kind: 'aborted' };
  }

  stream(): WritableStream<RenderOutputChunk> {
    return new WritableStream<RenderOutputChunk>({
      write: (chunk) => this.take(chunk),
      close: () => this.flush(),
    });
  }

  async finalize(): Promise<File | null> {
    await this.flush();
    this.ending = { kind: 'written', bytes: this.size };
    return null;
  }

  async abort(): Promise<void> {
    this.pending = null;
    this.ending = { kind: 'aborted' };
  }

  dispose(): void {
    this.pending = null;
  }

  private async take(chunk: RenderOutputChunk): Promise<void> {
    this.size = Math.max(this.size, chunk.position + chunk.data.byteLength);
    const pending = this.pending;
    if (pending !== null && pending.start + pending.size !== chunk.position) await this.flush();
    // A copy: the renderer may reuse its buffer once the write resolves.
    const copy = chunk.data.slice();
    if (this.pending === null) this.pending = { start: chunk.position, parts: [], size: 0 };
    this.pending.parts.push(copy);
    this.pending.size += copy.byteLength;
    if (this.pending.size >= FLUSH_BYTES) await this.flush();
  }

  private async flush(): Promise<void> {
    const pending = this.pending;
    if (pending === null) return;
    this.pending = null;
    const bytes = new Uint8Array(pending.size);
    let offset = 0;
    for (const part of pending.parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    await this.channel.writeFile(this.fileId, pending.start, bytes);
  }
}
