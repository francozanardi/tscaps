import {
  Document,
  Section,
  Segment,
  Line,
  Word,
  TimeFragment,
} from '@tscaps/engine';
import type { RenderOutputChunk, OutputFormat } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { LoadVideoAction } from '@core/editor/actions/video/LoadVideoAction';
import type { ExportVideoAction } from '@core/export/actions/ExportVideoAction';
import type { ExportWriterFactory } from '@core/editor/domain/ExportWriterFactory';
import type { ExportWriter } from '@core/editor/domain/ExportWriter';

export interface E2EHookDeps {
  editorStore: EditorStore;
  exportStore: ExportStore;
  loadVideo: LoadVideoAction;
  exportRun: ExportVideoAction;
}

declare global {
  interface Window {
    __tscapsE2E?: {
      ready: boolean;
      setVideo: (blob: Blob) => Promise<void>;
      setDocument: (json: unknown) => Promise<void>;
      triggerExport: () => Promise<void>;
      lastResult: { blob: Blob; sizeBytes: number; mimeType: string } | { error: string } | undefined;
    };
  }
}

/** Blob captured by the recording writer so triggerExport can publish it. */
interface BlobRef {
  value: Blob | null;
}

class RecordingExportWriter implements ExportWriter {
  private chunks: Array<{ data: Uint8Array; position: number }> = [];
  private opened = false;

  constructor(private readonly blobRef: BlobRef) {}

  async open(_format: OutputFormat): Promise<void> {
    if (this.opened) throw new Error('writer already opened');
    this.opened = true;
  }

  stream(): WritableStream<RenderOutputChunk> {
    return new WritableStream<RenderOutputChunk>({
      write: (chunk) => {
        // Copy: the renderer may recycle its source buffer after the write resolves.
        const data = new Uint8Array(chunk.data.byteLength);
        data.set(chunk.data);
        this.chunks.push({ data, position: chunk.position });
      },
    });
  }

  async finalize(): Promise<File | null> {
    if (!this.opened) throw new Error('writer not opened');
    let size = 0;
    for (const chunk of this.chunks) {
      const end = chunk.position + chunk.data.byteLength;
      if (end > size) size = end;
    }
    const buffer = new Uint8Array(size);
    for (const chunk of this.chunks) buffer.set(chunk.data, chunk.position);
    this.chunks = [];
    this.blobRef.value = new Blob([buffer], { type: 'video/mp4' });
    // Return null so ExportVideoAction.triggerDownload is skipped.
    return null;
  }

  async abort(): Promise<void> {
    this.chunks = [];
    this.blobRef.value = null;
  }

  dispose(): void {
    this.chunks = [];
  }
}

class RecordingExportWriterFactory implements ExportWriterFactory {
  constructor(private readonly blobRef: BlobRef) {}

  create(): ExportWriter {
    return new RecordingExportWriter(this.blobRef);
  }
}

/**
 * Builds a Document from a plain JSON object.
 *
 * Expected shape:
 * ```jsonc
 * {
 *   "sections": [{
 *     "kind": "main",
 *     "segments": [{
 *       "lines": [{
 *         "words": [{ "text": "hello", "start": 0.0, "end": 0.25 }]
 *       }]
 *     }]
 *   }]
 * }
 * ```
 */
function buildDocumentFromJson(json: unknown): Document {
  if (typeof json !== 'object' || json === null) throw new Error('Document JSON must be an object');
  const root = json as Record<string, unknown>;
  if (!Array.isArray(root['sections'])) throw new Error('Document JSON must have a "sections" array');

  const sections: Section[] = (root['sections'] as unknown[]).map((rawSection, si) => {
    if (typeof rawSection !== 'object' || rawSection === null)
      throw new Error(`Section ${si} must be an object`);
    const sec = rawSection as Record<string, unknown>;
    if (typeof sec['kind'] !== 'string') throw new Error(`Section ${si} must have a string "kind"`);
    if (!Array.isArray(sec['segments'])) throw new Error(`Section ${si} must have a "segments" array`);

    const segments: Segment[] = (sec['segments'] as unknown[]).map((rawSegment, gi) => {
      if (typeof rawSegment !== 'object' || rawSegment === null)
        throw new Error(`Segment ${si}.${gi} must be an object`);
      const seg = rawSegment as Record<string, unknown>;
      if (!Array.isArray(seg['lines'])) throw new Error(`Segment ${si}.${gi} must have a "lines" array`);

      const lines: Line[] = (seg['lines'] as unknown[]).map((rawLine, li) => {
        if (typeof rawLine !== 'object' || rawLine === null)
          throw new Error(`Line ${si}.${gi}.${li} must be an object`);
        const ln = rawLine as Record<string, unknown>;
        if (!Array.isArray(ln['words'])) throw new Error(`Line ${si}.${gi}.${li} must have a "words" array`);

        const words: Word[] = (ln['words'] as unknown[]).map((rawWord, wi) => {
          if (typeof rawWord !== 'object' || rawWord === null)
            throw new Error(`Word ${si}.${gi}.${li}.${wi} must be an object`);
          const w = rawWord as Record<string, unknown>;
          if (typeof w['text'] !== 'string') throw new Error(`Word ${si}.${gi}.${li}.${wi} must have a string "text"`);
          if (typeof w['start'] !== 'number') throw new Error(`Word ${si}.${gi}.${li}.${wi} must have a number "start"`);
          if (typeof w['end'] !== 'number') throw new Error(`Word ${si}.${gi}.${li}.${wi} must have a number "end"`);
          return new Word({ text: w['text'], time: new TimeFragment(w['start'], w['end']) });
        });

        return new Line({ words });
      });

      return new Segment({ lines });
    });

    return new Section({ kind: sec['kind'], segments });
  });

  return new Document({ sections });
}

function waitForTemplates(store: EditorStore, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (store.snapshot().availableTemplates.length > 0) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      store.removeEventListener('change', listener);
      reject(new Error('[e2e] timed out waiting for availableTemplates'));
    }, timeoutMs);
    const listener = () => {
      if (store.snapshot().availableTemplates.length > 0) {
        clearTimeout(timer);
        store.removeEventListener('change', listener);
        resolve();
      }
    };
    store.addEventListener('change', listener);
  });
}

export function attachE2EHookIfRequested(deps: E2EHookDeps): void {
  if (new URL(location.href).searchParams.get('e2e') !== '1') return;

  const blobRef: BlobRef = { value: null };
  const recordingFactory = new RecordingExportWriterFactory(blobRef);

  // Replace the writer factory used by the export action so the encoded bytes
  // are captured in memory instead of triggering a browser download. This is
  // the intended extension point — the factory is a constructor dep of
  // ExportVideoAction, exposed as a class field so the hook can swap it
  // without duplicating any wiring.
  (deps.exportRun as unknown as { exportWriterFactory: ExportWriterFactory }).exportWriterFactory = recordingFactory;

  window.__tscapsE2E = {
    ready: false,

    setVideo: async (blob: Blob) => {
      await waitForTemplates(deps.editorStore, 10_000);
      const file = new File([blob], 'sample.mp4', { type: blob.type || 'video/mp4' });
      deps.loadVideo.execute(file);
    },

    setDocument: async (json: unknown) => {
      const doc = buildDocumentFromJson(json);
      deps.editorStore.patch({ document: doc, status: 'ready' });
    },

    triggerExport: async () => {
      const onDone = new Promise<void>((resolve) => {
        let seenRunning = false;
        const listener = () => {
          const run = deps.exportStore.run;
          if (run !== null) {
            seenRunning = true;
          } else if (seenRunning) {
            deps.exportStore.removeEventListener('change', listener);
            resolve();
          }
        };
        deps.exportStore.addEventListener('change', listener);
      });

      void deps.exportRun.execute({ format: 'mp4', quality: 'low', resolution: 'original' });

      await onDone;

      const blob = blobRef.value;
      const editorError = deps.editorStore.snapshot().error;
      window.__tscapsE2E!.lastResult = blob
        ? { blob, sizeBytes: blob.size, mimeType: blob.type || 'video/mp4' }
        : { error: editorError ?? 'no bytes captured' };
    },

    lastResult: undefined,
  };

  window.__tscapsE2E.ready = true;
}
